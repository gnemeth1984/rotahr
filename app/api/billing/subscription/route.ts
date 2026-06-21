import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { business: true },
  })

  const biz = user?.business
  return NextResponse.json({
    plan: biz?.lsPlan ?? "none",
    status: biz?.lsStatus ?? "none",
    renewsAt: biz?.lsRenewsAt ?? null,
    endsAt: biz?.lsEndsAt ?? null,
  })
}
