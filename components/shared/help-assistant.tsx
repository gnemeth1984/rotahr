"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  HelpCircle,
  X,
  Send,
  BookOpen,
  User,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "faq" | "ai" | "fallback" | "error";
}

// Quick-access topic suggestions
const QUICK_TOPICS = [
  { label: "How does the Rota work?", q: "How does the rota work?" },
  { label: "Request time off", q: "How do I request time off?" },
  { label: "Payroll & BrightPay", q: "How does payroll work?" },
  { label: "Managing bookings", q: "How do bookings work?" },
  { label: "Tips distribution", q: "How does tip distribution work?" },
  { label: "Get started", q: "How do I get started with Rotahr?" },
];

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n• /g, "<br/>• ")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n(\d+)\./g, "<br/>$1.")
    .replace(/\n/g, "<br/>");
}

export function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuickTopics, setShowQuickTopics] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (messages.length === 0) setShowQuickTopics(true);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const send = async (msg: string) => {
    const text = msg.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setShowQuickTopics(false);

    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response ?? "Sorry, I couldn't find an answer for that.",
          source: data.source,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
          source: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setShowQuickTopics(true);
    setInput("");
  };

  // Hide on messages page
  if (pathname === "/messages") return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition-all hover:scale-105"
        aria-label="Open help assistant"
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <HelpCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Help</span>
          </>
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col transition-all duration-200",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ maxHeight: "560px" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-t-2xl">
          <div className="flex items-center justify-center w-8 h-8 bg-slate-700 rounded-full">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Rotahr Help</p>
            <p className="text-xs text-slate-400">Ask how to use any feature</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ minHeight: "280px", maxHeight: "400px" }}
        >
          {/* Welcome + quick topics */}
          {showQuickTopics && messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                👋 Hi! Ask me anything about how to use Rotahr, or pick a topic below.
              </p>
              <div className="space-y-1.5">
                {QUICK_TOPICS.map((t) => (
                  <button
                    key={t.q}
                    onClick={() => send(t.q)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-left"
                  >
                    <span>{t.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center mt-0.5">
                  <BookOpen className="h-3.5 w-3.5 text-slate-600" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[82%] px-3 py-2 rounded-2xl text-sm",
                  msg.role === "user"
                    ? "bg-slate-800 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-1">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(msg.content),
                      }}
                    />
                    {msg.source === "ai" && (
                      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-200">
                        <Sparkles className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-400">AI answer</span>
                      </div>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center mt-0.5">
                  <User className="h-3.5 w-3.5 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {/* Follow-up quick topics after a response */}
          {!showQuickTopics && messages.length > 0 && !loading && (
            <div className="pt-1">
              <p className="text-xs text-slate-400 mb-1.5">Other topics:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TOPICS.slice(0, 3).map((t) => (
                  <button
                    key={t.q}
                    onClick={() => send(t.q)}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-bl-sm">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any Rotahr feature..."
              className="flex-1 text-sm h-9"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 bg-slate-800 hover:bg-slate-700 flex-shrink-0"
              disabled={!input.trim() || loading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
