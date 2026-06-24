// ─── Rotahr Email Marketing Integration ──────────────────────────────────────
// Sends webhook calls to the Rotahr Email System for automated sequences.
// All calls are fire-and-forget — never block auth or user flows.

const EMAIL_SYSTEM_URL = process.env.EMAIL_SYSTEM_URL || "http://localhost:3099";

interface WelcomePayload {
  first_name?: string;
  email: string;
  business_name?: string;
  business_type?: string;
  city?: string;
}

/**
 * Trigger welcome email sequence for a new signup.
 * Call this after a new user is created or completes onboarding.
 */
export async function triggerWelcomeEmail(payload: WelcomePayload): Promise<void> {
  try {
    await fetch(`${EMAIL_SYSTEM_URL}/webhook/new-signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail — never block the user flow
  }
}

/**
 * Mark a lead as converted (e.g. on paid subscription activation).
 */
export async function triggerLeadConverted(email: string): Promise<void> {
  try {
    await fetch(`${EMAIL_SYSTEM_URL}/leads/mark-converted/${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail
  }
}
