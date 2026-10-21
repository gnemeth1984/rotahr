import { createHash, randomBytes } from "crypto";

/** Prefix makes leaked secrets greppable / recognisable by secret scanners. */
const PREFIX = "rhwh_";

export function generateWebhookSecret(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
