import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { buildSnapshot, renderSnapshot, windowForDate, renderWeekPattern, type Snapshot } from "./context";
import { enforceShiftWindow, withShiftBuffers } from "./shift";
import { sanitisePlanBlocks } from "./blocks";
import { dayFromKey, weekdayName, minutesBetween } from "./dates";
import { redListPromptBlock } from "./redlist";
import { recallMemories, renderMemories, saveMemory, forgetMemory } from "./memory";
import { webLookup } from "./web";

const MODEL = "gpt-4o-mini";

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const NAVIGATOR_PERSONA = `You are Navigator — a daily companion for one person: a highly intelligent (IQ ~130) adult with ADHD.

How you talk:
- Short. Lists and steps, never walls of text. Default to under 120 words.
- Direct and warm. No cheerleading, no therapy-speak, no moralising, zero shame.
- Never more than 3 options at once. If they ask an open question, pick a default and say why in one line.
- Concrete over abstract: exact first physical action, exact minutes, exact time.
- Ask a clarifying question ONLY when you genuinely cannot act without it. Otherwise assume, act, and say what you assumed.

ADHD mechanics you always apply:
- Time blindness: attach a realistic minute estimate to everything, and inflate their own estimates by ~50%.
- Task initiation: give a "start trigger" — a 2-minute physical action that requires no decisions (e.g. "open the file and type the heading, nothing else").
- Working memory: one thing at a time. Point at the next action, not the whole list.
- Overwhelm: when they dump a lot, compress it into max 3 items and park the rest.
- Dopamine: pair boring tasks with a quick win or a movement break; name the payoff.
- Transitions: name the switch out loud ("stop at 14:20, 5 min walk, then admin").

High-IQ layer:
- Respect their intelligence: no baby steps on thinking, only on doing.
- Use pattern-based planning (batch by context/energy, not by category).
- Cut overthinking: when they spiral, give a decision rule, a deadline, and a default.
- If they want depth, they will ask — then go deep and technical.

Boundaries: you are not a clinician. No diagnosis, no medication advice. If they mention crisis-level distress, say plainly that a human professional is the right call, and stay kind.

You have tools that change their real data. Use them rather than telling the user to do it themselves. After using tools, confirm in one line what changed.

Memory:
- You remember this person across sessions. When something durable comes up — a preference, a person in their life, a project, an ongoing thread, a standing constraint — store it with "remember". Do NOT store today's plan, passing moods, or anything they did not actually say.
- When they refer to something you cannot see in your current context, use "recall_memory" before saying you do not know.
- The moment they say you have something wrong, or ask you to drop it, call "forget" with that key. Never argue with them about what you remember.
- Use what you remember naturally, the way a person would. Never recite the list back at them.

You can also read their record: search_tasks, day_history, habit_stats and checkin_trends. When they ask what is outstanding, how a week went, or whether a pattern is real, look it up instead of guessing.

The live web:
- You have "web_lookup". Use it for anything that could have changed since you were trained, or that you are not certain about: prices, wage rates, law and regulation, opening hours, suppliers, competitors, product specs, news, "is this still true".
- Being confidently wrong about a real-world number is worse than taking a few seconds to check. Check.
- Report what you found with the figure first, and name at most two sources as bare domains, e.g. [workplacerelations.ie]. Never cite a source the lookup did not return.
- If the lookup fails or finds nothing, say that in one line. Do not answer from memory as though you had checked.`;

// --------------------------------------------------------------------------
// Tone (6.2 Personality)
// --------------------------------------------------------------------------

export type CoachTone = "warm" | "direct" | "drill" | "clinical";

export const COACH_TONES: { value: CoachTone; label: string; blurb: string }[] = [
  { value: "warm", label: "Warm", blurb: "Kind and encouraging. Best on low days." },
  { value: "direct", label: "Direct", blurb: "Plain and brief. The default." },
  { value: "drill", label: "Drill sergeant", blurb: "Blunt, urgent, no coddling." },
  { value: "clinical", label: "Clinical", blurb: "Neutral data. No feelings at all." },
];

// Layered ON TOP of the persona, never replacing it — the ADHD mechanics and the
// "not a clinician" boundary must survive every tone.
const TONE_OVERLAY: Record<CoachTone, string> = {
  warm: `TONE: warm. Lead with one short line of genuine encouragement before the action. Acknowledge effort and bad days without pity or therapy-speak. Still concrete, still under 120 words.`,
  direct: `TONE: direct. Plain, brief, neutral. No warm-up line, no sign-off. State the next action and stop.`,
  drill: `TONE: drill sergeant. Blunt and urgent. Short imperative sentences. Name the excuse when you see one, then give the order. Push hard on starting NOW. Never cruel, never insulting, never about their worth as a person — only about the action. Hard cap 70 words.`,
  clinical: `TONE: clinical. Report like an instrument: facts, numbers, times, no adjectives, no encouragement, no emotional language at all. Bullet points preferred. Do not ask how they feel.`,
};

export function asCoachTone(raw: unknown): CoachTone {
  return raw === "warm" || raw === "drill" || raw === "clinical" ? raw : "direct";
}

/**
 * The persona the model actually gets, with the user's chosen tone applied.
 *
 * Applied to the conversational surfaces only: chat, the weekly review, and
 * motivation nudges. The structured JSON generators (day plan, breakdown, meals,
 * workouts) stay on the neutral persona on purpose — the overlays carry hard word
 * caps and formatting rules that fight a strict JSON schema.
 */
export function personaFor(tone: unknown): string {
  // The red list is appended last so it is the final thing in the system
  // prompt, and it is appended unconditionally — there is no tone, no setting
  // and no caller that can drop it. See lib/navigator/redlist.ts.
  return `${NAVIGATOR_PERSONA}\n\n${TONE_OVERLAY[asCoachTone(tone)]}\n\n${redListPromptBlock()}`;
}

