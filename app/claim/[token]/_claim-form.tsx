"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function ClaimForm({ token, slug }: { token: string; slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/claim/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name, email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }

    // Sign straight in — making someone re-type the password they just set is
    // the easiest place to lose them.
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (signInResult?.error) {
      // The account exists; only the auto-login failed. Send them to sign in
      // rather than implying the claim didn't work.
      router.push("/auth/signin?claimed=1");
      return;
    }

    router.push("/dashboard");
  }

  const field =
    "w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B35]";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="claim-name" className="block text-sm text-slate-300 mb-1.5">
          Your name
        </label>
        <input
          id="claim-name"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label htmlFor="claim-email" className="block text-sm text-slate-300 mb-1.5">
          Your email
        </label>
        <input
          id="claim-email"
          type="email"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label htmlFor="claim-password" className="block text-sm text-slate-300 mb-1.5">
          Choose a password
        </label>
        <input
          id="claim-password"
          type="password"
          className={field}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-slate-500 mt-1.5">At least 8 characters.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {busy ? "Claiming…" : `Claim /v/${slug}`}
      </button>
    </form>
  );
}
