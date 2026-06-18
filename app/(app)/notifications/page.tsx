// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Calendar, MessageSquare, Clock, Users, BellRing } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: "message" | "shift" | "timeoff" | "booking" | "rota";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  message: {
    icon: <MessageSquare className="w-4 h-4" />,
    color: "text-blue-400 bg-blue-500/10",
  },
  shift: {
    icon: <Clock className="w-4 h-4" />,
    color: "text-green-400 bg-green-500/10",
  },
  timeoff: {
    icon: <Calendar className="w-4 h-4" />,
    color: "text-yellow-400 bg-yellow-500/10",
  },
  booking: {
    icon: <Users className="w-4 h-4" />,
    color: "text-purple-400 bg-purple-500/10",
  },
  rota: {
    icon: <BellRing className="w-4 h-4" />,
    color: "text-orange-400 bg-orange-500/10",
  },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async () => {
    try {
      const res = await fetch("/api/app-notifications/list");
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  const markRead = async (id: string) => {
    await fetch(`/api/app-notifications/${id}/read`, { method: "PATCH" });
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await fetch("/api/app-notifications/mark-all-read", { method: "POST" });
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {notifs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.booking;
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  if (n.link) window.location.href = n.link;
                }}
                className={cn(
                  "rounded-xl border p-4 cursor-pointer transition-all flex items-start gap-3",
                  n.read
                    ? "bg-slate-800/50 border-slate-700 opacity-70"
                    : "bg-slate-800 border-blue-500/40 shadow-sm shadow-blue-500/10"
                )}
              >
                {/* Type icon */}
                <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", meta.color)}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn("text-sm font-semibold", n.read ? "text-slate-300" : "text-white")}>
                      {n.title}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-snug">{n.body}</p>
                </div>

                {!n.read && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
