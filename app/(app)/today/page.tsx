"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, ListChecks, StickyNote, AlertTriangle, Sun } from "lucide-react";

interface TodaySummary {
  unreadDirectMessages: { id: string; body: string; sender: { firstName: string; lastName: string } }[];
  unreadChannelCount: number;
  openTasksCount: number;
  overdueTasks: any[];
  dueTodayTasks: any[];
  otherOpenTasks: any[];
  unresolvedLogEntries: any[];
}

export default function TodayPage() {
  const [data, setData] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/today")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) return null;

  const totalUnread = data.unreadDirectMessages.length + data.unreadChannelCount;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Sun className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900">Today</h1>
      </div>

      {/* Messages */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Messages
          {totalUnread > 0 && <Badge className="bg-blue-100 text-blue-700 border-blue-200">{totalUnread} unread</Badge>}
        </h2>
        {totalUnread === 0 ? (
          <p className="text-sm text-slate-400">All caught up.</p>
        ) : (
          <div className="space-y-2">
            {data.unreadDirectMessages.slice(0, 5).map((m) => (
              <Link key={m.id} href="/messages">
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="py-2.5 text-sm">
                    <span className="font-medium text-slate-800">{m.sender.firstName} {m.sender.lastName}</span>
                    <span className="text-slate-500"> — {m.body.slice(0, 80)}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {data.unreadChannelCount > 0 && (
              <Link href="/messages">
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="py-2.5 text-sm text-slate-600">
                    {data.unreadChannelCount} unread channel message{data.unreadChannelCount > 1 ? "s" : ""}
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Tasks */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" /> Tasks
          {data.openTasksCount > 0 && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{data.openTasksCount} open</Badge>}
        </h2>
        {data.overdueTasks.length === 0 && data.dueTodayTasks.length === 0 && data.otherOpenTasks.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing open.</p>
        ) : (
          <div className="space-y-2">
            {data.overdueTasks.map((t) => (
              <Link key={t.id} href="/log-book">
                <Card className="border-red-200 bg-red-50 hover:border-red-300 transition-colors">
                  <CardContent className="py-2.5 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="font-medium text-slate-800">{t.title}</span>
                    <span className="text-red-500 text-xs ml-auto">Overdue</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {data.dueTodayTasks.map((t) => (
              <Link key={t.id} href="/log-book">
                <Card className="border-amber-200 bg-amber-50 hover:border-amber-300 transition-colors">
                  <CardContent className="py-2.5 text-sm flex items-center gap-2">
                    <span className="font-medium text-slate-800">{t.title}</span>
                    <span className="text-amber-600 text-xs ml-auto">Due today</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {data.otherOpenTasks.slice(0, 5).map((t) => (
              <Link key={t.id} href="/log-book">
                <Card className="hover:border-slate-300 transition-colors">
                  <CardContent className="py-2.5 text-sm text-slate-700">{t.title}</CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Log book */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" /> Log Book
          {data.unresolvedLogEntries.length > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">{data.unresolvedLogEntries.length} unresolved</Badge>
          )}
        </h2>
        {data.unresolvedLogEntries.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing unresolved.</p>
        ) : (
          <div className="space-y-2">
            {data.unresolvedLogEntries.slice(0, 5).map((e) => (
              <Link key={e.id} href="/log-book">
                <Card className="hover:border-slate-300 transition-colors">
                  <CardContent className="py-2.5 text-sm">
                    <span className="uppercase text-[10px] font-semibold text-slate-400 mr-1.5">{e.type}</span>
                    <span className="text-slate-800">{e.title}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
