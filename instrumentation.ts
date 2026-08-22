/**
 * TEMPORARY DIAGNOSTIC — remove once the (app) SSR 500 is fixed.
 *
 * Every signed-in page under app/(app)/ returns HTTP 500 on the HTML document
 * in production while the identical commit SSRs fine under a local `next start`.
 * The client recovers and re-renders, so users see the app, but there is no
 * server-rendered HTML and every signed-in page reports 500.
 *
 * Vercel runtime logs are not reachable with the API token we hold, so the
 * error text is captured here instead: console.error is wrapped and anything
 * that looks like an error is written to ActivityLog under a known action name,
 * which we can then read straight out of Neon.
 *
 * Node runtime only (the edge middleware has no Prisma), guarded against
 * re-entry so a failure inside the hook cannot recurse.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __ssrProbeInstalled?: boolean };
  if (g.__ssrProbeInstalled) return;
  g.__ssrProbeInstalled = true;

  const original = console.error.bind(console);
  let inside = false;

  console.error = (...args: unknown[]) => {
    original(...args);

    if (inside) return;
    inside = true;
    try {
      const text = args
        .map((a) => {
          if (a instanceof Error) {
            return `${a.name}: ${a.message}\n${a.stack ?? "(no stack)"}`;
          }
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" | ")
        .slice(0, 8000);

      // Fire and forget. A failed write must never turn a logged error into a
      // second, louder error.
      import("./lib/db")
        .then(({ prisma }) =>
          prisma.activityLog.create({
            data: {
              action: "ssr_error_probe",
              userName: "instrumentation",
              details: { text },
            },
          })
        )
        .catch(() => {});
    } catch {
      // ignore
    } finally {
      inside = false;
    }
  };
}
