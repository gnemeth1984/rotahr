import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { OutreachDashboard } from "./OutreachDashboard";

export const metadata = { title: "Email Outreach | Rotahr" };

export default async function OutreachPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");
  if (!isSuperAdminEmail(session.user.email)) redirect("/dashboard");

  return <OutreachDashboard />;
}
