import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { Barlow } from "next/font/google";
import { NavigatorClient } from "./NavigatorClient";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = { title: "Navigator | Rotahr" };

export default async function NavigatorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");
  if (!isSuperAdminEmail(session.user.email)) redirect("/dashboard");

  return (
    <div
      className={`${barlow.className} -mx-4 -mb-8 -mt-16 min-h-screen sm:-mx-6 lg:-mx-8 lg:-mt-8`}
      style={{ background: "linear-gradient(180deg,#0f1c35 0%,#0a1428 100%)" }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pt-8">
        <NavigatorClient firstName={(session.user.name ?? "").split(" ")[0] || "there"} />
      </div>
    </div>
  );
}
