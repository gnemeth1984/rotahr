/**
 * Quiz papers are carried between the GET that issues them and the POST that
 * grades them by a signed token, not by a scratch table and not by trusting the
 * browser.
 *
 * Why: grading has to happen on the server, so the server needs to know exactly
 * which paper the trainee answered. Sending the questions back up from the
 * client would let anyone post a one-question paper they wrote themselves and
 * walk away with a dated training record. A record an inspector might read has
 * to be worth more than that.
 *
 * The token holds only what is needed to rebuild the paper deterministically:
 * the course slug, the seed, the employee, and the dish ids the paper was built
 * from. buildQuiz() is deterministic for a given seed, so the server rebuilds
 * the identical paper at submit time and grades against that.
 *
 * Signed with NEXTAUTH_SECRET so there is no new environment variable to set in
 * Vercel — one less thing that can be missing in production.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface QuizTicket {
  /** Course slug. */
  s: string;
  /** Seed used to build the paper. */
  d: number;
  /** Employee the paper was issued to. */
  e: string;
  /** Business, so a token cannot be replayed against another tenant. */
  b: string;
  /** Dish ids the paper was built from, in order. */
  m: string[];
  /** Issued at, epoch ms. */
  t: number;
}

/** A paper goes stale after this long. Long enough to read the lessons twice. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export function signTicket(ticket: QuizTicket): string {
  const payload = b64url(Buffer.from(JSON.stringify(ticket), "utf8"));
  return `${payload}.${sign(payload)}`;
}

/** Returns the ticket, or null when the token is missing, forged or stale. */
export function verifyTicket(token: unknown): QuizTicket | null {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const idx = token.lastIndexOf(".");
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  if (!payload || !mac) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let ticket: QuizTicket;
  try {
    ticket = JSON.parse(unb64url(payload).toString("utf8"));
  } catch {
    return null;
  }

  if (
    !ticket ||
    typeof ticket.s !== "string" ||
    typeof ticket.d !== "number" ||
    typeof ticket.e !== "string" ||
    typeof ticket.b !== "string" ||
    !Array.isArray(ticket.m) ||
    typeof ticket.t !== "number"
  ) {
    return null;
  }

  if (Date.now() - ticket.t > MAX_AGE_MS) return null;

  return ticket;
}

/** Seed for a fresh paper. Stable within a minute so a reload keeps the paper. */
export function freshSeed(): number {
  return Math.floor(Date.now() / 60000);
}
