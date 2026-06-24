import { redirect } from "next/navigation";

// /settings → redirect to /settings/general (account settings — all roles)
export default function SettingsIndexPage() {
  redirect("/settings/general");
}
