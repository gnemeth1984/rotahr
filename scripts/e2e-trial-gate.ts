/**
 * End-to-end proof of the read-only gate against a live deployment.
 *
 * Creates a throwaway business whose trial expired yesterday, signs in as a
 * real user with a real session cookie, and asserts the gate behaves. Deletes
 * everything it made, always.
 *
 *   BASE=https://rotahr.com bun run scripts/e2e-trial-gate.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "https://rotahr.com";
const prisma = new PrismaClient();

const stamp = Date.now();
const EMAIL = `zz-trialgate-${stamp}@rotahr.test`;
const PASSWORD = `Tg!${stamp}aA`;

let pass = 0;
let fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (want ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}

const cookies = new Map<string, string>();
function jar() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function absorb(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { ...(init.headers ?? {}), cookie: jar() },
  });
  absorb(res);
  return res;
}

let businessId: string | null = null;
let userId: string | null = null;

async function cleanup() {
  try {
    if (businessId) {
      await prisma.employee.deleteMany({ where: { businessId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (businessId) {
      await prisma.venue.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
    }
    console.log("\ncleanup: removed test tenant");
  } catch (e) {
    console.error("cleanup FAILED — remove manually:", businessId, userId, e);
  }
}

(async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const biz = await prisma.business.create({
    data: {
      name: `zz-trialgate-${stamp}`,
      onboardingComplete: true,
      lsStatus: "none",
      lsPlan: "none",
      trialEndsAt: yesterday, // expired
    },
  });
  businessId = biz.id;
  await prisma.venue.create({
    data: { businessId: biz.id, name: "test", isDefault: true, timezone: "Europe/Dublin" },
  });
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Trial Gate Test",
      password: await bcrypt.hash(PASSWORD, 12),
      role: "MANAGER",
      businessId: biz.id,
    },
  });
  userId = user.id;
  await prisma.employee.create({
    data: {
      businessId: biz.id,
      userId: user.id,
      firstName: "Trial",
      lastName: "Gate",
      email: EMAIL,
      role: "manager",
    },
  });
  console.log(`created expired-trial tenant ${biz.id}\n`);

  // --- sign in ---
  const csrfRes = await req("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const login = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
  });
  const sess = await (await req("/api/auth/session")).json();
  check("signed in with a real session", Boolean(sess?.user?.email), true);
  if (!sess?.user?.email) {
    console.log("login status:", login.status, "— cannot continue");
    return;
  }
  console.log(
    `  session claims: lsStatus=${sess.user.lsStatus} trialEndsAt=${sess.user.trialEndsAt}\n`,
  );

  console.log("--- writes must be blocked (402) ---");
  for (const p of ["/api/bookings/create", "/api/expenses/create", "/api/shifts/create"]) {
    const r = await req(p, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    check(`POST ${p}`, r.status, 402);
  }

  const body = await (
    await req("/api/bookings/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
  ).json();
  check("402 body identifies itself", body.error, "read_only");
  check("402 body points at billing", body.billingUrl, "/settings/billing");

  console.log("\n--- reads and exports must still work ---");
  for (const p of ["/api/bookings/list", "/api/shifts/list", "/api/expenses/list"]) {
    const r = await req(p);
    check(`GET ${p} is not blocked`, r.status === 402, false);
  }

  console.log("\n--- the two things that must never break ---");
  const out = await req("/api/clock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "out" }),
  });
  check("clock OUT is never blocked", out.status === 402, false);

  const cin = await req("/api/clock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "in" }),
  });
  check("clock IN is blocked (it is new work)", cin.status, 402);

  const bill = await req("/api/billing/subscription");
  check("billing stays reachable", bill.status === 402, false);

  // --- now make them pay, and prove the gate lifts ---
  console.log("\n--- after paying, access returns ---");
  await prisma.business.update({
    where: { id: businessId! },
    data: { lsStatus: "active", lsPlan: "pro" },
  });
  await req("/api/auth/session?update=1"); // force jwt callback to re-read
  const after = await req("/api/bookings/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  check("write no longer 402 once subscribed", after.status === 402, false);

  console.log(`\n${pass} passed, ${fail} failed`);
})()
  .catch((e) => {
    console.error(e);
    fail++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
