// @ts-nocheck
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    redirect("/dashboard")
  }
  redirect("/landing")
}
