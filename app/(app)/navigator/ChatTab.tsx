"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, Zap } from "lucide-react";
import { ChatMessage, NavState } from "./types";
import { api, errMsg } from "./api";
import { Btn, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

const STARTERS = [
  "I've got 40 minutes and no idea where to start",
  "Plan my day, energy is about a 2",
  "Sort my food for today, nothing over 15 minutes",
  "I keep avoiding one thing — help me break it up",
];

export function ChatTab({ state, refresh }: { state: NavState; refresh: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<ChatMessage[]>("/chat")
      .then(setMessages)
      .catch((e) => {
        setMessages([]);
        setError(errMsg(e));
      });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length, sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setError(null);
    setInput("");

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: msg,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...(m ?? []), optimistic]);

    try {
      const out = await api<{ message: ChatMessage }>("/chat", { body: { message: msg } });
      setMessages((m) => [...(m ?? []), out.message]);
      refresh();
    } catch (e) {
      setError(errMsg(e));
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      setInput(msg);
    } finally {
      setSending(false);
    }
  }

  async function clearThread() {
    try {
      await api("/chat", { method: "DELETE" });
      setMessages([]);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-4">
      <Panel className="flex h-[62vh] min-h-[420px] flex-col p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Talk it out
            </span>
          </SectionTitle>
          {messages && messages.length > 0 && (
            <Btn size="sm" variant="quiet" onClick={clearThread}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Btn>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="py-6">
              <p className="text-slate-300">
                I can see your plan, tasks, meals, movement, habits and focus history — and I can change any of them.
                Just say what&apos;s going on.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-300 transition hover:border-[#ff6b35]/40 hover:bg-white/[0.08] hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-[#ff6b35] to-[#e8365d] font-medium text-white"
                      : "border border-white/[0.08] bg-white/[0.04] text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/15 pt-2.5">
                      {m.actions.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <Pill tone="green">
                            <Zap className="h-2.5 w-2.5" />
                            {a.summary}
                          </Pill>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff8f5f]"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/[0.06] p-3.5">
          {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <textarea
              className={`${inputClass} max-h-32 min-h-[46px] resize-none`}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`It's ${state.now} — what's going on?`}
            />
            <Btn variant="flame" loading={sending} onClick={() => send()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}
