import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { dayFromKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(4000).nullish(),
  project: z.string().max(120).nullish(),
  parentId: z.string().nullish(),
  priority: z.enum(["urgent", "important", "quickwin", "later"]).default("important"),
  // Quick capture: title only, no decisions. Everything else gets filled at triage.
  status: z.enum(["draft", "todo"]).default("todo"),
  effortMins: z.number().int().min(1).max(1440).nullish(),
  startTrigger: z.string().max(500).nullish(),
  dueDate: z.string().nullish(),
  scheduledFor: dateKey.nullish(),
});

export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const sp = new URL(req.url).searchParams;
  const includeDone = sp.get("done") === "1";
  // ?drafts=1 returns ONLY the un-triaged inbox. Otherwise drafts are hidden,
  // so no existing caller starts seeing them by accident.
  const draftsOnly = sp.get("drafts") === "1";

  const statusWhere = draftsOnly
    ? { status: "draft" }
    : { status: includeDone ? { not: "draft" } : { notIn: ["done", "draft"] } };

  const tasks = await prisma.navTask.findMany({
    where: { userId, ...statusWhere },
    orderBy: draftsOnly ? [{ createdAt: "desc" }] : [{ order: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const count = await prisma.navTask.count({ where: { userId, parentId: d.parentId ?? null } });
  const task = await prisma.navTask.create({
    data: {
      userId,
      title: d.title,
      notes: d.notes ?? null,
      project: d.project ?? null,
      parentId: d.parentId ?? null,
      priority: d.priority,
      status: d.status,
      effortMins: d.effortMins ?? null,
      startTrigger: d.startTrigger ?? null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      scheduledFor: d.scheduledFor ? dayFromKey(d.scheduledFor) : null,
      order: count,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
