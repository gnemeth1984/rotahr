"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Generate / rotate / revoke the per-business secret for POST /api/webhooks.
 * The secret is shown once, right after generating it.
 */
export default function WebhookSecretCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/webhook-secret")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfigured(!!d?.configured))
      .catch(() => setConfigured(false));
  }, []);

  const generate = async () => {
    if (configured && !confirm("Rotate the webhook secret? Anything using the old one will stop working immediately.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/business/webhook-secret", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setSecret(d.secret);
      setConfigured(true);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm("Revoke the webhook secret? All inbound webhook calls will be rejected.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/business/webhook-secret", { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
      setSecret(null);
      setConfigured(false);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Integrations webhook
        </CardTitle>
        <CardDescription>
          External systems can create or cancel bookings and approve time off by calling{" "}
          <code className="text-xs">POST /api/webhooks</code> with this secret in the{" "}
          <code className="text-xs">x-webhook-secret</code> header. It only ever acts on this business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {configured === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <p className="text-sm text-slate-600">
            Status: {configured ? <span className="text-green-700 font-medium">active</span> : <span className="font-medium">not set up</span>}
          </p>
        )}

        {secret && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs text-amber-800">Copy this now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all flex-1">{secret}</code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={generate} disabled={busy || configured === null}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {configured ? "Rotate secret" : "Generate secret"}
          </Button>
          {configured && (
            <Button variant="outline" onClick={revoke} disabled={busy}>
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
