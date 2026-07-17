"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gift, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Offer {
  id: string;
  code: string;
  title: string;
  description: string;
  redeemed: boolean;
  redeemedAt: string | null;
  expiresAt: string | null;
  customer: { name: string };
}

export default function RedeemOfferPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/crm/offers/by-code/${encodeURIComponent(code)}`);
    if (res.ok) {
      setOffer((await res.json()).offer);
      setNotFound(false);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [code]);

  const setRedeemed = async (redeemed: boolean) => {
    if (!offer) return;
    setActing(true);
    try {
      const res = await fetch(`/api/crm/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeemed }),
      });
      if (res.ok) await load();
    } finally {
      setActing(false);
    }
  };

  const isExpired = offer?.expiresAt && new Date(offer.expiresAt) < new Date();

  return (
    <div className="mx-auto max-w-md py-10">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : notFound ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <XCircle className="h-8 w-8 text-red-400" />
            <p className="font-medium text-slate-700">Offer not found</p>
            <p className="text-sm text-slate-400">
              This code doesn't match any offer for your business — double-check it was typed/scanned
              correctly.
            </p>
          </CardContent>
        </Card>
      ) : offer ? (
        <Card className={offer.redeemed ? "border-slate-200 bg-slate-50" : "border-indigo-200"}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-indigo-600" />
              <CardTitle>{offer.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">{offer.description}</p>
            <div className="text-sm">
              <span className="text-slate-400">For:</span>{" "}
              <span className="font-medium text-slate-800">{offer.customer.name}</span>
            </div>
            <code className="block w-fit rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-sm">
              {offer.code}
            </code>

            {isExpired && !offer.redeemed && (
              <Badge variant="destructive">Expired {new Date(offer.expiresAt!).toLocaleDateString("en-IE")}</Badge>
            )}

            {offer.redeemed ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Redeemed {offer.redeemedAt ? new Date(offer.redeemedAt).toLocaleString("en-IE") : ""}
              </div>
            ) : (
              <Button
                onClick={() => setRedeemed(true)}
                disabled={acting}
                className="w-full gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark as redeemed
              </Button>
            )}

            {offer.redeemed && (
              <Button variant="outline" size="sm" onClick={() => setRedeemed(false)} disabled={acting} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Undo (wasn't actually redeemed)
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
