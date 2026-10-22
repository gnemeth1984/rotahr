/**
 * The Copilot's tables (StockPriceChange, OpsBrief, CopilotSettings) are new.
 * Code can reach an environment before its migration does; in that window the
 * Copilot degrades (no cache, no price history, default thresholds) instead of
 * failing. P2021 = table does not exist, P2022 = column does not exist.
 */
export function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2021" || code === "P2022") return true;
  const msg = String((err as Error | null)?.message ?? "");
  return /relation .* does not exist|table .* does not exist/i.test(msg);
}
