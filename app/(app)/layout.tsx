import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { HelpAssistant } from "@/components/shared/help-assistant";
import { InstallBanner } from "@/components/shared/InstallBanner";
import { OnboardingBanner } from "@/components/shared/OnboardingBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:pl-64">
        <OnboardingBanner />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
      <HelpAssistant />
      <InstallBanner />
    </div>
  );
}
