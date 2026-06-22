import { redirect } from "next/navigation";

// /settings → redirect to /settings/venues (first settings section)
export default function SettingsIndexPage() {
  redirect("/settings/venues");
}