// --------------------------------------------------------------------------
// Tools
// --------------------------------------------------------------------------

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task. Use for anything the user needs to do later.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          project: { type: "string", description: "Bucket/project name if it belongs to one" },
          priority: { type: "string", enum: ["urgent", "important", "quickwin", "later"] },
          effortMins: { type: "number" },
          startTrigger: { type: "string", description: "The 2-minute first physical action" },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
          scheduledFor: { type: "string", description: "YYYY-MM-DD — the day to do it" },
        },
        required: ["title", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "break_down_task",
      description:
        "Split an existing task into 3-7 micro-steps. Each step must be doable in one sitting with no decisions left in it.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                effortMins: { type: "number" },
                startTrigger: { type: "string" },
              },
              required: ["title", "effortMins"],
            },
          },
        },
        required: ["taskId", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Change status, priority, estimate or scheduled day of a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          status: { type: "string", enum: ["todo", "doing", "done", "parked"] },
          priority: { type: "string", enum: ["urgent", "important", "quickwin", "later"] },
          effortMins: { type: "number" },
          scheduledFor: { type: "string", description: "YYYY-MM-DD" },
          startTrigger: { type: "string" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_day_plan",
      description:
        "Write today's (or a given day's) structure. Blocks must cover morning, mid-day and evening, include meals, movement, breaks and transitions.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          focusTheme: { type: "string", description: "One line: what makes this day a win" },
          anchor: { type: "string", description: "If you only do one thing today, do this" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start: { type: "string", description: "HH:mm" },
                end: { type: "string", description: "HH:mm" },
                label: { type: "string" },
                kind: {
                  type: "string",
                  enum: ["deep", "admin", "meal", "move", "break", "transition", "rest", "social", "buffer"],
                },
                taskId: { type: "string" },
                why: { type: "string", description: "One short line on why it sits here" },
              },
              required: ["start", "end", "label", "kind"],
            },
          },
        },
        required: ["blocks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_meals",
      description: "Plan meals for a day. Keep prep low-friction and respect the user's food notes.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          replace: { type: "boolean", description: "Clear existing meals for that day first" },
          meals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
                title: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                prepMins: { type: "number" },
                protein: { type: "number", description: "Rough grams of protein" },
                notes: { type: "string" },
              },
              required: ["slot", "title", "prepMins"],
            },
          },
        },
        required: ["meals"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_grocery_items",
      description: "Add items to the grocery list.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                qty: { type: "string" },
                category: {
                  type: "string",
                  enum: ["produce", "protein", "dairy", "pantry", "frozen", "other"],
                },
              },
              required: ["name"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_workout",
      description: "Plan one movement session. 5-20 minutes unless the user asks for longer.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          title: { type: "string" },
          kind: { type: "string", enum: ["strength", "cardio", "mobility", "walk", "movement"] },
          durationMins: { type: "number" },
          intensity: { type: "string", enum: ["easy", "moderate", "hard"] },
          steps: { type: "array", items: { type: "string" }, description: "The actual exercises, in order" },
        },
        required: ["title", "kind", "durationMins", "intensity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_habit",
      description: "Create a habit to track. Always hang it off an existing routine via the cue.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          targetPerWk: { type: "number" },
          cue: { type: "string", description: "After X, I do this" },
        },
        required: ["name", "targetPerWk"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_habit",
      description: "Mark a habit done (or undone) for a day.",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          done: { type: "boolean" },
        },
        required: ["habitId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_checkin",
      description:
        "Record a 1-5 reading for energy, hunger, overstimulation, mood or focus. Use it whenever the user mentions how they feel.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["energy", "hunger", "overstim", "mood", "focus"] },
          value: { type: "number", description: "1-5" },
          note: { type: "string" },
        },
        required: ["kind", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_focus_session",
      description: "Start a hyperfocus block. Only when the user is ready to begin right now.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          plannedMins: { type: "number" },
          taskId: { type: "string" },
        },
        required: ["label", "plannedMins"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_reflection",
      description: "Save the end-of-day reflection for a day.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          wins: { type: "string" },
          friction: { type: "string" },
          scoreOutOf5: { type: "number" },
          reflection: { type: "string" },
        },
        required: [],
      },
    },
  },

  // ---- Read tools -------------------------------------------------------
  // Everything above writes. Without these the assistant could only ever act
  // on the fixed snapshot it was handed, so any question about the user's own
  // history ("how often did I skip the gym?") was unanswerable.
  {
    type: "function",
    function: {
      name: "search_tasks",
      description:
        "Search the user's tasks. Use whenever they refer to a task you cannot see in the snapshot, or ask what is outstanding in some area.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Words to match in title/notes" },
          status: {
            type: "string",
            enum: ["todo", "doing", "done", "parked", "draft", "any"],
            description: "Defaults to any except draft",
          },
          project: { type: "string" },
          limit: { type: "number", description: "Max 25, defaults to 10" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "day_history",
      description:
        "Look back at previous days: focus theme, energy, score, wins, friction and reflections. Use for 'how was last week', pattern spotting, or comparing to now.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "How many days back, max 60, defaults to 14" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "habit_stats",
      description:
        "Completion counts per habit over a window, with target-per-week. Use for any question about consistency or streaks.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Window in days, max 120, defaults to 30" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkin_trends",
      description:
        "Averages of the user's energy/mood/focus/hunger/overstim check-ins over a window, split by time of day. Use to ground advice in their real pattern rather than guessing.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Window in days, max 90, defaults to 21" },
        },
        required: [],
      },
    },
  },

  // ---- Web --------------------------------------------------------------
  // Read-only and outward-facing. Everything else here reads his own record;
  // this is the only tool that can see the world, which is why the persona
  // insists on it for anything current rather than answering from stale
  // training data with total confidence.
  {
    type: "function",
    function: {
      name: "web_lookup",
      description:
        "Look something up on the live web and get an answer with real sources. Use for anything current or verifiable: prices, wage rates, legal or regulatory detail, opening hours, suppliers, competitors, product specs, news, 'is X still true'. Always use this instead of answering from memory when the answer could have changed, and when you are not certain.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The question, in plain words. Include the year or 'current' when it matters.",
          },
          depth: {
            type: "string",
            enum: ["low", "medium"],
            description: "low (default, fast) for a single fact; medium for a question needing several sources",
          },
        },
        required: ["query"],
      },
    },
  },

  // ---- Memory -----------------------------------------------------------
  {
    type: "function",
    function: {
      name: "recall_memory",
      description:
        "Search what you remember about this person. Use when they refer to something from a past conversation, a person, or an ongoing thread you cannot see in your current context.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Store something durable about the user so it survives to future conversations. Use when they tell you a lasting fact, preference, person or project — NOT for today's plan or passing moods. Reuse an existing key to update it.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["fact", "preference", "person", "thread", "project"] },
          key: { type: "string", description: "Short reusable label, e.g. 'gym timing'" },
          value: { type: "string", description: "One plain sentence" },
          subject: { type: "string", description: "Who/what it is about, for person or thread" },
          pinned: { type: "boolean", description: "Always keep in context. Use sparingly." },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forget",
      description:
        "Stop remembering something, by its key. Use the moment the user asks you to forget it or tells you it is wrong.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "The key of the memory to drop" },
        },
        required: ["key"],
      },
    },
  },
];

