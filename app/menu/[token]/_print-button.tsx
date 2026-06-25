"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-white border border-stone-300 text-stone-700 px-4 py-2 rounded-lg shadow text-sm hover:bg-stone-100 transition"
    >
      <Printer className="h-4 w-4" />Print / Save PDF
    </button>
  );
}
