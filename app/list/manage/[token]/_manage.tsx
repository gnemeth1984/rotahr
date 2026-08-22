"use client";

import { useEffect, useRef, useState } from "react";

interface Listing {
  id: string;
  name: string;
  slug: string;
  live: boolean;
  heroImage: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
}

/** Mirrors publicImageSrc on the server — the blob store is private. */
function imageSrc(url: string | null) {
  if (!url) return null;
  if (!url.includes("blob.vercel-storage.com")) return url;
  return `/api/public/venue-image?url=${encodeURIComponent(url)}`;
}

export function ManageListing({ token, site }: { token: string; site: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  function hydrate(l: Listing) {
    setListing(l);
    setTagline(l.tagline ?? "");
    setAbout(l.about ?? "");
    setAddress(l.address ?? "");
    setPhone(l.phone ?? "");
    setWebsite(l.website ?? "");
  }

  // Loading the page is what publishes it — the GET proves the mailbox.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/listing/${token}`);
        if (!res.ok) {
          if (!cancelled) setGone(true);
          return;
        }
        const json = await res.json();
        if (!cancelled) hydrate(json.listing);
      } catch {
        if (!cancelled) setGone(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function uploadCover(file: File) {
    setUploading(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/public/listing/${token}`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Upload failed.");
        return;
      }
      hydrate(json.listing);
      setNote("Cover photo saved.");
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/public/listing/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagline, about, address, phone, website }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Couldn't save.");
        return;
      }
      hydrate(json.listing);
      setNote("Details saved.");
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-400">Loading your page…</p>;
  }

  if (gone || !listing) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-3">This link is no longer valid</h1>
        <p className="text-slate-300 mb-6 leading-relaxed">
          Manage links are replaced whenever a new one is requested, and they stop working
          once a venue moves onto a full Rotahr account. Request a fresh one and we&apos;ll
          email it over.
        </p>
        <a
          href="/list"
          className="inline-block rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-6 py-3 font-semibold"
        >
          Get a new link
        </a>
      </div>
    );
  }

  const label = "block text-sm font-medium text-slate-200 mb-1.5";
  const input =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 " +
    "focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35] transition-colors";
  const cover = imageSrc(listing.heroImage);
  const pageUrl = `${site.replace(/\/$/, "")}/v/${listing.slug}`;

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Your page is live
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{listing.name}</h1>
        <a
          href={`/v/${listing.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#ff6b35] hover:underline break-all"
        >
          {pageUrl} ↗
        </a>
      </div>

      {note && (
        <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          {note}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Cover photo */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold mb-1">Cover photo</h2>
        <p className="text-sm text-slate-400 mb-4">
          The main image at the top of your page. Landscape works best.
        </p>

        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${listing.name} cover`}
            className="w-full h-48 sm:h-64 object-cover rounded-xl mb-4"
          />
        ) : (
          <div className="w-full h-48 sm:h-64 rounded-xl mb-4 border border-dashed border-white/15 bg-white/[0.02] flex items-center justify-center text-slate-500 text-sm">
            No cover photo yet
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadCover(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading…" : cover ? "Replace photo" : "Upload photo"}
        </button>
        <p className="text-xs text-slate-500 mt-3">JPG or PNG, up to 8MB.</p>
      </section>

      {/* Details */}
      <form onSubmit={saveDetails} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div>
          <h2 className="font-semibold mb-1">Your details</h2>
          <p className="text-sm text-slate-400">Everything here shows on your public page.</p>
        </div>

        <div>
          <label className={label} htmlFor="tagline">
            Tagline
          </label>
          <input
            id="tagline"
            className={input}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Seafood and stout on the harbour"
            maxLength={160}
          />
        </div>

        <div>
          <label className={label} htmlFor="about">
            About
          </label>
          <textarea
            id="about"
            className={`${input} min-h-[120px] resize-y`}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="A few lines about the place — what you serve, what makes it worth the trip."
            maxLength={2000}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Adding an about section and a photo is what gets your page into Google.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="address">
            Address
          </label>
          <input
            id="address"
            className={input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={300}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={label} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className={input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className={label} htmlFor="website">
              Website
            </label>
            <input
              id="website"
              className={input}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-6 py-3 font-semibold disabled:opacity-50 transition-opacity hover:opacity-95"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
      </form>

      <p className="text-xs text-slate-500 leading-relaxed">
        Keep the email with this link — it&apos;s how you get back in to edit. No password
        needed. Want bookings, rotas and food-safety records too?{" "}
        <a href="/" className="text-[#ff6b35] hover:underline">
          See what else Rotahr does
        </a>
        .
      </p>
    </div>
  );
}
