"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Briefcase, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Create account
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setLoading(false);
        return;
      }

      // 2. Auto sign-in
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        callbackUrl: "/onboarding",
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created — please sign in to continue.");
        router.push("/auth/signin");
        return;
      }

      // 3. Redirect to onboarding
      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    // Google OAuth will create account if new, then middleware redirects to /onboarding if no businessId
    await signIn("google", { callbackUrl: "/onboarding" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-start justify-center p-6 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">Rotahr</span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">Create your free account</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
          {/* Free trial badge */}
          <div className="mb-6 text-center">
            <span className="inline-block bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1 rounded-full">
              Simple, transparent pricing from €59/month incl. VAT
            </span>
          </div>

          {/* Google sign-up */}
          <Button
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 bg-slate-700/50 gap-2 mb-6"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-800 px-2 text-slate-500">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Your name</Label>
              <Input
                id="name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Jane Murphy"
                required
                autoComplete="name"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Work email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jane@yourbar.com"
                required
                autoComplete="email"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-slate-300">Business name</Label>
              <Input
                id="businessName"
                type="text"
                value={form.businessName}
                onChange={set("businessName")}
                placeholder="e.g. Christy's Bar"
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>

            {/* Consent checkbox — required for GDPR Art.6 / Irish ePrivacy */}
            <div className="flex items-start gap-3 pt-1">
              <input
                id="agree"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 accent-blue-500 cursor-pointer flex-shrink-0"
                required
              />
              <label htmlFor="agree" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                I have read and agree to Rotahr's{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Privacy Policy</a>.
                I confirm I am authorised to add staff data on behalf of my business and that staff have been informed their data will be stored and processed for HR and payroll purposes.
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2 mt-2"
              disabled={loading || !agreed}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {loading ? "Creating account…" : "Create free account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
