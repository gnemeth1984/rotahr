import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { LeadIntelligenceDetail } from "@/components/admin/lead-intelligence-detail";

export const metadata = { title: "Lead Intelligence | Rotahr" };
export const dynamic = "force-dynamic";

export default async function LeadIntelligenceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");
  if (!isSuperAdminEmail(session.user.email)) redirect("/dashboard");
  return <LeadIntelligenceDetail id={params.id} />;
}
