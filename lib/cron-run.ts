
/**
 * Every cron reports its outcome here.
 *
 * `SeoRun` already proved why this is needed: in one week it recorded 5 failed
 * blog refreshes and a failed publish, and nobody ever saw them, because
 * nothing read the table. A scheduled job that fails silently is worse than one
 * that does not exist — you believe the work is happening.
 *
 * This generalises that to all jobs so Navigator can say "3 crons failed
 * overnight" instead of nothing at all.
 *
 * Like activity logging, this must never break the job it is reporting on.
 */
export async function recordCronRun(
  job: string,
  ok: boolean,
  detail?: string,
  durationMs?: number
): Promise<void> {
  try {
    // Imported lazily. `navigator-nudge` deliberately returns before touching
    // Prisma during quiet hours so Neon compute stays suspended — a top-level
    // import here would have woken the database every 5 minutes to record a
    // row saying nothing happened.
    const { prisma } = await import("@/lib/db");
    await prisma.cronRun.create({
      data: { job, ok, detail: detail ? detail.slice(0, 2000) : null, durationMs: durationMs ?? null },
    });
  } catch (err) {
    console.error("[cron-run] failed to record outcome for", job, err);
  }
}

/**
 * Wraps a cron handler so success and failure are both recorded without every
 * route needing its own try/finally. Re-throws — reporting is not handling.
 */
export async function withCronRun<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    await recordCronRun(job, true, summarise(out), Date.now() - started);
    return out;
  } catch (err) {
    await recordCronRun(job, false, err instanceof Error ? err.message : String(err), Date.now() - started);
    throw err;
  }
}

function summarise(out: unknown): string | undefined {
  if (out == null) return undefined;
  if (typeof out === "string") return out.slice(0, 500);
  try {
    return JSON.stringify(out).slice(0, 500);
  } catch {
    return undefined;
  }
}

/**
 * Wraps a route handler so every scheduled invocation lands in `CronRun`.
 *
 * Crons here mostly fail by returning a 500 rather than throwing, so a plain
 * try/catch would have recorded a clean run for a broken job. Status is the
 * source of truth; a throw is just the loud version of the same thing.
 */
export function wrapCron<A extends unknown[]>(
  job: string,
  handler: (...args: A) => Promise<Response>,
  opts?: { skipWhen?: (status: number, body: string) => boolean }
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const started = Date.now();
    try {
      const res = await handler(...args);
      let detail = "";
      try {
        detail = (await res.clone().text()).slice(0, 500);
      } catch {
        detail = "";
      }
      if (opts?.skipWhen?.(res.status, detail)) return res;
      await recordCronRun(job, res.status < 400, `${res.status} ${detail}`.trim(), Date.now() - started);
      return res;
    } catch (err) {
      await recordCronRun(job, false, err instanceof Error ? err.message : String(err), Date.now() - started);
      throw err;
    }
  };
}
