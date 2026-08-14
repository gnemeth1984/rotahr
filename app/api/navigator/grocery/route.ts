import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const categories = ["produce", "protein", "dairy", "pantry", "frozen", "other"] as const;

const postSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        qty: z.string().max(60).nullish(),
        category: z.enum(categories).default("other"),
      })
    )
    .min(1)
    .max(60),
});

const patchSchema = z.object({ id: z.string(), checked: z.boolean() });

export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const items = await prisma.navGroceryItem.findMany({
    where: { userId },
    orderBy: [{ checked: "asc" }, { category: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await prisma.navGroceryItem.createMany({
    data: parsed.data.items.map((i) => ({
      userId,
      name: i.name,
      qty: i.qty ?? null,
      category: i.category,
    })),
  });
  const items = await prisma.navGroceryItem.findMany({
    where: { userId },
    orderBy: [{ checked: "asc" }, { category: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(items, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const r = await prisma.navGroceryItem.updateMany({
    where: { id: parsed.data.id, userId },
    data: { checked: parsed.data.checked },
  });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE ?id=xxx  or  ?checked=1 to clear everything already ticked off
export async function DELETE(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    await prisma.navGroceryItem.deleteMany({ where: { id, userId } });
  } else if (url.searchParams.get("checked") === "1") {
    await prisma.navGroceryItem.deleteMany({ where: { userId, checked: true } });
  } else {
    await prisma.navGroceryItem.deleteMany({ where: { userId } });
  }
  return NextResponse.json({ ok: true });
}
