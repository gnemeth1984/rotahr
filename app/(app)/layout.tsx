import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { HelpAssistant } from "@/components/shared/help-assistant";
import { InstallBanner } from "@/components/shared/InstallBanner";
import { OnboardingBanner } from "@/components/shared/OnboardingBanner";
import { TrialBanner } from "@/components/shared/TrialBanner";
import { CurrencyProvider } from "@/components/shared/CurrencyProvider";
import { FeatureFlagsProvider } from "@/components/shared/FeatureFlagsProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }

  // Demo visitors are looking around, not installing anything. The install nag
  // fires 3s after landing and covers the revenue chart on the dashboard and the
  // middle of the shift list on a phone — the first thing a visitor touches is a
  // dismiss button. Real signed-up accounts still get it.
  const isDemoAccount = (session.user?.email ?? "").endsWith("@rotahr.demo");

  return (
    <CurrencyProvider>
      <FeatureFlagsProvider>
        <div className="min-h-screen bg-slate-50">
          <Sidebar />
          <main className="lg:pl-64">
            <TrialBanner />
            <OnboardingBanner />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-8">
              {children}
            </div>
          </main>
          <HelpAssistant />
          {!isDemoAccount && <InstallBanner />}
        </div>
      </FeatureFlagsProvider>
    </CurrencyProvider>
  );
}
