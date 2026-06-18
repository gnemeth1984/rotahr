"use client";

import { useState } from "react";
import { Briefcase, Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      setSent(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">Rotahr</span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">Reset your password</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600/20 rounded-full mx-auto">
                <Mail className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-white font-medium">Check your email</p>
              <p className="text-slate-400 text-sm">If an account exists for <strong className="text-slate-300">{email}</strong>, we've sent a reset link. It expires in 1 hour.</p>
              <Link href="/auth/signin">
                <Button variant="outline" className="w-full mt-2 border-slate-600 text-slate-300 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">{error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send reset link
              </Button>
              <Link href="/auth/signin">
                <Button variant="ghost" className="w-full text-slate-400 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to sign in
                </Button>
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
