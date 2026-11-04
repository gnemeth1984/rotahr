/**
 * Links every Lead Intelligence email carries: the live demo (no sign-up) and
 * the tutorial videos. Pure module, safe to import from client components so
 * the composer can prefill the same text the server enforces.
 */
export type LeadEmailKind = "cold" | "followup";

const BASE = "https://rotahr.com";

export function demoUrl(kind: LeadEmailKind): string {
  return `${BASE}/try?utm_source=lead-intelligence&utm_medium=email&utm_campaign=${kind}`;
}

export function tutorialsUrl(kind: LeadEmailKind): string {
  return `${BASE}/tutorials?utm_source=lead-intelligence&utm_medium=email&utm_campaign=${kind}`;
}

export function linksBlock(kind: LeadEmailKind): string {
  return `See it working first, no sign-up needed (live demo account): ${demoUrl(kind)}\nShort how-to videos: ${tutorialsUrl(kind)}`;
}

/** True when the body already links to the demo or the tutorials. */
export function hasRotahrLink(body: string): boolean {
  return /rotahr\.com\/(try|demo|tutorials)\b/i.test(body);
}

/**
 * Insert the links block just above the sign-off ("Kind regards", "Best",
 * "Thanks", ...) so it reads as part of the message, or append it when there
 * is no recognisable sign-off. A body that already links to the demo or the
 * tutorials is returned unchanged.
 */
export function withLinks(body: string, kind: LeadEmailKind): string {
  const text = body.replace(/\r\n/g, "\n").trimEnd();
  if (hasRotahrLink(text)) return text;
  const block = linksBlock(kind);
  const signOff = /\n\n((?:kind regards|best regards|regards|best|thanks|thank you|cheers|all the best)[,!.]?\s*\n)/i;
  const m = signOff.exec(text);
  if (m) return `${text.slice(0, m.index)}\n\n${block}${text.slice(m.index)}`;
  return `${text}\n\n${block}`;
}