export type ToolAction = { tool: string; summary: string };

async function upsertPlan(userId: string, dateKey: string, data: Record<string, unknown>) {
  const date = dayFromKey(dateKey);
  return prisma.navDayPlan.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });
}

async function runTool(
  userId: string,
  snapshot: Snapshot,
  name: string,
  args: any
): Promise<{ result: unknown; action: ToolAction }> {
  const today = snapshot.today;

  switch (name) {
    case "create_task": {
      const t = await prisma.navTask.create({
        data: {
          userId,
          title: args.title,
          notes: args.notes ?? null,
          project: args.project ?? null,
          priority: args.priority ?? "important",
          effortMins: args.effortMins ?? null,
          startTrigger: args.startTrigger ?? null,
          dueDate: args.dueDate ? new Date(args.dueDate) : null,
          scheduledFor: args.scheduledFor ? dayFromKey(args.scheduledFor) : null,
        },
      });
      return { result: { id: t.id }, action: { tool: name, summary: `Task added: ${t.title}` } };
    }

    case "break_down_task": {
      const parent = await prisma.navTask.findFirst({ where: { id: args.taskId, userId } });
      if (!parent) return { result: { error: "task not found" }, action: { tool: name, summary: "Task not found" } };
      const steps = (args.steps ?? []).slice(0, 8);
      await prisma.$transaction(
        steps.map((s: any, i: number) =>
          prisma.navTask.create({
            data: {
              userId,
              parentId: parent.id,
              title: s.title,
              effortMins: s.effortMins ?? null,
              startTrigger: s.startTrigger ?? null,
              project: parent.project,
              priority: parent.priority,
              order: i,
            },
          })
        )
      );
      return {
        result: { created: steps.length },
        action: { tool: name, summary: `Broke "${parent.title}" into ${steps.length} micro-steps` },
      };
    }

    case "update_task": {
      const patch: Record<string, unknown> = {};
      if (args.status) {
        patch.status = args.status;
        patch.completedAt = args.status === "done" ? new Date() : null;
      }
      if (args.priority) patch.priority = args.priority;
      if (args.effortMins != null) patch.effortMins = args.effortMins;
      if (args.startTrigger) patch.startTrigger = args.startTrigger;
      if (args.scheduledFor) patch.scheduledFor = dayFromKey(args.scheduledFor);
      const r = await prisma.navTask.updateMany({ where: { id: args.taskId, userId }, data: patch });
      return {
        result: { updated: r.count },
        action: { tool: name, summary: `Task updated (${Object.keys(patch).join(", ") || "no change"})` },
      };
    }

    case "set_day_plan": {
      const key = args.date ?? today;
      // The model occasionally emits a half-finished block. Storing one used to
      // break the whole Navigator page on every later load, so nothing that
      // isn't a real HH:mm window with a label is allowed into the day.
      const blocks = sanitisePlanBlocks(args.blocks);
      const dropped = (Array.isArray(args.blocks) ? args.blocks.length : 0) - blocks.length;
      await upsertPlan(userId, key, {
        focusTheme: args.focusTheme ?? null,
        anchor: args.anchor ?? null,
        blocks,
      });
      return {
        result: { blocks: blocks.length, dropped },
        action: {
          tool: name,
          summary: `Day plan set for ${key} (${blocks.length} blocks${dropped ? `, ${dropped} malformed dropped` : ""})`,
        },
      };
    }

    case "plan_meals": {
      const key = args.date ?? today;
      const date = dayFromKey(key);
      if (args.replace) await prisma.navMeal.deleteMany({ where: { userId, date } });
      const meals = (args.meals ?? []).slice(0, 8);
      await prisma.$transaction(
        meals.map((m: any) =>
          prisma.navMeal.create({
            data: {
              userId,
              date,
              slot: m.slot,
              title: m.title,
              ingredients: m.ingredients ?? [],
              prepMins: m.prepMins ?? 10,
              protein: m.protein ?? null,
              notes: m.notes ?? null,
            },
          })
        )
      );
      return { result: { created: meals.length }, action: { tool: name, summary: `${meals.length} meals planned for ${key}` } };
    }

    case "add_grocery_items": {
      const items = (args.items ?? []).slice(0, 40);
      await prisma.$transaction(
        items.map((i: any) =>
          prisma.navGroceryItem.create({
            data: { userId, name: i.name, qty: i.qty ?? null, category: i.category ?? "other" },
          })
        )
      );
      return { result: { created: items.length }, action: { tool: name, summary: `${items.length} items on the grocery list` } };
    }

    case "plan_workout": {
      const key = args.date ?? today;
      const w = await prisma.navWorkout.create({
        data: {
          userId,
          date: dayFromKey(key),
          title: args.title,
          kind: args.kind ?? "movement",
          durationMins: args.durationMins ?? 10,
          intensity: args.intensity ?? "easy",
          steps: args.steps ?? [],
        },
      });
      return { result: { id: w.id }, action: { tool: name, summary: `Movement planned: ${w.title} (${w.durationMins}min)` } };
    }

    case "add_habit": {
      const count = await prisma.navHabit.count({ where: { userId } });
      const h = await prisma.navHabit.create({
        data: {
          userId,
          name: args.name,
          emoji: args.emoji ?? "*",
          targetPerWk: args.targetPerWk ?? 7,
          cue: args.cue ?? null,
          order: count,
        },
      });
      return { result: { id: h.id }, action: { tool: name, summary: `Habit tracked: ${h.name}` } };
    }

    case "log_habit": {
      const date = dayFromKey(args.date ?? today);
      const habit = await prisma.navHabit.findFirst({ where: { id: args.habitId, userId } });
      if (!habit) return { result: { error: "habit not found" }, action: { tool: name, summary: "Habit not found" } };
      const done = args.done !== false;
      await prisma.navHabitLog.upsert({
        where: { habitId_date: { habitId: habit.id, date } },
        create: { userId, habitId: habit.id, date, done },
        update: { done },
      });
      return { result: { ok: true }, action: { tool: name, summary: `${habit.name} logged` } };
    }

    case "log_checkin": {
      const c = await prisma.navCheckin.create({
        data: { userId, kind: args.kind, value: Math.max(1, Math.min(5, Math.round(args.value))), note: args.note ?? null },
      });
      return { result: { id: c.id }, action: { tool: name, summary: `${c.kind} logged at ${c.value}/5` } };
    }

    case "start_focus_session": {
      await prisma.navFocusSession.updateMany({
        where: { userId, endedAt: null },
        data: { endedAt: new Date() },
      });
      const s = await prisma.navFocusSession.create({
        data: {
          userId,
          label: args.label,
          plannedMins: args.plannedMins ?? snapshot.profile.focusMins,
          taskId: args.taskId ?? null,
        },
      });
      if (args.taskId) {
        await prisma.navTask.updateMany({ where: { id: args.taskId, userId }, data: { status: "doing" } });
      }
      return { result: { id: s.id }, action: { tool: name, summary: `Focus session started: ${s.label} (${s.plannedMins}min)` } };
    }

    case "save_reflection": {
      const key = args.date ?? today;
      await upsertPlan(userId, key, {
        wins: args.wins ?? undefined,
        friction: args.friction ?? undefined,
        scoreOutOf5: args.scoreOutOf5 ?? undefined,
        reflection: args.reflection ?? undefined,
      });
      return { result: { ok: true }, action: { tool: name, summary: `Reflection saved for ${key}` } };
    }

    // ---- Read tools -----------------------------------------------------
    // These never write. They exist so the model can answer "what's left on
    // X" or "how was last week" from the record instead of guessing, which is
    // the difference between an assistant and a confident liar.
    case "search_tasks": {
      const q = typeof args.query === "string" ? args.query.trim() : "";
      const status = typeof args.status === "string" ? args.status : "any";
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);

      const where: any = { userId, archivedAt: null };
      // "draft" is an un-triaged capture and is deliberately invisible unless
      // asked for by name — see the schema comment on NavTask.status.
      if (status === "any") where.status = { not: "draft" };
      else where.status = status;
      if (args.project) where.project = { contains: String(args.project), mode: "insensitive" };
      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { project: { contains: q, mode: "insensitive" } },
        ];
      }

      const rows = await prisma.navTask.findMany({
        where,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          project: true,
          effortMins: true,
          dueDate: true,
          scheduledFor: true,
          parentId: true,
        },
      });

      return {
        result: {
          count: rows.length,
          tasks: rows.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            project: t.project,
            effortMins: t.effortMins,
            due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
            scheduledFor: t.scheduledFor ? t.scheduledFor.toISOString().slice(0, 10) : null,
            isSubtask: Boolean(t.parentId),
          })),
        },
        action: { tool: name, summary: `Searched tasks${q ? ` for "${q}"` : ""} — ${rows.length} found` },
      };
    }

    case "day_history": {
      const days = Math.min(Math.max(Number(args.days) || 14, 1), 60);
      const from = dayFromKey(today);
      from.setDate(from.getDate() - days);

      const rows = await prisma.navDayPlan.findMany({
        where: { userId, date: { gte: from } },
        orderBy: { date: "desc" },
        take: days,
        select: {
          date: true,
          energy: true,
          mood: true,
          availableHours: true,
          focusTheme: true,
          anchor: true,
          wins: true,
          friction: true,
          scoreOutOf5: true,
          reflection: true,
        },
      });

      const scored = rows.filter((r) => typeof r.scoreOutOf5 === "number");
      const avgScore = scored.length
        ? Math.round((scored.reduce((a, r) => a + (r.scoreOutOf5 ?? 0), 0) / scored.length) * 10) / 10
        : null;

      return {
        result: {
          days,
          daysLogged: rows.length,
          avgScoreOutOf5: avgScore,
          history: rows.map((r) => ({
            date: r.date.toISOString().slice(0, 10),
            weekday: weekdayName(r.date.toISOString().slice(0, 10)),
            energy: r.energy,
            mood: r.mood,
            availableHours: r.availableHours,
            focusTheme: r.focusTheme,
            anchor: r.anchor,
            wins: r.wins,
            friction: r.friction,
            scoreOutOf5: r.scoreOutOf5,
            reflection: r.reflection,
          })),
        },
        action: { tool: name, summary: `Reviewed the last ${days} days (${rows.length} logged)` },
      };
    }

    case "habit_stats": {
      const days = Math.min(Math.max(Number(args.days) || 30, 1), 120);
      const from = dayFromKey(today);
      from.setDate(from.getDate() - days);

      const habits = await prisma.navHabit.findMany({
        where: { userId, active: true },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          emoji: true,
          targetPerWk: true,
          cue: true,
          logs: {
            where: { date: { gte: from }, done: true },
            select: { date: true },
            orderBy: { date: "desc" },
          },
        },
      });

      const weeks = Math.max(days / 7, 1);
      return {
        result: {
          windowDays: days,
          habits: habits.map((h) => {
            const done = h.logs.length;
            const perWeek = Math.round((done / weeks) * 10) / 10;
            return {
              name: h.name,
              emoji: h.emoji,
              cue: h.cue,
              targetPerWk: h.targetPerWk,
              doneInWindow: done,
              actualPerWeek: perWeek,
              onTarget: h.targetPerWk ? perWeek >= h.targetPerWk : null,
              lastDone: h.logs[0] ? h.logs[0].date.toISOString().slice(0, 10) : null,
            };
          }),
        },
        action: { tool: name, summary: `Checked habit consistency over ${days} days` },
      };
    }

    case "checkin_trends": {
      const days = Math.min(Math.max(Number(args.days) || 21, 1), 90);
      const from = new Date();
      from.setDate(from.getDate() - days);

      const rows = await prisma.navCheckin.findMany({
        where: { userId, at: { gte: from } },
        orderBy: { at: "desc" },
        take: 600,
        select: { at: true, kind: true, value: true },
      });

      // Split by part of day: the useful signal for an ADHD day is *when* the
      // dip lands, not the flat average.
      const slotOf = (d: Date) => {
        const h = d.getHours();
        if (h < 12) return "morning";
        if (h < 17) return "afternoon";
        return "evening";
      };
      const buckets = new Map<string, { sum: number; n: number }>();
      for (const r of rows) {
        for (const k of [r.kind, `${r.kind}/${slotOf(r.at)}`]) {
          const b = buckets.get(k) ?? { sum: 0, n: 0 };
          b.sum += r.value;
          b.n += 1;
          buckets.set(k, b);
        }
      }
      const averages: Record<string, { avg: number; samples: number }> = {};
      for (const [k, b] of buckets) {
        averages[k] = { avg: Math.round((b.sum / b.n) * 10) / 10, samples: b.n };
      }

      return {
        result: { windowDays: days, checkins: rows.length, averagesOutOf5: averages },
        action: { tool: name, summary: `Checked ${rows.length} check-ins over ${days} days` },
      };
    }

    // ---- Web ------------------------------------------------------------
    case "web_lookup": {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return {
          result: { error: "no query" },
          action: { tool: name, summary: "Web lookup skipped — no query" },
        };
      }
      // 22s, not the module default of 28s: chat allows 3 tool rounds inside a
      // 60s route, so two lookups plus the final completion still fit.
      const found = await webLookup(query, {
        depth: args.depth === "medium" ? "medium" : "low",
        timeoutMs: 22_000,
      });
      return {
        result: {
          query,
          answer: found.answer,
          sources: found.sources,
          // Named so the model cannot quietly present a failed lookup as fact.
          lookupFailed: Boolean(found.failed),
          instruction: found.failed
            ? "The lookup failed. Tell the user you could not check, in one line. Do NOT answer from memory as if you had checked."
            : "Answer from this. Cite at most 2 sources, as a bare domain in brackets. Never invent a source that is not listed.",
        },
        action: {
          tool: name,
          summary: found.failed
            ? `Web lookup failed: ${query.slice(0, 60)}`
            : `Looked up "${query.slice(0, 60)}" — ${found.sources.length} source${found.sources.length === 1 ? "" : "s"}`,
        },
      };
    }

    // ---- Memory ---------------------------------------------------------
    case "recall_memory": {
      const rows = await recallMemories(userId, String(args.query ?? ""), 12);
      return {
        result: {
          count: rows.length,
          memories: rows.map((r) => ({ kind: r.kind, key: r.key, subject: r.subject, value: r.value, pinned: r.pinned })),
        },
        action: { tool: name, summary: `Recalled ${rows.length} memor${rows.length === 1 ? "y" : "ies"}` },
      };
    }

    case "remember": {
      const saved = await saveMemory(userId, {
        kind: args.kind,
        key: String(args.key ?? ""),
        value: String(args.value ?? ""),
        subject: args.subject ? String(args.subject) : null,
        source: "chat",
        pinned: args.pinned === true ? true : undefined,
      });
      if (!saved) {
        return { result: { ok: false, error: "key and value are both required" }, action: { tool: name, summary: "Nothing to remember" } };
      }
      return {
        result: { ok: true, key: saved.key, kind: saved.kind },
        action: { tool: name, summary: `Remembered: ${saved.key}` },
      };
    }

    case "forget": {
      const key = String(args.key ?? "");
      const n = await forgetMemory(userId, { key });
      return {
        result: { ok: n > 0, dropped: n },
        action: { tool: name, summary: n > 0 ? `Forgot: ${key}` : `Nothing stored under "${key}"` },
      };
    }

    default:
      return { result: { error: `unknown tool ${name}` }, action: { tool: name, summary: "Unknown tool" } };
  }
}

