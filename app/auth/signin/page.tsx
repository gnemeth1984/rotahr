"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, Lock, Loader2, Eye, EyeOff, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import Link from "next/link";

const DEMO_ACCOUNTS = [
  { role: "General Manager", email: "sarah.connolly@rotahr.demo", password: "Demo1234!", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { role: "Operations Mgr", email: "tony.brennan@rotahr.demo", password: "Demo1234!", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { role: "Head Chef", email: "marco.deluca@rotahr.demo", password: "Demo1234!", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { role: "Bar Manager", email: "fiona.mccarthy@rotahr.demo", password: "Demo1234!", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { role: "Bartender", email: "tommy.ryan@rotahr.demo", password: "Demo1234!", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
];

function DemoPanel({ onSelect }: { onSelect: (email: string, password: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-semibold text-orange-300">Try the Demo</span>
          <span className="text-xs text-orange-400/70 font-normal">— The Anchor &amp; Tap</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-orange-400/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-orange-400/60" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2">
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            One-click login as any role. Pre-loaded with shifts, bookings, expenses, and more.
          </p>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => onSelect(account.email, account.password)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 border transition-all hover:scale-[1.01] active:scale-[0.99] hover:border-orange-500/50 hover:bg-orange-500/10 bg-slate-800/40 border-slate-700/50 group"
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${account.color}`}>
                  {account.role}
                </span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate max-w-[160px]">
                  {account.email}
                </span>
              </div>
              <span className="text-[11px] text-orange-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">
                Login →
              </span>
            </button>
          ))}
          <p className="text-[11px] text-slate-500 pt-1">Password for all accounts: <code className="text-slate-400">Demo1234!</code></p>
        </div>
      )}
    </div>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/rota";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  const handleDemoSelect = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email: demoEmail,
        password: demoPassword,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError("Demo login failed — please try again.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DemoPanel onSelect={handleDemoSelect} />

      <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
        {/* Google */}
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
            <span className="bg-slate-800 px-2 text-slate-500">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg">
              {error}
            </p>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Link href="/auth/forgot-password" className="text-xs text-blue-400 hover:text-blue-300">Forgot password?</Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Sign in
          </Button>
        </form>
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-start justify-center p-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">Rotahr</span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">Sign in to your workspace</p>
        </div>
        <Suspense
          fallback={
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-400">
              Loading...
            </div>
          }
        >
          <SignInForm />
        </Suspense>
        <p className="text-center text-sm text-slate-400 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Start free trial
          </Link>
        </p>
        <p className="text-center text-xs text-slate-500 mt-3">
          By signing in, you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-400">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-slate-400">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
