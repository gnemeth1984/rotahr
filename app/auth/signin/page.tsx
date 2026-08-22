"use client";

/**
 * Sign in.
 *
 * Light theme on purpose. This page used to be dark navy while the landing page
 * is white, so clicking a marketing CTA handed the visitor into what looked like
 * a different product.
 *
 * The big one-click demo panel that used to live at the top of this page is gone —
 * it now has a page of its own at /try (the demo chooser), which is where the
 * landing CTA points. A page that says "Sign in" is the wrong place to browse a
 * demo from, and the analytics said so: 128 anonymous views on this page against
 * 2 on /auth/register in the same 30 days. What's left here is one line pointing
 * at /try for anyone who arrived by accident.
 *
 * Hand-typed @rotahr.demo logins still route via /demo/preparing, so they get the
 * same protection against landing mid-reset.
 */

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Eye, EyeOff, FlaskConical, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

function DemoNudge() {
  return (
    <Link
      href="/try"
      className="group mb-5 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 px-5 py-4 transition-all hover:border-orange-300 hover:bg-orange-50"
    >
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#F97316" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#C2410C" }}>
            Just looking? Try the live demo
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            A real venue with staff, rotas and bookings in it. No signup, no card.
          </p>
        </div>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-orange-400 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
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
        // A demo account typed in by hand gets the same interstitial as /try: it
        // forwards immediately unless a scheduled reset is mid-flight.
        if (email.trim().toLowerCase().endsWith("@rotahr.demo")) {
          window.location.href = `/demo/preparing?next=${encodeURIComponent(
            new URL(result.url, window.location.origin).pathname
          )}`;
          return;
        }
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

  return (
    <>
      <DemoNudge />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Google */}
        <Button
          variant="outline"
          className="mb-6 w-full gap-2 border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-slate-400">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-400"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-slate-500 underline hover:text-slate-800"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="border-slate-200 bg-white pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-orange-400"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full gap-2 text-white hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
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
    <div className="flex min-h-screen items-start justify-center bg-slate-50 p-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/logo-light.png"
              alt="Rotahr"
              width={120}
              height={38}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>
          <h1 className="mt-3 text-sm font-normal text-slate-500">
            Sign in to your workspace
          </h1>
        </div>
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              Loading...
            </div>
          }
        >
          <SignInForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium underline" style={{ color: "#C2410C" }}>
            Start your first month free
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          By signing in, you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-600">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
