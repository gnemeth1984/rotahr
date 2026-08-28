import { redirect } from "next/navigation";

/**
 * The equipment register moved into the Log Book as a third tab, so this route
 * only exists to keep old bookmarks, notification links and the weekly digest
 * email working. Everything real lives in ../log-book/EquipmentTab.tsx.
 */
export default function AssetsRedirect() {
  redirect("/log-book?tab=equipment");
}
