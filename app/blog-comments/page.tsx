"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  MessageSquare,
  Trash2,
  Sparkles,
  Search,
  Copy,
  Check,
  ExternalLink,
  Plus,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  articleId: string | null;
  articleTitle: string;
  articleUrl: string;
  note: string | null;
  draftComment: string;
  createdAt: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  disqus: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  wordpress: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  quora: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function BlogCommentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddBox, setShowAddBox] = useState(false);
  const [onlyWithComments, setOnlyWithComments] = useState(true);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Article | null>(null);
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [latestDraft, setLatestDraft] = useState<Draft | null>(null);
  const generatePanelRef = useRef<HTMLDivElement | null>(null);
  const [pendingDeleteArticle, setPendingDeleteArticle] = useState<Article | null>(null);
  const [pendingDeleteDraft, setPendingDeleteDraft] = useState<Draft | null>(null);

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

  const topics = useMemo(() => {
    const set = new Set(articles.map((a) => a.topic).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [articles]);

  const visibleArticles = useMemo(() => {
    return articles
      .filter((a) => (onlyWithComments ? a.hasComments : true))
      .filter((a) => (topicFilter === "all" ? true : a.topic === topicFilter))
      .filter((a) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.url.toLowerCase().includes(q) ||
          (a.snippet || "").toLowerCase().includes(q)
        );
      });
  }, [articles, onlyWithComments, topicFilter, search]);

  const confirmedCount = articles.filter(
    (a) => a.hasComments && a.snippet && !a.snippet.toLowerCase().includes("verify")
  ).length;
  const needsVerifyCount = articles.filter(
    (a) => a.snippet && a.snippet.toLowerCase().includes("verify")
  ).length;

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
    try {
      const res = await fetch("/api/blog-comments/articles", {
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
      if (!res.ok) throw new Error();
      toast.success(`Added ${urls.length} article${urls.length > 1 ? "s" : ""}`);
      setBulkText("");
      setShowAddBox(false);
      await load();
    } catch {
      toast.error("Couldn't add articles — try again");
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemoveArticle() {
    if (!pendingDeleteArticle) return;
    await fetch(`/api/blog-comments/articles?id=${pendingDeleteArticle.id}`, { method: "DELETE" });
    if (selected?.id === pendingDeleteArticle.id) setSelected(null);
    setPendingDeleteArticle(null);
    toast.success("Article removed");
    load();
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setLatestDraft(null);
    try {
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
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success("Draft generated");
      setLatestDraft({
        id: data.id,
        articleId: selected.id,
        articleTitle: selected.title,
        articleUrl: selected.url,
        note: note || null,
        draftComment: data.draft,
        createdAt: new Date().toISOString(),
      });
      setNote("");
      await load();
    } catch {
      toast.error("Couldn't generate a draft — try again");
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDeleteDraft() {
    if (!pendingDeleteDraft) return;
    await fetch(`/api/blog-comments/drafts?id=${pendingDeleteDraft.id}`, { method: "DELETE" });
    setPendingDeleteDraft(null);
    toast.success("Draft deleted");
    load();
  }

  async function handleCopy(draft: Draft) {
    await navigator.clipboard.writeText(draft.draftComment);
    setCopiedId(draft.id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="min-h-screen bg-[#0f1c35] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Blog Comment Assistant</h1>
            <p className="mt-2 max-w-xl text-sm text-white/60">
              Pick a relevant thread, get a genuine draft comment — mentions Rotahr only where it truly
              fits. You review and post it yourself, nothing is auto-posted.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
              <div className="text-lg font-semibold">{articles.length}</div>
              <div className="text-white/50">total</div>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-green-300">{confirmedCount}</div>
              <div className="text-white/50">confirmed</div>
            </div>
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-yellow-300">{needsVerifyCount}</div>
              <div className="text-white/50">verify first</div>
            </div>
          </div>
        </div>

        {/* Add articles */}
        <div className="mt-8">
          {!showAddBox ? (
            <Button
              onClick={() => setShowAddBox(true)}
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <Plus className="mr-2 h-4 w-4" /> Add articles / threads
            </Button>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5">
                <label className="text-sm font-medium text-white/80">
                  Paste one URL per line — Reddit threads, blog posts, anything relevant
                </label>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="https://www.reddit.com/r/restaurantowners/comments/..."
                  className="mt-2 min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={handleAdd}
                    disabled={adding || !bulkText.trim()}
                    className="bg-gradient-to-r from-[#ff6b35] to-[#e8365d]"
                  >
                    {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add {bulkText.trim() ? `(${bulkText.trim().split("\n").filter(Boolean).length})` : ""}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowAddBox(false);
                      setBulkText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, URL, or context..."
              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="all" className="bg-[#0f1c35]">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t} className="bg-[#0f1c35]">
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-white/60">
            <input
              type="checkbox"
              checked={onlyWithComments}
              onChange={(e) => setOnlyWithComments(e.target.checked)}
            />
            Only with comments
          </label>
        </div>

        {/* Articles list */}
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/50">
            {visibleArticles.length} thread{visibleArticles.length === 1 ? "" : "s"}
          </h2>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 py-14 text-white/40">
            <Inbox className="h-8 w-8" />
            <p>No threads match your filters</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleArticles.map((a) => {
              const needsVerify = a.snippet?.toLowerCase().includes("verify");
              const isSelected = selected?.id === a.id;
              return (
                <Card
                  key={a.id}
                  onClick={() => { setSelected(a); setLatestDraft(null); generatePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                  className={`cursor-pointer border transition ${
                    isSelected
                      ? "border-[#ff6b35] bg-white/10 ring-1 ring-[#ff6b35]/50"
                      : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.07]"
                  }`}
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`${
                          PLATFORM_COLORS[a.commentPlatform || ""] ||
                          "border-white/20 bg-white/5 text-white/60"
                        }`}
                      >
                        {a.commentPlatform || "unknown"}
                      </Badge>
                      {a.topic && (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-white/50">
                          {a.topic}
                        </Badge>
                      )}
                      {a.region && (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-white/50">
                          {a.region.toUpperCase()}
                        </Badge>
                      )}
                      {needsVerify && (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> verify
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 line-clamp-2 font-medium leading-snug">{a.title}</div>

                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 hover:underline"
                    >
                      Open thread <ExternalLink className="h-3 w-3" />
                    </a>

                    {a.snippet && (
                      <p className="mt-2 line-clamp-3 text-sm text-white/60">{a.snippet}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "secondary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(a);
                          setLatestDraft(null);
                          generatePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={isSelected ? "bg-gradient-to-r from-[#ff6b35] to-[#e8365d]" : ""}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/40 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteArticle(a);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Generate panel */}
        <div ref={generatePanelRef} className="mt-10 scroll-mt-6">
          <Card className="border-[#ff6b35]/30 bg-[#132345] shadow-xl">
            <CardContent className="pt-5">
              <div className="text-sm text-white/60">Selected thread</div>
              <div className="mt-1 font-medium">
                {selected ? selected.title : <span className="text-white/40">Pick a thread above first</span>}
              </div>
              {selected && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex w-fit items-center gap-1 text-xs text-white/40 hover:text-white/70 hover:underline"
                >
                  Open thread <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Your angle/note (optional) — e.g. mention the payroll feature"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
                <Button
                  onClick={handleGenerate}
                  disabled={!selected || generating}
                  className="whitespace-nowrap bg-gradient-to-r from-[#ff6b35] to-[#e8365d]"
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate Comment
                </Button>
              </div>

              {latestDraft && (
                <div className="mt-4 rounded-lg border border-[#ff6b35]/30 bg-black/20 p-4">
                  <p className="whitespace-pre-wrap text-sm text-white/90">{latestDraft.draftComment}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleCopy(latestDraft)} className="bg-white/10 hover:bg-white/20">
                      {copiedId === latestDraft.id ? (
                        <Check className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedId === latestDraft.id ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" asChild className="bg-gradient-to-r from-[#ff6b35] to-[#e8365d]">
                      <a href={latestDraft.articleUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open thread &amp; post it
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Drafts */}
        <div className="mt-10">
          <h2 className="text-lg font-medium">Recent comment drafts</h2>
          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Generated drafts will show up here.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {drafts.map((d) => (
                <Card key={d.id} className="border-white/10 bg-white/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{d.articleTitle}</div>
                        <a
                          href={d.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-white/40 hover:underline"
                        >
                          {d.articleUrl}
                        </a>
                      </div>
                      <span className="whitespace-nowrap text-xs text-white/30">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-sm text-white/85">
                      {d.draftComment}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleCopy(d)}>
                        {copiedId === d.id ? (
                          <Check className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <Copy className="mr-1 h-3.5 w-3.5" />
                        )}
                        {copiedId === d.id ? "Copied" : "Copy"}
                      </Button>
                      <Button size="sm" asChild className="bg-gradient-to-r from-[#ff6b35] to-[#e8365d]">
                        <a href={d.articleUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Open thread &amp; post it
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/40 hover:text-red-400"
                        onClick={() => setPendingDeleteDraft(d)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete article confirm */}
      <AlertDialog open={!!pendingDeleteArticle} onOpenChange={(open) => !open && setPendingDeleteArticle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this thread?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDeleteArticle?.title}" will be removed from the list. This doesn't affect the actual
              Reddit/blog post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveArticle} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete draft confirm */}
      <AlertDialog open={!!pendingDeleteDraft} onOpenChange={(open) => !open && setPendingDeleteDraft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDraft} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