// --------------------------------------------------------------------------
// Chat
// --------------------------------------------------------------------------

export async function navigatorChat(
  userId: string,
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ reply: string; actions: ToolAction[] }> {
  const snapshot = await buildSnapshot(userId);
  const openai = client();

  // Long-term memory, retrieved against this message. Injected as its own
  // system message so it survives the history window instead of scrolling off
  // after 14 turns like everything else.
  const memoryBlock = renderMemories(await recallMemories(userId, userMessage));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: personaFor(snapshot.profile.coachTone) },
    { role: "system", content: `Current state of the user's day:\n\n${renderSnapshot(snapshot)}` },
    ...(memoryBlock ? [{ role: "system" as const, content: memoryBlock }] : []),
    ...history.slice(-14).map((m) => ({ role: m.role, content: m.content }) as const),
    { role: "user", content: userMessage },
  ];

  const actions: ToolAction[] = [];

  // Up to 3 rounds so the model can chain (e.g. create task -> break it down).
  for (let round = 0; round < 3; round++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 900,
      messages,
      tools,
    });

    const msg = res.choices[0]?.message;
    if (!msg) break;
    messages.push(msg as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    const calls = msg.tool_calls ?? [];
    if (!calls.length) {
      return { reply: msg.content?.trim() || "…", actions };
    }

    for (const call of calls) {
      if (call.type !== "function") continue;
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      const { result, action } = await runTool(userId, snapshot, call.function.name, args);
      actions.push(action);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 2000),
      });
    }
  }

  // Ran out of rounds — ask for a plain summary of what happened.
  const final = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 300,
    messages: [...messages, { role: "user", content: "Summarise what you just did in max 3 short lines." }],
  });
  return { reply: final.choices[0]?.message?.content?.trim() || "Done.", actions };
}

