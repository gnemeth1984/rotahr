"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import Link from "next/link";

export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    const dismissed = localStorage.getItem("pwa-banner-dismissed");

    if (!isStandalone && !dismissed) {
      // Show after 3 seconds
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-4 flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-lg flex-shrink-0">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Add to your home screen</p>
          <p className="text-slate-400 text-xs mt-0.5">Get instant notifications and quick access</p>
          <Link
            href="/install"
            onClick={dismiss}
            className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            See how to install →
          </Link>
        </div>
        <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
