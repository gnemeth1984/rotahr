import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/rota");
  } else {
    redirect("/auth/signin");
  }
}