// --------------------------------------------------------------------------
// One-shot generators (buttons, not chat)
// --------------------------------------------------------------------------

async function json<T>(system: string, user: string, maxTokens = 1400): Promise<T> {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

/**
 * Same helper, exported for Navigator modules that live outside this file.
 * Kept as an alias so there is exactly one place that decides model, temperature
 * and JSON mode.
 */
export const navigatorJson = json;

export type GeneratedBlock = {
  start: string;
  end: string;
  label: string;
  kind: string;
  why?: string;
  taskId?: string;
};

export async function generateDayPlan(
  userId: string,
  input: { energy: number; availableHours: number; mood?: string; mustDo?: string; dateKey?: string }
) {
  const snapshot = await buildSnapshot(userId);
  const key = input.dateKey ?? snapshot.today;
  const p = snapshot.profile;
  const { window: shift, source } = windowForDate(p, key);
  const weekShape = renderWeekPattern(p);
  const shiftLine = shift
    ? `Work shift today: ${shift.start}–${shift.end}${shift.note ? ` (${shift.note})` : ""} (${Math.round(
        minutesBetween(shift.start, shift.end) / 60
      )}h). This is FIXED. Represent it as ONE block of kind "work" — never split it, never schedule tasks inside it. Real free time is only before ${shift.start} and after ${shift.end}.`
    : source === "pattern"
      ? `Today is a DAY OFF — no work shift. Keep it restful: family, garden, walk, optional light project time. Do not build a working day.`
      : `Work window ${p.workStart}–${p.workEnd} (no weekly pattern set).`;

  const out = await json<{ focusTheme: string; anchor: string; blocks: GeneratedBlock[] }>(
    `${NAVIGATOR_PERSONA}

Return JSON only: { "focusTheme": string, "anchor": string, "blocks": [{ "start": "HH:mm", "end": "HH:mm", "label": string, "kind": "deep"|"admin"|"meal"|"move"|"break"|"transition"|"rest"|"social"|"work"|"buffer", "why": string, "taskId"?: string }] }

Rules for blocks:
- The work shift is immovable. Emit it as a single "work" block and plan only around it. Never place deep/admin work inside the shift.
- Include a short "transition" block for getting ready and travelling before the shift, and a decompress block after it.
- Cover morning, mid-day and evening between wake and sleep time. 8-14 blocks, no more.
- At most 2 deep blocks. Deep blocks match the reported energy: energy 1-2 = 25min max, 3 = 40min, 4-5 = up to the user's preferred focus length.
- Every deep or admin block is followed by a break or transition block.
- Include meals at sane times, at least one movement block, hydration inside break labels.
- Labels are specific and actionable ("Draft the 3 outreach emails", not "Work").
- Attach taskId when a block maps to a real open task from the state below.
- "why" is max 12 words.
- Leave one "buffer" block for the day going sideways.
- Do not fill every minute. Empty space is deliberate.`,
    `Day: ${weekdayName(key)} ${key}.
Energy today: ${input.energy}/5. Available hours: ${input.availableHours}. Mood: ${input.mood ?? "not stated"}.
Non-negotiable today: ${input.mustDo || "nothing stated — pick from open tasks"}.
${shiftLine}
${weekShape ? `Weekly shape: ${weekShape}` : ""}

${renderSnapshot(snapshot, key)}`
  );

  // The shift is enforced in code — the model does not get to move it.
  // Then the pre/post-shift buffers are added on top, so the hour before service
  // is visibly spoken for instead of quietly planned as free time (4.3).
  const blocks = snapshot.profile.bufferShifts
    ? withShiftBuffers(
        enforceShiftWindow(out.blocks, shift, source),
        shift,
        snapshot.profile.preShiftMins,
        snapshot.profile.postShiftMins
      )
    : enforceShiftWindow(out.blocks, shift, source);

  const plan = await upsertPlan(userId, key, {
    energy: input.energy,
    mood: input.mood ?? null,
    availableHours: input.availableHours,
    focusTheme: out.focusTheme ?? null,
    anchor: out.anchor ?? null,
    blocks,
  });
  return plan;
}

/**
 * How to split a task. The mode exists because "break this down" means something
 * different at 9am with a clear head than it does at 9pm after a double shift.
 */
export type BreakdownMode = "steps" | "low_energy" | "smallest";

const BREAKDOWN_RULES: Record<BreakdownMode, string> = {
  steps: `- 3 to 6 steps. Each is one sitting, max 45 minutes, with every decision already made inside the title.
- No step may start with "plan", "think about" or "research" unless that IS the whole step, with a hard time cap.`,

  // Tired, low dopamine, possibly post-shift. Ceiling per step matters more than
  // covering the whole task: getting 3 easy steps done beats stalling on 6 hard ones.
  low_energy: `- 3 to 5 steps, and EVERY step must be doable while tired and unmotivated.
- Hard ceiling of 15 minutes per step. If a step cannot fit in 15 minutes, split it again.
- No step may require a decision, reading anything long, or talking to anyone.
- Prefer physical, mechanical, obvious actions over anything needing judgement.
- It is fine if these steps do not finish the task. Momentum is the goal.`,

  // One step only. Any list at all reintroduces the choice that caused the stall.
  smallest: `- Return EXACTLY ONE step: the smallest possible physical first action.
- It must take 2 to 5 minutes, maximum. If it is bigger than that, it is wrong.
- It must require zero decisions, zero setup and zero reading.
- Do not return a list. One step, nothing else.`,
};

const MAX_STEPS: Record<BreakdownMode, number> = { steps: 6, low_energy: 5, smallest: 1 };

export async function breakdownTask(userId: string, taskId: string, mode: BreakdownMode = "steps") {
  const task = await prisma.navTask.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error("Task not found");
  const snapshot = await buildSnapshot(userId);

  const out = await json<{ steps: { title: string; effortMins: number; startTrigger: string }[]; firstMove: string }>(
    `${NAVIGATOR_PERSONA}

Return JSON only: { "steps": [{ "title": string, "effortMins": number, "startTrigger": string }], "firstMove": string }
${BREAKDOWN_RULES[mode]}
- Never put a duration in the step title. effortMins carries the time, and it must be your honest estimate of that step, not the ceiling you were given.
- Titles must be distinct and self-explanatory. No "part 1 / part 2" numbering unless the parts are genuinely different work.
- startTrigger is a 2-minute physical action requiring zero decisions.
- firstMove: one sentence telling them exactly what to do in the next 2 minutes.`,
    `Task: ${task.title}
Notes: ${task.notes ?? "none"}
Their estimate: ${task.effortMins ? `${task.effortMins} min` : "none given"}

Context:
${renderSnapshot(snapshot)}`
  );

  const steps = (out.steps ?? []).slice(0, MAX_STEPS[mode]);
  await prisma.$transaction(
    steps.map((s, i) =>
      prisma.navTask.create({
        data: {
          userId,
          parentId: task.id,
          title: s.title,
          effortMins: s.effortMins ?? null,
          startTrigger: s.startTrigger ?? null,
          project: task.project,
          priority: task.priority,
          order: i,
        },
      })
    )
  );
  if (!task.startTrigger && out.firstMove) {
    await prisma.navTask.update({ where: { id: task.id }, data: { startTrigger: out.firstMove } });
  }
  return { steps: steps.length, firstMove: out.firstMove };
}

/**
 * 2.3 Task drafts — triage one captured draft into a real task.
 *
 * The whole point is that the user never has to make the boring decisions
 * (priority / how long / where do I even start). The model fills them in, the
 * draft flips to "todo", and it becomes visible to the list, the planner and the
 * nudges in one move. Idempotent-ish: re-running on a real task just re-triages it.
 */
export async function triageDraft(userId: string, taskId: string) {
  const task = await prisma.navTask.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error("Task not found");
  const snapshot = await buildSnapshot(userId);

  const out = await json<{
    title: string;
    priority: "urgent" | "important" | "quickwin" | "later";
    effortMins: number;
    startTrigger: string;
    project: string | null;
    why: string;
  }>(
    `${NAVIGATOR_PERSONA}

You are triaging ONE raw captured thought into an actionable task. Return JSON only:
{ "title": string, "priority": "urgent"|"important"|"quickwin"|"later", "effortMins": number, "startTrigger": string, "project": string|null, "why": string }
- title: rewrite as a clear action starting with a verb. Keep their words where they already work. Max 90 chars.
- priority: urgent only if there is a real external deadline or a consequence. quickwin if under 10 minutes. Most things are important or later — do not inflate.
- effortMins: honest estimate, inflated ~50% over what an optimist would say.
- startTrigger: the 2-minute first physical action, zero decisions required.
- project: reuse an existing project name from their open tasks if one clearly fits, else null.
- why: one short line on why you set that priority. Max 100 chars.`,
    `Raw capture: ${task.title}
Notes: ${task.notes ?? "none"}

Context:
${renderSnapshot(snapshot)}`,
    600
  );

  const count = await prisma.navTask.count({
    where: { userId, parentId: null, status: { notIn: ["done", "draft"] } },
  });

  const task2 = await prisma.navTask.update({
    where: { id: task.id },
    data: {
      title: (out.title || task.title).slice(0, 300),
      status: "todo",
      priority: out.priority ?? "important",
      effortMins: out.effortMins ?? null,
      startTrigger: out.startTrigger ?? null,
      project: out.project ?? task.project,
      order: count,
    },
  });
  return { task: task2, why: out.why };
}

export async function generateMeals(
  userId: string,
  input: { dateKey?: string; mode: "day" | "week"; maxPrepMins: number }
) {
  const snapshot = await buildSnapshot(userId);
  const key = input.dateKey ?? snapshot.today;

  const out = await json<{
    days: { date: string; meals: { slot: string; title: string; ingredients: string[]; prepMins: number; protein: number }[] }[];
    grocery: { name: string; qty: string; category: string }[];
    shortcut: string;
  }>(
    `${NAVIGATOR_PERSONA}

Return JSON only: { "days": [{ "date": "YYYY-MM-DD", "meals": [{ "slot": "breakfast"|"lunch"|"dinner"|"snack", "title": string, "ingredients": string[], "prepMins": number, "protein": number }] }], "grocery": [{ "name": string, "qty": string, "category": "produce"|"protein"|"dairy"|"pantry"|"frozen"|"other" }], "shortcut": string }
- ADHD-friendly food: max ${input.maxPrepMins} minutes prep, few ingredients, few pans, nothing that needs babysitting.
- Protein at every main meal — it steadies the afternoon crash.
- Repeat ingredients across meals so the shopping list stays tiny.
- Breakfast must be assembly, not cooking.
- "shortcut" is one line: the 3-option decision shortcut for the day, e.g. "Too tired to choose? A, B, or C — pick the first one you don't hate."
- Grocery list must cover exactly what the plan needs, grouped by category, no staples they obviously own.`,
    `${input.mode === "week" ? `Plan 7 days starting ${key}.` : `Plan just ${key}.`}
This person was a chef, so keep it interesting but genuinely low-effort. Do not condescend about cooking skill.

${renderSnapshot(snapshot)}`,
    input.mode === "week" ? 3000 : 1400
  );

  let created = 0;
  for (const day of out.days ?? []) {
    const date = dayFromKey(day.date);
    await prisma.navMeal.deleteMany({ where: { userId, date } });
    for (const m of day.meals ?? []) {
      await prisma.navMeal.create({
        data: {
          userId,
          date,
          slot: m.slot,
          title: m.title,
          ingredients: m.ingredients ?? [],
          prepMins: m.prepMins ?? 10,
          protein: m.protein ?? null,
        },
      });
      created++;
    }
  }
  for (const g of (out.grocery ?? []).slice(0, 40)) {
    await prisma.navGroceryItem.create({
      data: { userId, name: g.name, qty: g.qty ?? null, category: g.category ?? "other" },
    });
  }
  return { created, shortcut: out.shortcut, grocery: (out.grocery ?? []).length };
}

export async function generateWorkouts(
  userId: string,
  input: { dateKey?: string; minutes: number; mood: string; where: string; mode: "single" | "week" }
) {
  const snapshot = await buildSnapshot(userId);
  const key = input.dateKey ?? snapshot.today;

  const out = await json<{
    workouts: { date: string; title: string; kind: string; durationMins: number; intensity: string; steps: string[] }[];
    note: string;
  }>(
    `${NAVIGATOR_PERSONA}

Return JSON only: { "workouts": [{ "date": "YYYY-MM-DD", "title": string, "kind": "strength"|"cardio"|"mobility"|"walk"|"movement", "durationMins": number, "intensity": "easy"|"moderate"|"hard", "steps": string[] }], "note": string }
- Sessions are 5-20 minutes unless the user asks for longer. Achievable beats optimal.
- Bodyweight or minimal kit by default. No gym assumed unless stated.
- steps are the actual exercises with sets/reps or timings, in order, max 6 entries.
- Match intensity to mood: flat mood = walk or mobility, restless = short hard cardio.
- "note" is one line naming the payoff they will actually feel.`,
    `${input.mode === "week" ? `Give a 7-day structure starting ${key} (include 2 rest/mobility days).` : `One session for ${key}.`}
Time available: ${input.minutes} minutes. Mood: ${input.mood}. Setting: ${input.where}.

${renderSnapshot(snapshot)}`,
    input.mode === "week" ? 2200 : 1000
  );

  let created = 0;
  for (const w of out.workouts ?? []) {
    await prisma.navWorkout.create({
      data: {
        userId,
        date: dayFromKey(w.date ?? key),
        title: w.title,
        kind: w.kind ?? "movement",
        durationMins: w.durationMins ?? input.minutes,
        intensity: w.intensity ?? "easy",
        steps: w.steps ?? [],
      },
    });
    created++;
  }
  return { created, note: out.note };
}

export async function weeklyReview(userId: string) {
  const snapshot = await buildSnapshot(userId);
  const focus = await prisma.navFocusSession.findMany({
    where: { userId, startedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
    orderBy: { startedAt: "desc" },
    take: 30,
  });
  const done = await prisma.navTask.findMany({
    where: { userId, status: "done", completedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
    take: 40,
  });

  const out = await json<{
    patterns: string[];
    wins: string[];
    oneChange: string;
    nextWeek: string[];
    encouragement: string;
  }>(
    `${personaFor(snapshot.profile.coachTone)}

Return JSON only: { "patterns": string[], "wins": string[], "oneChange": string, "nextWeek": string[], "encouragement": string }
- patterns: max 4, each one observation tied to actual data below (energy dips, times of day, task types that stall).
- wins: max 4, specific, no participation trophies.
- oneChange: the single highest-leverage change for next week. One sentence.
- nextWeek: max 3 concrete structural commitments (times and blocks, not intentions).
- encouragement: one honest line. No gushing.`,
    `Focus sessions this week: ${focus
      .map((f) => `${f.label} planned ${f.plannedMins}min actual ${f.actualMins ?? "?"}min distractions ${f.distractions}`)
      .join("; ") || "none"}
Tasks completed: ${done.map((d) => d.title).join("; ") || "none"}

${renderSnapshot(snapshot)}`
  );
  return out;
}

export async function motivationNudge(userId: string, situation: string) {
  const snapshot = await buildSnapshot(userId);
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    max_tokens: 220,
    messages: [
      { role: "system", content: personaFor(snapshot.profile.coachTone) },
      {
        role: "system",
        content: `Reply in max 45 words. Structure: one line naming the block honestly, then the exact 2-minute action, then the payoff. No pep-talk clichés.\n\n${renderSnapshot(
          snapshot
        )}`,
      },
      { role: "user", content: situation || "I'm stuck and can't start." },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "Start the 2-minute version. That's all.";
}

export async function decideForMe(userId: string, question: string) {
  const snapshot = await buildSnapshot(userId);
  const out = await json<{ options: string[]; pick: string; because: string; ifStuck: string }>(
    `${NAVIGATOR_PERSONA}

Return JSON only: { "options": string[], "pick": string, "because": string, "ifStuck": string }
- Exactly 3 options, each one short phrase.
- pick: the one you'd choose (must be one of the options).
- because: max 15 words.
- ifStuck: the coin-flip rule if they still can't decide.`,
    `They are stuck deciding: ${question}\n\n${renderSnapshot(snapshot)}`,
    500
  );
  return out;
}
