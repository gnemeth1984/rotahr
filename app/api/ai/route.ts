// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { generateBookingResponse } from "@/lib/ai/assistant";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(1000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = messageSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const response = await generateBookingResponse(result.data.message, {
    userId: session.user.id,
    userName: session.user.name ?? "Team Member",
    userEmail: session.user.email ?? "",
  });

  return NextResponse.json({ response });
}
