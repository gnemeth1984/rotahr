"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plug,
  Unplug,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface PosStatus {
  connected: boolean;
  provider?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  locationId?: string;
  accountId?: string;
}

const PROVIDERS = [
  {
    id: "lightspeed",
    name: "Lightspeed K-Series",
    description: "Most popular in Irish & UK restaurants",
    logo: "💡",
    note: "Requires API access from partners.lightspeedhq.com",
  },
  {
    id: "square",
    name: "Square POS",
    description: "Ideal for cafés, bars & small venues",
    logo: "⬛",
    note: "Instant sandbox access — go live in minutes",
  },
];

export default function PosSettingsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PosStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();

    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") toast.success("POS connected successfully!");
    if (error) toast.error(`Connection failed: ${decodeURIComponent(error)}`);
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/pos/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      toast.error("Failed to fetch POS status");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/pos/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Synced today's data from POS");
      fetchStatus();
    } catch (err) {
      toast.error(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/pos/disconnect", { method: "DELETE" });
      toast.success("POS disconnected. All POS data deleted.");
      setStatus({ connected: false });
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  const connectedProvider = PROVIDERS.find((p) => p.id === status?.provider);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">POS Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your till system to see live revenue alongside your rota and labour costs.
        </p>
      </div>

      {/* GDPR notice */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          <strong>Privacy first.</strong> Rotahr only stores daily aggregates — total revenue, hourly
          buckets, and top-selling item names. No customer names, card details, or transaction IDs
          are ever stored. Disconnect at any time to permanently delete all POS data.
        </AlertDescription>
      </Alert>

      {/* Connected state */}
      {!loading && status?.connected && connectedProvider && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">
                  {connectedProvider.logo} {connectedProvider.name}
                </CardTitle>
                <Badge variant="outline" className="text-green-700 border-green-400">
                  Connected
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Connected</p>
                <p className="font-medium">
                  {status.connectedAt
                    ? new Date(status.connectedAt).toLocaleDateString("en-IE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last sync</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {status.lastSyncAt
                    ? new Date(status.lastSyncAt).toLocaleTimeString("en-IE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
                </p>
              </div>
              {status.accountId && (
                <div>
                  <p className="text-muted-foreground">Account ID</p>
                  <p className="font-mono text-xs">{status.accountId}</p>
                </div>
              )}
              {status.locationId && (
                <div>
                  <p className="text-muted-foreground">Location ID</p>
                  <p className="font-mono text-xs">{status.locationId}</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button onClick={handleSync} disabled={syncing} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Now"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Unplug className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect POS?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all POS data (snapshots, sync history) from
                      Rotahr. Your POS system itself is unaffected. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Yes, disconnect & delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not connected — provider selection */}
      {!loading && !status?.connected && (
        <div className="space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Choose your POS system
          </h2>
          {PROVIDERS.map((provider) => (
            <Card key={provider.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{provider.logo}</span>
                  <div>
                    <p className="font-semibold">{provider.name}</p>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                    {provider.note && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {provider.note}
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild>
                  <a href={`/api/pos/connect/${provider.id}`}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading POS status…
        </div>
      )}

      {/* Help links */}
      <Separator />
      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Need API credentials?</p>
        <ul className="space-y-1">
          <li>
            <a
              href="https://partners.lightspeedhq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Lightspeed K-Series partner portal
            </a>
          </li>
          <li>
            <a
              href="https://developer.squareup.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Square Developer dashboard (free sandbox)
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
