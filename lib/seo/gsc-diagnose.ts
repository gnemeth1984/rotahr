import { gscAccessToken } from "./gsc";

/**
 * Diagnostic for the "permission looks Full but the API returns 403" case.
 *
 * Search Console grants permission per *property*, and a domain property
 * ("sc-domain:rotahr.com") is a different object from a URL-prefix property
 * ("https://rotahr.com/"). The Users screen looks identical either way, so
 * granting Full on one while GSC_SITE_URL names the other produces exactly this
 * symptom: a correct-looking grant and a 403.
 *
 * sites.list answers it directly — it returns every property this service
 * account can actually reach, and its permission level on each. Comparing that
 * against GSC_SITE_URL shows whether the mismatch is the property string, or a
 * different service account entirely.
 */
export type GscDiagnosis = {
  configured: boolean;
  /** The service account the app is actually authenticating as. */
  clientEmail: string | null;
  /** The property string the app is querying. */
  configuredSite: string | null;
  /** Properties the service account can reach, per the API. */
  visibleSites: { siteUrl: string; permissionLevel: string }[];
  /** True when configuredSite appears in visibleSites. */
  siteMatches: boolean;
  tokenOk: boolean;
  error?: string;
  /** Plain-language next action. */
  verdict: string;
};

export async function diagnoseGsc(): Promise<GscDiagnosis> {
  const clientEmail = process.env.GSC_CLIENT_EMAIL ?? null;
  const configuredSite = process.env.GSC_SITE_URL ?? null;
  const configured = Boolean(clientEmail && process.env.GSC_PRIVATE_KEY && configuredSite);

  const base: GscDiagnosis = {
    configured,
    clientEmail,
    configuredSite,
    visibleSites: [],
    siteMatches: false,
    tokenOk: false,
    verdict: "",
  };

  if (!configured) {
    return {
      ...base,
      verdict:
        "GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY or GSC_SITE_URL is missing from the environment.",
    };
  }

  let token: string;
  try {
    token = await gscAccessToken();
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
      verdict:
        "Could not even get an access token, so this is a credentials problem, not a Search Console permission problem. Usually a mangled GSC_PRIVATE_KEY (the newlines must survive as \\n) or a deleted key.",
    };
  }

  let visibleSites: { siteUrl: string; permissionLevel: string }[] = [];
  try {
    const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await res.text();
    if (!res.ok) {
      return {
        ...base,
        tokenOk: true,
        error: `sites.list failed (${res.status}): ${body}`,
        verdict:
          res.status === 403
            ? "The token works but Search Console refuses to list any property. The Search Console API is most likely not enabled on the Google Cloud project that owns this service account."
            : "sites.list failed — see error.",
      };
    }
    const json = JSON.parse(body) as {
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    };
    visibleSites = json.siteEntry ?? [];
  } catch (e) {
    return {
      ...base,
      tokenOk: true,
      error: e instanceof Error ? e.message : String(e),
      verdict: "sites.list threw — see error.",
    };
  }

  const siteMatches = visibleSites.some((s) => s.siteUrl === configuredSite);

  let verdict: string;
  if (siteMatches) {
    const entry = visibleSites.find((s) => s.siteUrl === configuredSite)!;
    verdict = `Correct. This service account has ${entry.permissionLevel} on ${configuredSite}.`;
  } else if (visibleSites.length === 0) {
    verdict =
      `Authentication works, but this service account (${clientEmail}) can reach zero Search Console properties. ` +
      `The Full grant you can see was given to a different account than the one in GSC_CLIENT_EMAIL. Compare the two strings exactly.`;
  } else {
    verdict =
      `Property mismatch. GSC_SITE_URL is "${configuredSite}", but this service account can only reach: ` +
      visibleSites.map((s) => `"${s.siteUrl}" (${s.permissionLevel})`).join(", ") +
      `. Set GSC_SITE_URL to one of those exact strings, or add the service account to the property you meant.`;
  }

  return { ...base, tokenOk: true, visibleSites, siteMatches, verdict };
}
