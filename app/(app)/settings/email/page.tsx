"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Mail,
  CheckCircle2,
  Unplug,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface EmailStatus {
  connected: boolean;
  provider?: string;
  email?: string;
  connectedAt?: string;
  connectedBy?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Only managers and admins can connect an email account.",
  invalid_state: "That connection attempt expired or was invalid — please try again.",
  no_refresh_token:
    "Google didn't return a fresh permission grant. Disconnect below (if shown) and try connecting again — make sure to click Allow, not just close the window.",
  connection_failed: "Something went wrong connecting your Gmail account. Please try again.",
  access_denied: "You cancelled the Google sign-in — no changes were made.",
};

export default function EmailSettingsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();

    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "1") toast.success("Gmail connected! CRM emails will now send from your inbox.");
    if (error) toast.error(ERROR_MESSAGES[error] || "Connection failed — please try again.");
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/gmail/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      toast.error("Failed to check email connection status");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/integrations/gmail/disconnect", { method: "POST" });
      toast.success("Disconnected. CRM emails will send from Rotahr's address again.");
      setStatus({ connected: false });
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="text-muted-foreground mt-1">
          Connect your own inbox so CRM emails to customers send from your real email address —
          not a generic Rotahr address.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works.</strong> You sign in with Google and grant Rotahr permission to send
          email on your behalf — nothing else. We never read your inbox, contacts, or existing
          emails. Every CRM email still shows up in your own Gmail "Sent" folder, and replies land
          straight in your inbox like normal. Disconnect any time.
        </AlertDescription>
      </Alert>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>Automatic details.</strong> Every CRM email automatically shows your registered
          business name in the "From" field and adds a small signature with your business name and
          contact details — nothing to set up manually.
        </AlertDescription>
      </Alert>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertDescription>
          <strong>Heads up on spam folders.</strong> The very first email to a brand-new contact can
          occasionally land in spam — that's normal for any new sender, not a sign of a problem. Ask
          early customers to reply once (or mark it "Not Spam"), and it reliably lands in the inbox
          from then on.
        </AlertDescription>
      </Alert>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Checking connection status…
        </div>
      )}

      {/* Connected state */}
      {!loading && status?.connected && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Gmail connected</CardTitle>
              <Badge variant="outline" className="text-green-700 border-green-400">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sending as</p>
                <p className="font-medium">{status.email}</p>
              </div>
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
              {status.connectedBy && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Connected by</p>
                  <p className="font-medium">{status.connectedBy}</p>
                </div>
              )}
            </div>

            <Separator />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Future CRM emails will go back to sending from Rotahr's shared address instead
                    of {status.email}. You can reconnect any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Yes, disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Not connected */}
      {!loading && !status?.connected && (
        <Card className="hover:border-primary/50 transition-colors">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold">Connect Gmail / Google Workspace</p>
                <p className="text-sm text-muted-foreground">
                  Takes about 30 seconds. Works with a personal Gmail or your business's Google
                  Workspace email.
                </p>
              </div>
            </div>
            <Button asChild>
              <a href="/api/integrations/gmail/connect">
                <Mail className="h-4 w-4 mr-2" />
                Connect Gmail
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />
      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Not connected yet?</p>
        <p>Every CRM email sends from Rotahr's own address (no-reply@rotahr.com) until you connect your inbox — nothing breaks in the meantime, replies just won't land anywhere useful.</p>
      </div>
    </div>
  );
}
