/**
 * "Ask the Copilot" — routes a question to the relevant agents by keyword,
 * answers from their findings deterministically, and (optionally) lets the LLM
 * phrase the answer over the sealed payload only.
 */
import type { AgentKey, AgentResult, CopilotScope, Finding } from "./types";
import { SEVERITY_RANK } from "./types";
import { AGENT_KEYS, buildTonight, runAll, tonightFacts } from "./copilot";
import { loadReservations } from "./data";
import { makeScrubber, nameTerms, subjectNames, toPromptPayload } from "./redact";
import { llmAnswer } from "./llm";

const INTENTS: [AgentKey, RegExp][] = [
  ["noshow", /no[\s-]?shows?|(didn'?t|don'?t|won'?t|not|never) (turn(ed)? up|show(ed)?( up)?)|confirm(ation)?s?|deposits?|reconfirm|risk(y)? bookings?/i],
  ["compliance", /haccp|fridge|freezer|temp(erature)?s?|checks?|cert(ificate|ification)?s?|training|rest (gap|period)|working time|allergen matrix|inspect(or|ion)|compliance|food safety|tasks?|overdue/i],
  ["margin", /margins?|\bgp\b|gross profit|price rises?|prices?|pricing|costs?|costing|menu price|profit|supplier|invoice|dish(es)? (losing|making)/i],
  ["waste", /wast(e|age|ed|ing)|binned|bin|spoil|expir|over[\s-]?(order|prep)|reorder|low stock|run(ning)? out|stock/i],
  ["bookings", /busy|busier|quiet|covers?|forecast|staff(ing|ed)?|rota|short[\s-]?staffed|over[\s-]?staffed|tonight|tomorrow|weekend|this week|bookings?|reservations?|walk[\s-]?ins?|peak/i],
];

export function routeQuestion(q: string): AgentKey[] {
  const hits = INTENTS.filter(([, re]) => re.test(q)).map(([k]) => k);
  // "bookings" is a broad word; if a sharper intent also matched, keep both.
  return hits.length ? hits : AGENT_KEYS;
}

export interface AskAnswer {
  question: string;
  agents: AgentKey[];
  answer: string;
  source: "rules" | "llm";
  findings: (Finding & { agent: AgentKey })[];
  results: AgentResult[];
}

const wantsTonight = (q: string) => /tonight|today|this evening|service/i.test(q);

export function rulesAnswer(results: AgentResult[], tonightLine: string | null): string {
  const lines: string[] = [];
  if (tonightLine) lines.push(tonightLine);
  for (const r of results) {
    lines.push(`${r.label}: ${r.headline}`);
    const top = [...r.findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, 3);
    for (const f of top) lines.push(`• ${f.title}`);
  }
  return lines.join("\n");
}

export async function ask(scope: CopilotScope, rawQuestion: string, opts: { useLlm?: boolean } = {}): Promise<AskAnswer> {
  const question = rawQuestion.trim().slice(0, 500);
  const keys = routeQuestion(question);
  const [results, tonight] = await Promise.all([runAll(scope, keys), wantsTonight(question) ? buildTonight(scope) : Promise.resolve(null)]);
  const tonightLine = tonight
    ? `Tonight: ${tonight.covers} covers across ${tonight.bookings} bookings${tonight.allergyTables ? `, ${tonight.allergyTables} with allergies` : ""}${tonight.occasions ? `, ${tonight.occasions} occasions` : ""}.`
    : null;

  let answer = rulesAnswer(results, tonightLine);
  let source: AskAnswer["source"] = "rules";
  if (opts.useLlm !== false) {
    try {
      const guests = (await loadReservations(scope)).map((r) => r.customerName);
      const payload = toPromptPayload({
        businessName: scope.businessName,
        venueName: scope.venueName,
        date: scope.date,
        results,
        tonight: tonight ? tonightFacts(tonight) : undefined,
        extraNames: guests,
      });
      // The manager may type a guest's name or number into the question.
      const cleanQ = makeScrubber(nameTerms([...subjectNames(results), ...guests]))(question, 500);
      const llm = await llmAnswer(cleanQ, payload);
      if (llm) {
        answer = llm;
        source = "llm";
      }
    } catch (err) {
      console.warn("[copilot] ask prompt withheld:", (err as Error)?.message ?? err);
    }
  }

  const findings = results
    .flatMap((r) => r.findings.map((f) => ({ ...f, agent: r.agent })))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 10);
  return { question, agents: keys, answer, source, findings, results };
}
