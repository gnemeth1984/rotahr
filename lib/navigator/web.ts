/**
 * Navigator web lookup.
 *
 * Read-only. Navigator can look something up on the live web and answer with
 * sources, instead of guessing from training data that is months stale.
 *
 * Why the Responses API and not a search engine:
 *   - No new credentials. OPENAI_API_KEY is already in Vercel, so this shipped
 *     without Gabor touching a console.
 *   - Scraping DuckDuckGo/Bing HTML from Vercel's datacenter IPs gets rate
 *     limited and captcha'd, and the markup changes without notice.
 *   - The hosted web_search tool hands back url_citation annotations, so every
 *     claim can carry a real link. An unsourced answer from a search tool is
 *     worse than no search tool.
 *
 * Deliberately raw fetch rather than the openai SDK: the SDK's tool typings
 * lag the API's accepted tool names, and this way the timeout is ours.
 */

const SEARCH_MODEL = "gpt-4o-mini";

export type WebSource = { title: string; url: string };
export type WebLookupResult = {
  answer: string;
  sources: WebSource[];
  /** Set when the lookup could not be completed. answer is then a plain reason. */
  failed?: boolean;
};

/** OpenAI appends ?utm_source=openai to every citation. Strip it — the links
 *  get shown to a human and pasted elsewhere. */
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("utm_source");
    return u.toString();
  } catch {
    return raw;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Look something up on the live web.
 *
 * @param query      What to find out, as a plain question.
 * @param opts.depth "low" is one or two results and is the default — Navigator
 *                   chat runs inside a 60s route, so this stays snappy.
 *                   "medium" reads more widely for a real research question.
 * @param opts.timeoutMs Hard ceiling. Chat has a 3-round tool loop, so a slow
 *                   lookup can't be allowed to eat the whole request budget.
 */
export async function webLookup(
  query: string,
  opts: { depth?: "low" | "medium"; timeoutMs?: number } = {}
): Promise<WebLookupResult> {
  const q = query.trim();
  if (!q) return { answer: "No query given.", sources: [], failed: true };
  if (!process.env.OPENAI_API_KEY) {
    return { answer: "Web lookup is not configured (no API key).", sources: [], failed: true };
  }

  const depth = opts.depth === "medium" ? "medium" : "low";
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 28_000, 5_000), 45_000);

  // Dublin-anchored: almost everything he looks up (wage rates, suppliers,
  // opening hours, competitor pricing) is Irish, and an unlocated search
  // quietly returns US answers.
  const body = {
    model: SEARCH_MODEL,
    tools: [
      {
        type: "web_search",
        search_context_size: depth,
        // Fields sit flat on user_location — nesting them under an
        // "approximate" object is rejected with "Unknown parameter".
        user_location: {
          type: "approximate",
          country: "IE",
          city: "Dublin",
          region: "Dublin",
          timezone: "Europe/Dublin",
        },
      },
    ],
    tool_choice: "required",
    max_output_tokens: 700,
    instructions:
      "Answer the question from live web results. Be brief and concrete: facts, figures, dates, names. " +
      "Under 120 words unless the question needs a short list. State the figure or fact first. " +
      "If sources disagree or the answer is time-sensitive, say so in one clause and give the most recent. " +
      "If you cannot find it, say plainly that you could not find it — never fill the gap from memory.",
    input: q,
  };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      answer: timedOut
        ? "The web lookup took too long and was cancelled."
        : `Web lookup failed: ${e instanceof Error ? e.message : "network error"}`,
      sources: [],
      failed: true,
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.error?.message) msg = String(parsed.error.message);
    } catch {
      /* keep the status */
    }
    return { answer: `Web lookup failed: ${msg}`, sources: [], failed: true };
  }

  const data = (await res.json().catch(() => null)) as any;
  if (!data) return { answer: "Web lookup returned nothing readable.", sources: [], failed: true };

  // Walk output[].content[] — the shape is a list of items (web_search_call,
  // then message) and only the message carries text and annotations.
  const parts: string[] = [];
  const sources: WebSource[] = [];
  const seen = new Set<string>();

  for (const item of Array.isArray(data.output) ? data.output : []) {
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (typeof c?.text === "string" && c.text.trim()) parts.push(c.text.trim());
      for (const a of Array.isArray(c?.annotations) ? c.annotations : []) {
        if (a?.type !== "url_citation" || typeof a.url !== "string") continue;
        const url = cleanUrl(a.url);
        if (seen.has(url)) continue;
        seen.add(url);
        sources.push({ title: String(a.title || hostOf(url)).slice(0, 160), url });
      }
    }
  }

  let answer = parts.join("\n\n").trim();
  if (!answer) {
    return { answer: "The web search came back empty. Nothing found.", sources, failed: true };
  }

  // The model inlines "([host](url))" markdown after each claim. Strip it —
  // sources are returned as a structured list, and duplicating them inline
  // wrecks a 120-word answer and reads badly when spoken aloud by VoiceButton.
  answer = answer
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "")
    .replace(/\s*\[([^\]]*)\]\((https?:[^)]*)\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return { answer, sources: sources.slice(0, 6) };
}

/** One-line-per-source rendering, for prompts and tool results. */
export function renderSources(sources: WebSource[]): string {
  if (!sources.length) return "";
  return sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n");
}
