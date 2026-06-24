import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { Role } from "@/types/roles";
import { OutreachDashboard } from "./OutreachDashboard";

export const metadata = { title: "Email Outreach | Rotahr" };

export default async function OutreachPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");
  if (session.user.role !== Role.ADMIN) redirect("/dashboard");

  return <OutreachDashboard />;
}
