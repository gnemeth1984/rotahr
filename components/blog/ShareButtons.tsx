"use client";

import { useState } from "react";
import { Link2, Check, Mail } from "lucide-react";

interface Props {
  title: string;
  slug: string;
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.554V9h3.565v11.452z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.462h-1.26c-1.243 0-1.63.771-1.63 1.562v1.878h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94z" />
    </svg>
  );
}

export default function ShareButtons({ title, slug }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `https://rotahr.com/blog/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      label: "LinkedIn",
      Icon: LinkedInIcon,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2]",
    },
    {
      label: "X",
      Icon: XIcon,
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: "hover:bg-black hover:text-white hover:border-black",
    },
    {
      label: "Facebook",
      Icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]",
    },
    {
      label: "Email",
      Icon: Mail,
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
      color: "hover:bg-gray-700 hover:text-white hover:border-gray-700",
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-400 mr-1">Share:</span>
      {shareLinks.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Share on ${s.label}`}
          className={`h-9 w-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors ${s.color}`}
        >
          <s.Icon className="h-4 w-4" />
        </a>
      ))}
      <button
        onClick={handleCopy}
        title="Copy link"
        className={`h-9 flex items-center gap-1.5 px-3 rounded-full border text-sm font-medium transition-colors ${
          copied
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
