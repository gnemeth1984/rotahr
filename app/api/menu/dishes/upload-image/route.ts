// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { UserRole as Role } from "@/types/roles";
import { put } from "@vercel/blob";

export const maxDuration = 30;

function canEdit(role: string, permissions: string[]) {
  return (
    role === Role.ADMIN ||
    role === Role.MANAGER ||
    permissions.includes("menu_planning")
  );
}

// POST /api/menu/dishes/upload-image — upload a photo of the finished dish
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
    }

    const blob = await put(
      `dish-photos/${session.user.businessId}/${Date.now()}-${file.name}`,
      file,
      { access: "public" }
    );

    return NextResponse.json({ url: blob.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
