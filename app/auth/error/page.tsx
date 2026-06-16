"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification:
    "The sign-in link is no longer valid. It may have been used already or it has expired.",
  Default: "An error occurred during sign in.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="bg-slate-800/60 border border-red-900/50 rounded-2xl p-8">
      <div className="h-16 w-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h1 className="text-xl font-semibold text-white mb-3">Sign in error</h1>
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <Link href="/auth/signin">
        <Button className="bg-blue-600 hover:bg-blue-700 w-full">
          Try again
        </Button>
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Briefcase className="h-8 w-8 text-blue-400" />
          <span className="text-2xl font-bold text-white">Rotahr</span>
        </Link>
        <Suspense
          fallback={
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8">
              <p className="text-slate-400">Loading...</p>
            </div>
          }
        >
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
