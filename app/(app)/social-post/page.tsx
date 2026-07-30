"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Upload, ImageIcon, Plus, Trash2, Loader2, Download, Sparkles, X } from "lucide-react";
import { TEMPLATE_OPTIONS, ACCENT_PRESETS, type SocialPostTemplateId } from "@/lib/social-post/types";

interface DishOption {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface MenuSpecialOption {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

interface SpecialLine {
  key: string;
  title: string;
  description?: string;
}

export default function SocialPostPage() {
  const { data: session } = useSession();

  const [businessName, setBusinessName] = useState("Our Place");
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [specialOptions, setSpecialOptions] = useState<MenuSpecialOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Specials to include
  const [lines, setLines] = useState<SpecialLine[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  // Copy
  const [headline, setHeadline] = useState("Today's Specials");
  const [tagline, setTagline] = useState("Come for a drink and a bite!");
  const [hashtagsInput, setHashtagsInput] = useState("");

  // Style
  const [templateId, setTemplateId] = useState<SocialPostTemplateId>("classic");
  const [accentIdx, setAccentIdx] = useState(0);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [bizRes, dishRes, specialRes] = await Promise.all([
          fetch("/api/business/settings"),
          fetch("/api/menu/dishes"),
          fetch("/api/menu-specials"),
        ]);
        if (bizRes.ok) {
          const biz = await bizRes.json();
          if (biz.name) setBusinessName(biz.name);
          if (biz.name) setHashtagsInput(`#${biz.name.replace(/\s+/g, "")}`);
        }
        if (dishRes.ok) {
          const data = await dishRes.json();
          setDishes((data.dishes || []).filter((d: DishOption) => d.imageUrl));
        }
        if (specialRes.ok) {
          const data = await specialRes.json();
          setSpecialOptions((Array.isArray(data) ? data : []).slice(0, 30));
        }
      } catch {
        // non-fatal — form still usable
      } finally {
        setLoadingOptions(false);
      }
    }
    load();
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/menu/dishes/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotoUrl(data.url);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addExistingSpecial(s: MenuSpecialOption) {
    if (lines.some((l) => l.key === s.id)) return;
    setLines((prev) => [...prev, { key: s.id, title: s.title, description: s.description || undefined }]);
    if (!photoUrl && s.imageUrl) setPhotoUrl(s.imageUrl);
  }

  function addCustomLine() {
    if (!customTitle.trim()) return;
    setLines((prev) => [
      ...prev,
      { key: `custom-${Date.now()}`, title: customTitle.trim(), description: customDesc.trim() || undefined },
    ]);
    setCustomTitle("");
    setCustomDesc("");
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function generate() {
    if (!photoUrl) {
      setError("Pick or upload a photo first.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one special.");
      return;
    }
    setError(null);
    setGenerating(true);
    setResultUrl(null);
    try {
      const preset = ACCENT_PRESETS[accentIdx];
      const hashtags = hashtagsInput
        .split(/[\s,]+/)
        .map((h) => h.trim())
        .filter(Boolean);

      const res = await fetch("/api/social-post/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl,
          templateId,
          businessName,
          headline,
          tagline,
          hashtags,
          accent: preset.accent,
          panelColor: preset.panel,
          specials: lines.map((l) => ({ title: l.title, description: l.description })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate image");
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e.message || "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-7 h-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">Social Post Creator</h1>
          <p className="text-sm text-muted-foreground">
            Turn today's specials into a ready-to-share image for Facebook &amp; Instagram.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: builder */}
        <div className="space-y-5">
          {/* Photo */}
          <Card className="p-4 space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Photo
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload new photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </div>
            {dishes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Or use an existing dish photo:</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dishes.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setPhotoUrl(d.imageUrl)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${
                        photoUrl === d.imageUrl ? "border-orange-500" : "border-transparent"
                      }`}
                      title={d.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.imageUrl || ""} alt={d.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {photoUrl && (
              <div className="relative w-full h-40 rounded-md overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Selected" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </Card>

          {/* Specials */}
          <Card className="p-4 space-y-3">
            <Label className="text-base font-semibold">Specials to feature</Label>
            {specialOptions.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Add from your Menu Specials:</p>
                <div className="flex flex-wrap gap-2">
                  {specialOptions.map((s) => (
                    <Badge
                      key={s.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-orange-50"
                      onClick={() => addExistingSpecial(s)}
                    >
                      + {s.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 border rounded-md p-3">
              <p className="text-xs text-muted-foreground">Or type a new one:</p>
              <Input placeholder="Title (e.g. BBQ Wings)" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
              <Textarea
                placeholder="Description (optional)"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                rows={2}
              />
              <Button size="sm" variant="secondary" onClick={addCustomLine} disabled={!customTitle.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            {lines.length > 0 && (
              <div className="space-y-2 mt-2">
                {lines.map((l) => (
                  <div key={l.key} className="flex items-start justify-between gap-2 bg-muted/40 rounded-md p-2">
                    <div>
                      <p className="font-medium text-sm">{l.title}</p>
                      {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                    </div>
                    <button onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Copy */}
          <Card className="p-4 space-y-3">
            <Label className="text-base font-semibold">Wording</Label>
            <div>
              <Label className="text-xs">Headline</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tagline (optional)</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hashtags</Label>
              <Input value={hashtagsInput} onChange={(e) => setHashtagsInput(e.target.value)} placeholder="#yourpub #specials" />
            </div>
          </Card>

          {/* Style */}
          <Card className="p-4 space-y-3">
            <Label className="text-base font-semibold">Style</Label>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left border rounded-md p-3 ${
                    templateId === t.id ? "border-orange-500 bg-orange-50" : "border-muted"
                  }`}
                >
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs mb-1 block">Color theme</Label>
              <Select value={String(accentIdx)} onValueChange={(v) => setAccentIdx(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCENT_PRESETS.map((p, i) => (
                    <SelectItem key={p.label} value={String(i)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={generate} disabled={generating || loadingOptions} className="w-full" size="lg">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate image
          </Button>
        </div>

        {/* Right: preview */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Preview</Label>
          <Card className="p-4 flex items-center justify-center min-h-[420px] bg-muted/30">
            {resultUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultUrl} alt="Generated social post" className="max-w-full max-h-[560px] rounded-md shadow" />
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Fill in the details on the left and click "Generate image" to see your post here.
              </p>
            )}
          </Card>
          {resultUrl && (
            <a href={resultUrl} download="rotahr-social-post.png">
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Download image
              </Button>
            </a>
          )}
          <p className="text-xs text-muted-foreground">
            Download the image, then post it manually on your Facebook Page or Instagram — direct auto-posting isn't available yet.
          </p>
        </div>
      </div>
    </div>
  );
}
