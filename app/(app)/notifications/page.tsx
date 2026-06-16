// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Calendar, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  message: string | null;
  read: boolean;
  createdAt: string;
  reservation: {
    id: string;
    customerName: string;
    date: string;
    time: string;
    partySize: number;
    status: string;
    notes: string | null;
  };
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/list");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" })
      )
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

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
      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              className={cn(
                "rounded-xl border p-4 cursor-pointer transition-all",
                n.read
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-800 border-blue-500/50 shadow-sm shadow-blue-500/10"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Booking info */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        n.read ? "text-slate-300" : "text-white"
                      )}
                    >
                      Booking: {n.reservation.customerName}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(n.reservation.date), "EEE, MMM d")} at{" "}
                      {n.reservation.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {n.reservation.partySize} guests
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(n.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>

                  {/* Manager message */}
                  {n.message && (
                    <p className="text-sm text-slate-300 bg-slate-700/50 rounded-lg px-3 py-2 mt-1">
                      &ldquo;{n.message}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
