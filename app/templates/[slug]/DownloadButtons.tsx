"use client";

/**
 * Download buttons. The file links are plain <a download> so they work with JS
 * off and get served straight off the CDN; the click just fires a
 * keepalive beacon so we can see which templates actually get used.
 */
export default function DownloadButtons({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  function track(format: "pdf" | "xlsx" | "csv") {
    try {
      fetch("/api/templates/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, format }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // never block the download
    }
  }

  return (
    <div className="mb-10">
      <div className="flex flex-wrap gap-3">
        <a
          href={`/templates/${slug}.pdf`}
          download
          onClick={() => track("pdf")}
          className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-5 py-3 font-semibold text-white"
        >
          Download PDF
        </a>
        <a
          href={`/templates/${slug}.xlsx`}
          download
          onClick={() => track("xlsx")}
          className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:border-white/50"
        >
          Download Excel
        </a>
        <a
          href={`/templates/${slug}.csv`}
          download
          onClick={() => track("csv")}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-white/35 hover:text-white"
        >
          CSV
        </a>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Free. No email address, no sign-up — the {name.toLowerCase()} downloads
        straight away.
      </p>
    </div>
  );
}
