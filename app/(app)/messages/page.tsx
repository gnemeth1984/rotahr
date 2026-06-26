"use client";

import { useEffect, useRef, useState, Component, ReactNode, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Send, MessageSquare, User, ArrowLeft, AlertCircle, Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserRole as Role } from "@/types/roles";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="font-medium text-slate-700">Something went wrong</p>
          <p className="text-sm text-slate-400 mt-1">{this.state.error}</p>
          <button className="mt-4 text-sm text-blue-500 underline" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

type Employee = { id: string; firstName: string; lastName: string };
type Message = {
  id: string;
  body: string;
  createdAt: string;
  read: boolean;
  sender: Employee;
  recipient: Employee;
};

function MessagesInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(threadParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group message state
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [groupBody, setGroupBody] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState(false);

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  // Fetch contacts
  useEffect(() => {
    fetch("/api/messages/contacts")
      .then((r) => r.json())
      .then((d) => {
        if (!d || d.error) setContactsError(d?.error ?? "Failed to load contacts");
        else setEmployees(Array.isArray(d.employees) ? d.employees : []);
      })
      .catch(() => setContactsError("Failed to load contacts"));
  }, []);

  // Validate threadParam against loaded employees (clear if ghost ID)
  useEffect(() => {
    if (!threadParam || employees.length === 0) return;
    const exists = employees.some((e) => e.id === threadParam);
    if (!exists) setSelectedId(null);
  }, [employees, threadParam]);

  // Fetch unread counts
  useEffect(() => {
    fetch("/api/messages/unread")
      .then((r) => r.json())
      .then((d) => {
        if (!d || !Array.isArray(d.unread)) return;
        const map: Record<string, number> = {};
        for (const u of d.unread) map[u.senderId] = u._count?._all ?? 0;
        setUnread(map);
      })
      .catch(() => {});
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedId) return;
    setError(null);
    fetch(`/api/messages/list?with=${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d || d.error) { setError(d?.error ?? "Failed to load messages"); return; }
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setMeId(d.meId ?? null);
        setUnread((prev) => ({ ...prev, [selectedId]: 0 }));
      })
      .catch(() => setError("Failed to load messages"));
  }, [selectedId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!body.trim() || !selectedId) return;
    const text = body.trim();
    setBody("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: selectedId, body: text }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `Send failed (${res.status})`);
        setBody(text);
        setSending(false);
        return;
      }

      const d = await fetch(`/api/messages/list?with=${selectedId}`).then((r) => r.json());
      if (d.error) setError(d.error);
      else { setMessages(d.messages ?? []); setMeId(d.meId ?? null); }
    } catch {
      setError("Network error — check your connection");
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  async function sendGroupMessage() {
    if (!groupBody.trim() || groupSelected.length === 0) return;
    setGroupSending(true);
    setGroupError(null);
    setGroupSuccess(false);
    try {
      const res = await fetch("/api/messages/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIds: groupSelected, body: groupBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setGroupError(data.error || "Failed to send"); return; }
      setGroupSuccess(true);
      setGroupBody("");
      setGroupSelected([]);
      setTimeout(() => { setGroupOpen(false); setGroupSuccess(false); }, 1500);
    } catch {
      setGroupError("Network error");
    } finally {
      setGroupSending(false);
    }
  }

  function toggleGroupEmployee(id: string) {
    setGroupSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setGroupSelected(employees.map((e) => e.id));
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const selectedEmp = employees.find((e) => e.id === selectedId);
  const showChat = !!selectedId;

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-50">

      {/* Contacts list */}
      <div
        className={`
          flex-shrink-0 bg-white border-r border-slate-200 flex flex-col
          w-full md:w-72
          ${showChat ? "hidden md:flex" : "flex"}
        `}
      >
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Messages
              {totalUnread > 0 && (
                <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                  {totalUnread}
                </span>
              )}
            </h1>
            {isManager && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  setGroupSelected([]);
                  setGroupBody("");
                  setGroupError(null);
                  setGroupSuccess(false);
                  setGroupOpen(true);
                }}
              >
                <Users className="h-3.5 w-3.5" />
                Group
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contactsError && (
            <div className="mx-4 mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {contactsError}
            </div>
          )}
          {!contactsError && employees.length === 0 && (
            <p className="text-sm text-slate-400 px-4 py-6">No colleagues found</p>
          )}
          {employees.map((emp) => {
            const count = unread[emp.id] ?? 0;
            const isSelected = selectedId === emp.id;
            return (
              <button
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 ${
                  isSelected
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                </div>
                {count > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat panel */}
      <div
        className={`
          flex-col min-w-0 w-full md:flex-1
          ${showChat ? "flex" : "hidden md:flex"}
        `}
      >
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Select a colleague to start a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
              <button
                className="md:hidden p-1 -ml-1 rounded-full hover:bg-slate-100"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <p className="font-semibold text-slate-900">
                {selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : "Chat"}
              </p>
            </div>

            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && !error && (
                <p className="text-center text-slate-400 text-sm mt-8">
                  No messages yet. Say hello!
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender.id === meId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                        isMe
                          ? "bg-blue-500 text-white rounded-br-sm"
                          : "bg-white text-slate-900 border border-slate-200 rounded-bl-sm"
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p className={`text-xs mt-1 ${isMe ? "text-blue-100" : "text-slate-400"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString("en-IE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !body.trim()}
                size="icon"
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Group Message Dialog ──────────────────────────────────────────────── */}
      <Dialog open={groupOpen} onOpenChange={(o) => !groupSending && setGroupOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Group Message
            </DialogTitle>
            <DialogDescription>
              Send a message to multiple team members at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipient selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  Recipients
                  {groupSelected.length > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                      {groupSelected.length} selected
                    </span>
                  )}
                </p>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={groupSelected.length === employees.length ? () => setGroupSelected([]) : selectAll}
                >
                  {groupSelected.length === employees.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                {employees.map((emp) => {
                  const checked = groupSelected.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => toggleGroupEmployee(emp.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        checked ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked ? "bg-blue-500 border-blue-500" : "border-slate-300"
                      }`}>
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message body */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Message</p>
              <Textarea
                value={groupBody}
                onChange={(e) => setGroupBody(e.target.value)}
                placeholder="Type your message to the group…"
                rows={3}
                disabled={groupSending}
              />
            </div>

            {groupError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {groupError}
              </div>
            )}

            {groupSuccess && (
              <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Check className="h-4 w-4 flex-shrink-0" />
                Message sent to {groupSelected.length} team member{groupSelected.length !== 1 ? "s" : ""}!
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)} disabled={groupSending}>
              Cancel
            </Button>
            <Button
              onClick={sendGroupMessage}
              disabled={groupSending || groupSelected.length === 0 || !groupBody.trim()}
              className="gap-2 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {groupSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to {groupSelected.length || "…"} member{groupSelected.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <MessagesInner />
      </Suspense>
    </ErrorBoundary>
  );
}
