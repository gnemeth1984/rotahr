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
  X,
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
  used: boolean;
  source: string;
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
  reddit: "bg-orange-50 text-orange-700 border-orange-200",
  disqus: "bg-blue-50 text-blue-700 border-blue-200",
  wordpress: "bg-slate-100 text-slate-700 border-slate-300",
  quora: "bg-red-50 text-red-700 border-red-200",
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
  const [hideUsed, setHideUsed] = useState(true);
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
  const [competitors, setCompetitors] = useState<{ id: string; name: string; category: string | null; active: boolean; lastCheckedAt: string | null }[]>([]);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompCategory, setNewCompCategory] = useState("");
  const [addingCompetitor, setAddingCompetitor] = useState(false);

  const load = useCallback(async () => {
    const [aRes, dRes] = await Promise.all([
      fetch("/api/blog-comments/articles"),
      fetch("/api/blog-comments/drafts"),
    ]);
    if (aRes.ok) setArticles((await aRes.json()).articles);
    if (dRes.ok) setDrafts((await dRes.json()).drafts);
    setLoading(false);
  }, []);

  const loadCompetitors = useCallback(async () => {
    const res = await fetch("/api/blog-comments/competitors");
    if (res.ok) setCompetitors((await res.json()).competitors);
  }, []);

  async function addCompetitor() {
    if (!newCompName.trim()) return;
    setAddingCompetitor(true);
    try {
      const res = await fetch("/api/blog-comments/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompName.trim(), category: newCompCategory.trim() || undefined }),
      });
      if (res.ok) {
        setNewCompName("");
        setNewCompCategory("");
        loadCompetitors();
      }
    } finally {
      setAddingCompetitor(false);
    }
  }

  async function toggleCompetitorActive(id: string, active: boolean) {
    const res = await fetch("/api/blog-comments/competitors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    if (res.ok) loadCompetitors();
  }

  async function deleteCompetitor(id: string) {
    const res = await fetch(`/api/blog-comments/competitors?id=${id}`, { method: "DELETE" });
    if (res.ok) loadCompetitors();
  }

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.email !== SUPER_ADMIN_EMAIL) {
      router.replace("/");
      return;
    }
    load();
    loadCompetitors();
  }, [status, session, router, load, loadCompetitors]);

  const topics = useMemo(() => {
    const set = new Set(articles.map((a) => a.topic).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [articles]);

  const visibleArticles = useMemo(() => {
    return articles
      .filter((a) => (onlyWithComments ? a.hasComments : true))
      .filter((a) => (hideUsed ? !a.used : true))
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
  }, [articles, onlyWithComments, hideUsed, topicFilter, search]);

  const confirmedCount = articles.filter(
    (a) => a.hasComments && a.snippet && !a.snippet.toLowerCase().includes("verify")
  ).length;
  const needsVerifyCount = articles.filter(
    (a) => a.snippet && a.snippet.toLowerCase().includes("verify")
  ).length;

  if (status === "loading" || !session?.user || session.user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Blog Comment Assistant</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Pick a relevant thread, get a genuine draft comment — mentions Rotahr only where it truly
              fits. You review and post it yourself, nothing is auto-posted.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
              <div className="text-lg font-semibold">{articles.length}</div>
              <div className="text-slate-500">total</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-green-700">{confirmedCount}</div>
              <div className="text-slate-500">confirmed</div>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-yellow-700">{needsVerifyCount}</div>
              <div className="text-slate-500">verify first</div>
            </div>
          </div>
        </div>

        {/* Add articles */}
        <div className="mt-8 flex flex-wrap gap-3">
          {!showAddBox ? (
            <Button
              onClick={() => setShowAddBox(true)}
              variant="outline"
              className="border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
            >
              <Plus className="mr-2 h-4 w-4" /> Add articles / threads
            </Button>
          ) : null}
          <Button
            onClick={() => setShowCompetitors((v) => !v)}
            variant="outline"
            className="border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
          >
            {showCompetitors ? "Hide" : "Manage"} competitors ({competitors.filter((c) => c.active).length} active)
          </Button>
        </div>

        {/* Competitors panel */}
        {showCompetitors && (
          <Card className="mt-4 border-slate-200 bg-white">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-slate-500">
                The daily auto-discovery cron searches Reddit for these names (rotating ~8/day, past 2 months only)
                and adds new relevant threads automatically. Untick any that shouldn't be searched anymore.
              </p>
              <div className="flex flex-wrap gap-2">
                {competitors.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                      c.active ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    <button onClick={() => toggleCompetitorActive(c.id, !c.active)} className="font-medium">
                      {c.name}
                    </button>
                    {c.category && <span className="text-xs text-slate-400">({c.category})</span>}
                    <button onClick={() => deleteCompetitor(c.id)} className="text-slate-400 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {competitors.length === 0 && <p className="text-sm text-slate-400">No competitors yet.</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="Competitor/service name"
                  className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
                <Input
                  value={newCompCategory}
                  onChange={(e) => setNewCompCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 max-w-[180px]"
                />
                <Button onClick={addCompetitor} disabled={addingCompetitor || !newCompName.trim()} className="bg-[#ff6b35] hover:bg-[#e8365d]">
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showAddBox ? (
            <Card className="border-slate-200 bg-white">
              <CardContent className="pt-5">
                <label className="text-sm font-medium text-slate-700">
                  Paste one URL per line — Reddit threads, blog posts, anything relevant
                </label>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="https://www.reddit.com/r/restaurantowners/comments/..."
                  className="mt-2 min-h-[100px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
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
        ) : null}

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, URL, or context..."
              className="border-slate-200 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="all" className="bg-slate-50">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t} className="bg-slate-50">
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input
              type="checkbox"
              checked={onlyWithComments}
              onChange={(e) => setOnlyWithComments(e.target.checked)}
            />
            Only with comments
          </label>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input
              type="checkbox"
              checked={hideUsed}
              onChange={(e) => setHideUsed(e.target.checked)}
            />
            Hide already-used
          </label>
        </div>

        {/* Articles list */}
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">
            {visibleArticles.length} thread{visibleArticles.length === 1 ? "" : "s"}
          </h2>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-14 text-slate-400">
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
                      ? "border-[#ff6b35] bg-orange-50 ring-1 ring-[#ff6b35]/40"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.used && (
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                          Done
                        </Badge>
                      )}
                      {a.source === "auto" && (
                        <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700">
                          Auto-found
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`${
                          PLATFORM_COLORS[a.commentPlatform || ""] ||
                          "border-slate-300 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {a.commentPlatform || "unknown"}
                      </Badge>
                      {a.topic && (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                          {a.topic}
                        </Badge>
                      )}
                      {a.region && (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
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
                      className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:underline"
                    >
                      Open thread <ExternalLink className="h-3 w-3" />
                    </a>

                    {a.snippet && (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{a.snippet}</p>
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
                        className="text-slate-400 hover:text-red-600"
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
          <Card className="border-[#ff6b35]/40 bg-orange-50/60 shadow-sm">
            <CardContent className="pt-5">
              <div className="text-sm text-slate-500">Selected thread</div>
              <div className="mt-1 font-medium">
                {selected ? selected.title : <span className="text-slate-400">Pick a thread above first</span>}
              </div>
              {selected && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-slate-700 hover:underline"
                >
                  Open thread <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Your angle/note (optional) — e.g. mention the payroll feature"
                  className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
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
                <div className="mt-4 rounded-lg border border-[#ff6b35]/30 bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{latestDraft.draftComment}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleCopy(latestDraft)} className="bg-slate-100 hover:bg-slate-200 text-slate-900">
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
            <p className="mt-3 text-sm text-slate-400">Generated drafts will show up here.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {drafts.map((d) => (
                <Card key={d.id} className="border-slate-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{d.articleTitle}</div>
                        <a
                          href={d.articleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-400 hover:underline"
                        >
                          {d.articleUrl}
                        </a>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">
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
                        className="text-slate-400 hover:text-red-600"
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
