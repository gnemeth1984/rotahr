"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Send, MessageSquare, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Employee = { id: string; firstName: string; lastName: string };
type Message = {
  id: string;
  body: string;
  createdAt: string;
  read: boolean;
  sender: Employee;
  recipient: Employee;
};

export default function MessagesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch contacts
  useEffect(() => {
    fetch("/api/messages/contacts")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []));
  }, []);

  // Fetch unread counts
  useEffect(() => {
    fetch("/api/messages/unread")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const u of d.unread ?? []) map[u.senderId] = u._count._all;
        setUnread(map);
      });
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/messages/list?with=${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? []);
        setMeId(d.meId ?? null);
        setUnread((prev) => ({ ...prev, [selectedId]: 0 }));
      });
  }, [selectedId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!body.trim() || !selectedId) return;
    setSending(true);
    await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: selectedId, body: body.trim() }),
    });
    setBody("");
    const d = await fetch(`/api/messages/list?with=${selectedId}`).then((r) => r.json());
    setMessages(d.messages ?? []);
    setSending(false);
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const selectedEmp = employees.find((e) => e.id === selectedId);

  // On mobile: show chat panel if someone is selected, otherwise show list
  const showChat = !!selectedId;

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-50">

      {/* ── Contacts list ── hidden on mobile when chat is open */}
      <div
        className={`
          flex-shrink-0 bg-white border-r border-slate-200 flex flex-col
          w-full md:w-72
          ${showChat ? "hidden md:flex" : "flex"}
        `}
      >
        <div className="px-4 py-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Messages
            {totalUnread > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                {totalUnread}
              </span>
            )}
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {employees.length === 0 && (
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

      {/* ── Chat panel ── full screen on mobile, flex-1 on desktop */}
      <div
        className={`
          flex-col min-w-0
          w-full md:flex-1
          ${showChat ? "flex" : "hidden md:flex"}
        `}
      >
        {!selectedId ? (
          /* Desktop empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Select a colleague to start a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header with back button on mobile */}
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-slate-400 text-sm mt-8">
                  No messages yet. Say hello!
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender.id === meId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
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

            {/* Send bar */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
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
    </div>
  );
}
