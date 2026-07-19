"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Gift, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle } from "lucide-react";

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

type ScanState = "scanning" | "checking" | "result";

export default function ScanOfferPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string | null>(null);

  const [state, setState] = useState<ScanState>("scanning");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const extractCode = (raw: string): string | null => {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("redeem");
      if (idx !== -1 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
      return null;
    } catch {
      // Not a URL — treat the raw scanned text as the code itself
      return raw.trim() || null;
    }
  };

  const handleDetected = useCallback(async (rawText: string) => {
    const code = extractCode(rawText);
    if (!code || code === lastCodeRef.current) return;
    lastCodeRef.current = code;

    setState("checking");
    setResultError(null);

    try {
      const res = await fetch(`/api/crm/offers/by-code/${encodeURIComponent(code)}`);
      if (!res.ok) {
        setResultError("This code doesn't match any offer for your business.");
        setOffer(null);
        setState("result");
        return;
      }
      const { offer: found } = await res.json();
      setOffer(found);

      const isExpired = found.expiresAt && new Date(found.expiresAt) < new Date();
      if (found.redeemed) {
        setResultError(`Already redeemed ${found.redeemedAt ? new Date(found.redeemedAt).toLocaleString("en-IE") : ""}`);
        setState("result");
        return;
      }
      if (isExpired) {
        setResultError(`This offer expired ${new Date(found.expiresAt).toLocaleDateString("en-IE")}`);
        setState("result");
        return;
      }

      // Valid, unredeemed, not expired — redeem it immediately, no extra tap
      setRedeeming(true);
      const redeemRes = await fetch(`/api/crm/offers/${found.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeemed: true }),
      });
      if (redeemRes.ok) {
        setOffer({ ...found, redeemed: true, redeemedAt: new Date().toISOString() });
      } else {
        setResultError("Found the offer but couldn't mark it redeemed — try again.");
      }
      setRedeeming(false);
      setState("result");
    } catch {
      setResultError("Something went wrong looking up this code.");
      setState("result");
    }
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

    if (code?.data && state === "scanning") {
      handleDetected(code.data);
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [state, handleDetected]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (err: any) {
        setCameraError(
          err?.name === "NotAllowedError"
            ? "Camera permission denied — allow camera access to scan offers."
            : "Couldn't access the camera on this device."
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanAgain = () => {
    lastCodeRef.current = null;
    setOffer(null);
    setResultError(null);
    setState("scanning");
  };

  return (
    <div className="mx-auto max-w-md py-8 px-4">
      <div className="mb-4 flex items-center gap-2">
        <Camera className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-gray-900">Scan Offer QR Code</h1>
      </div>

      {state !== "result" && (
        <Card className="overflow-hidden border-indigo-200">
          <div className="relative bg-black aspect-square">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraError && (
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" />
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 p-6 text-center text-white">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
                <p className="text-sm">{cameraError}</p>
              </div>
            )}
          </div>
          <CardContent className="py-3 text-center text-sm text-gray-500">
            {state === "checking" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> {redeeming ? "Redeeming…" : "Checking code…"}
              </span>
            ) : (
              "Point the camera at the guest's offer QR code"
            )}
          </CardContent>
        </Card>
      )}

      {state === "result" && (
        <Card className={offer?.redeemed && !resultError ? "border-emerald-200" : "border-amber-200"}>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {offer?.redeemed && !resultError?.startsWith("Already") ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <div>
                  <p className="font-semibold text-gray-900">{offer.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Redeemed for {offer.customer.name}</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✓ Redeemed just now</Badge>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 text-amber-500" />
                <div>
                  {offer && <p className="font-semibold text-gray-900">{offer.title}</p>}
                  <p className="text-sm text-gray-500 mt-0.5">{resultError}</p>
                </div>
              </>
            )}
            <Button onClick={scanAgain} className="mt-2 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <RotateCcw className="h-4 w-4" /> Scan next
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs text-gray-400">
        <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Valid, unexpired offers redeem automatically the moment they're scanned — no extra tap needed.
      </p>
    </div>
  );
}
