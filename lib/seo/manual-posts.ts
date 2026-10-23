/**
 * Blog posts rewritten by hand carry this tag. The autopilot's refresh and
 * thicken passes skip them, so a careful rewrite is not overwritten by a
 * gpt-4o-mini pass a few weeks later.
 */
export const MANUAL_TAG = "manual";

export function isManualPost(tags: string | null | undefined): boolean {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .includes(MANUAL_TAG);
}

export function withManualTag(tags: string): string {
  return isManualPost(tags) ? tags : [tags, MANUAL_TAG].filter(Boolean).join(",");
}
