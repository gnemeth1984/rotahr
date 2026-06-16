import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { detectConflicts } from "@/lib/ai/conflict-detection";
import { z } from "zod";

const CheckConflictsSchema = z.object({
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1),
  tableId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CheckConflictsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const { date, time, partySize, tableId } = parsed.data;
  const [hours, minutes] = time.split(":").map(Number);
  const proposedDate = new Date(date);
  proposedDate.setHours(hours, minutes, 0, 0);

  try {
    const result = await detectConflicts({ businessId, proposedDate, partySize, tableId });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ai/check-conflicts]", err);
    return NextResponse.json({ error: "Conflict check failed" }, { status: 500 });
  }
}
