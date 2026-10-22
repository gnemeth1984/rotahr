/**
 * Optional LLM wording for the Copilot. Only ever receives a sealed
 * PromptPayload (lib/copilot/redact.ts). Every failure — no key, network
 * error, timeout, empty answer — returns null and the caller keeps the
 * deterministic text. The model is never asked to decide anything; the agents
 * already did.
 */
import OpenAI from "openai";
import { lazyClient } from "@/lib/lazy-client";
import type { PromptPayload } from "./redact";

const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 12_000;

const openai = lazyClient(() => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 }));

export function llmAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.COPILOT_LLM !== "off";
}

const SYSTEM = [
  "You are the Manager Copilot inside RotaHR, a restaurant operations app.",
  "You are given the output of deterministic checks (compliance, margin, waste, booking forecast, no-shows) as JSON.",
  "Use ONLY facts in the JSON. Never invent numbers, names, dishes or dates. If something is not in the JSON, say you don't have it.",
  "Guest and staff names are deliberately withheld and appear as [name]; never guess them.",
  "Write plainly for a busy manager: short sentences, no preamble, no emoji, no markdown headings.",
].join(" ");

async function complete(user: string, maxTokens: number): Promise<string | null> {
  if (!llmAvailable()) return null;
  try {
    const res = await Promise.race([
      openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS + 500)),
    ]);
    const text = res?.choices?.[0]?.message?.content?.trim();
    return text ? text.slice(0, 2000) : null;
  } catch (err) {
    console.warn("[copilot] LLM unavailable, using rules text:", (err as Error)?.message ?? err);
    return null;
  }
}

export function llmBriefSummary(payload: PromptPayload): Promise<string | null> {
  return complete(
    `Write today's morning brief in 3–5 sentences: what tonight looks like, then the 2–3 most important things to act on, highest severity first.\n\nJSON:\n${JSON.stringify(payload)}`,
    350,
  );
}

export function llmAnswer(question: string, payload: PromptPayload): Promise<string | null> {
  return complete(
    `Manager's question: ${question}\n\nAnswer in at most 5 sentences using only this JSON:\n${JSON.stringify(payload)}`,
    400,
  );
}
