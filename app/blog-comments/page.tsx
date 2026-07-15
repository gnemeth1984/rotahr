"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const SUPER_ADMIN_EMAIL = "gnemeth1984@gmail.com";

interface Article {
  id: string;
  title: string;
  url: string;
  snippet: string | null;
  topic: string | null;
  region: string | null;
  hasComments: boolean | null;
  commentPlatform: string | null;
  createdAt: string;
}

interface Draft {
  id: string;
  articleTitle: string;
  articleUrl: string;
  note: string | null;
  draftComment: string;
  createdAt: string;
}

export default function BlogCommentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [adding, setAdding] = useState(false);
  const [onlyWithComments, setOnlyWithComments] = useState(true);
  const [selected, setSelected] = useState<Article | null>(null);
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [aRes, dRes] = await Promise.all([
      fetch("/api/blog-comments/articles"),
      fetch("/api/blog-comments/drafts"),
    ]);
    if (aRes.ok) setArticles((await aRes.json()).articles);
    if (dRes.ok) setDrafts((await dRes.json()).drafts);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.email !== SUPER_ADMIN_EMAIL) {
      router.replace("/");
      return;
    }
    load();
  }, [status, session, router, load]);

  if (status === "loading" || !session?.user || session.user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1c35]">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    );
  }

  async function handleAdd() {
    const urls = bulkText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length) return;
    setAdding(true);
    await fetch("/api/blog-comments/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articles: urls.map((url) => ({
          title: url.split("/").filter(Boolean).pop()?.replace(/_/g, " ") || url,
          url,
          source: "user",
        })),
      }),
    });
    setBulkText("");
    setAdding(false);
    load();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/blog-comments/articles?id=${id}`, { method: "DELETE" });
    load();
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    const res = await fetch("/api/blog-comments/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: selected.id,
        articleTitle: selected.title,
        articleUrl: selected.url,
        articleSnippet: selected.snippet,
        note: note || undefined,
      }),
    });
    setGenerating(false);
    if (res.ok) {
      setNote("");
      load();
    }
  }

  async function handleDeleteDraft(id: string) {
    await fetch(`/api/blog-comments/drafts?id=${id}`, { method: "DELETE" });
    load();
  }

  const visibleArticles = onlyWithComments ? articles.filter((a) => a.hasComments) : articles;

  return (
    <div className="min-h-screen bg-[#0f1c35] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Blog Comment Assistant</h1>
        <p className="mt-2 text-sm text-white/60">
          Pick a relevant hospitality article, get a genuine draft comment — mentions Rotahr only where it truly fits. You post it yourself.
        </p>

        {/* Add articles */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
          <label className="text-sm font-medium text-white/80">
            Add articles (one URL per line — paste as many as you find)
          </label>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="https://www.reddit.com/r/restaurantowners/comments/..."
            className="mt-2 min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
          <Button onClick={handleAdd} disabled={adding} className="mt-3 bg-gradient-to-r from-[#ff6b35] to-[#e8365d]">
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add
          </Button>
        </div>

        {/* Articles list */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-medium">Relevant articles ({visibleArticles.length})</h2>
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={onlyWithComments}
              onChange={(e) => setOnlyWithComments(e.target.checked)}
            />
            Only show ones with comments
          </label>
        </div>

        {loading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-white/40" />
        ) : (
          <div className="mt-4 space-y-3">
            {visibleArticles.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-4 transition ${
                  selected?.id === a.id ? "border-[#ff6b35] bg-white/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
                  <MessageSquare className="h-3 w-3" />
                  {a.commentPlatform || "unknown"}
                  {a.topic && <span className="rounded bg-white/10 px-1.5 py-0.5">{a.topic}</span>}
                  {a.region && <span className="rounded bg-white/10 px-1.5 py-0.5">{a.region}</span>}
                </div>
                <div className="mt-1 font-medium">{a.title}</div>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-white/40 hover:underline">
                  {a.url}
                </a>
                {a.snippet ? (
                  <p className="mt-2 text-sm text-white/60">✓ Context: {a.snippet}</p>
                ) : (
                  <p className="mt-2 text-sm text-yellow-400/70">
                    ⚠ No context saved — paste what it's about in the note field for a better comment.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSelected(a)}>
                    Select
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(a.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate */}
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/80">
            Selected article: <span className="font-medium">{selected ? selected.title : "Pick an article above first"}</span>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your angle/note (optional)"
            className="mt-3 border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
          <Button
            onClick={handleGenerate}
            disabled={!selected || generating}
            className="mt-3 bg-gradient-to-r from-[#ff6b35] to-[#e8365d]"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate Comment
          </Button>
        </div>

        {/* Drafts */}
        <div className="mt-10">
          <h2 className="text-lg font-medium">Recent comment drafts</h2>
          <div className="mt-4 space-y-3">
            {drafts.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="font-medium">{d.articleTitle}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{d.draftComment}</p>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => handleDeleteDraft(d.id)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
