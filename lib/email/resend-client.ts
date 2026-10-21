import { Resend } from "resend";
import { lazyClient } from "@/lib/lazy-client";

/**
 * Resend client constructed on first use, so `next build` works without
 * RESEND_API_KEY (`new Resend(undefined)` throws). See lib/lazy-client.ts.
 */
export function lazyResend(): Resend {
  return lazyClient(() => new Resend(process.env.RESEND_API_KEY));
}
