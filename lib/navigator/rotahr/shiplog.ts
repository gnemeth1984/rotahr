import { prisma } from "@/lib/db";

/**
 * "What have I actually shipped lately?" — answered without a Vercel API token.
 *
 * Vercel injects the git metadata of the running deployment into the function
 * environment at build time, so every cron tick knows exactly which commit it
 * is running. Recording that (idempotently, keyed on the sha) turns the cron
 * schedule into a ship log for free: every deployment that lives long enough to
 * serve one request gets exactly one row.
 *
 * The alternative was calling the Vercel REST API on a schedule, which means
 * putting a deploy-scoped token in the runtime environment of a customer-facing
 * app to answer a vanity question. Not worth it.
 */
export async function recordCurrentDeploy(userId: string): Promise<boolean> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) return false; // local dev, or self-hosted — nothing to record.

  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || "(no commit message)";
  const url = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

  try {
    await prisma.navShipLog.upsert({
      where: { userId_kind_sha: { userId, kind: "deploy", sha } },
      create: {
        userId,
        kind: "deploy",
        sha,
        message: message.slice(0, 500),
        // A cron running inside it is the strongest possible evidence it built.
        status: "READY",
        url,
      },
      update: {},
    });
    return true;
  } catch (err) {
    console.error("[navigator/shiplog] failed to record deploy", err);
    return false;
  }
}
