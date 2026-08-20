"use client";

/**
 * Navigator is the tool that tells Gabor what to do next, so a render bug here
 * costs a whole day. Next.js otherwise replaces the page with the generic
 * "Application error: a client-side exception has occurred", which says nothing
 * and offers nothing. This keeps the error readable and the page recoverable.
 */
export default function NavigatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="-mx-4 -mb-8 -mt-16 min-h-screen sm:-mx-6 lg:-mx-8 lg:-mt-8"
      style={{ background: "linear-gradient(180deg,#0f1c35 0%,#0a1428 100%)" }}
    >
      <div className="mx-auto max-w-2xl px-4 pb-14 pt-24 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Navigator hit an error</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your data is fine — this is the page failing to draw it. Reload usually clears it.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-200">
          {error.message || "Unknown error"}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex gap-2">
          <button
            onClick={reset}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#e8365d] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <a
            href="/navigator"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Reload page
          </a>
        </div>
      </div>
    </div>
  );
}
