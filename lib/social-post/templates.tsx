import React from "react";
import type { SocialPostRenderProps, SocialPostTemplateId } from "./types";

export const TEMPLATE_SIZE: Record<SocialPostTemplateId, { width: number; height: number }> = {
  classic: { width: 1080, height: 1350 },
  split: { width: 1080, height: 1080 },
  overlay: { width: 1080, height: 1350 },
  minimal: { width: 1080, height: 1350 },
  neon: { width: 1080, height: 1350 },
  chalkboard: { width: 1080, height: 1350 },
  polaroid: { width: 1080, height: 1350 },
  boldtype: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  print: { width: 1080, height: 1350 },
};

function hashtagLine(tags?: string[]) {
  if (!tags || !tags.length) return "";
  return tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join("  ");
}

// ── Template A — Classic Banner ─────────────────────────────────────────────
// Dark header banner w/ script headline -> full photo -> cream specials list -> footer hashtags
export function ClassicBanner(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5efe4",
        fontFamily: "Inter",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          backgroundColor: panelColor,
          padding: "36px 48px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: "#f5efe4",
            color: panelColor,
            fontSize: 28,
            fontWeight: 700,
            fontFamily: "Playfair Display",
            textAlign: "center",
          }}
        >
          {businessName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 22, color: "#f5efe4", opacity: 0.75, fontFamily: "Inter", fontWeight: 700 }}>
            {businessName}
          </span>
          <span style={{ fontSize: 64, color: accent, fontFamily: "Caveat", fontWeight: 700, lineHeight: 1 }}>
            {headline}
          </span>
        </div>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", width: "100%", height: 560 }}>
        <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Specials list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "40px 64px",
          gap: 18,
        }}
      >
        {items.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingBottom: 14,
              borderBottom: i < items.length - 1 ? "2px solid rgba(31,61,46,0.15)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display",
                fontWeight: 700,
                fontSize: 34,
                color: "#26261f",
                textAlign: "center",
              }}
            >
              {s.title}
            </span>
            {s.description ? (
              <span
                style={{
                  fontFamily: "Playfair Display",
                  fontStyle: "italic",
                  fontSize: 22,
                  color: "#5a5648",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {s.description}
              </span>
            ) : null}
          </div>
        ))}
        {tagline ? (
          <span
            style={{
              fontFamily: "Playfair Display",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 30,
              color: accent,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {tagline}
          </span>
        ) : null}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          backgroundColor: panelColor,
          padding: "20px 48px",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "Inter", fontSize: 18, color: "#f5efe4", opacity: 0.85, textAlign: "center" }}>
          {hashtagLine(hashtags)}
        </span>
      </div>
    </div>
  );
}

// ── Template B — Split Card ─────────────────────────────────────────────────
// White card, header strip, photo on left / specials panel on right
export function SplitCard(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "32px 48px 20px 48px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 36,
            border: `3px solid ${panelColor}`,
            color: panelColor,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "Playfair Display",
          }}
        >
          {businessName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: "#1c1c1c", fontFamily: "Playfair Display" }}>
            {businessName}
          </span>
          {tagline ? (
            <span style={{ fontSize: 20, color: "#666", fontFamily: "Inter" }}>{tagline}</span>
          ) : null}
        </div>
      </div>

      {/* Split body */}
      <div style={{ display: "flex", flex: 1, padding: "0 48px", gap: 20 }}>
        <div style={{ display: "flex", width: "46%", height: "100%", borderRadius: 18, overflow: "hidden" }}>
          <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "54%",
            backgroundColor: "#f7f1e6",
            borderRadius: 18,
            padding: "28px 32px",
            gap: 14,
          }}
        >
          <span
            style={{
              fontFamily: "Caveat",
              fontWeight: 700,
              fontSize: 48,
              color: accent,
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            {headline}
          </span>
          {items.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 24, color: "#1c1c1c" }}>
                {s.title}
              </span>
              {s.description ? (
                <span style={{ fontFamily: "Inter", fontSize: 17, color: "#555" }}>{s.description}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          backgroundColor: panelColor,
          padding: "22px 48px",
          marginTop: 24,
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "Inter", fontSize: 18, color: "#ffffff", opacity: 0.9, textAlign: "center" }}>
          {hashtagLine(hashtags)}
        </span>
      </div>
    </div>
  );
}

// ── Template C — Bold Overlay ───────────────────────────────────────────────
// Full-bleed photo with dark gradient overlay bottom 65%, all text over the image
export function BoldOverlay(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent } = props;
  const items = specials.slice(0, 4);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Inter" }}>
      <img
        src={photoDataUri}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 48,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "rgba(255,255,255,0.92)",
            color: "#1c1c1c",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "Playfair Display",
          }}
        >
          {businessName.slice(0, 2).toUpperCase()}
        </div>
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 26,
            color: "#ffffff",
          }}
        >
          {businessName}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 48,
          right: 48,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: 72,
            color: accent,
            lineHeight: 1,
          }}
        >
          {headline}
        </span>
        {items.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 32, color: "#ffffff" }}>
              {s.title}
            </span>
            {s.description ? (
              <span style={{ fontFamily: "Inter", fontSize: 20, color: "rgba(255,255,255,0.85)" }}>
                {s.description}
              </span>
            ) : null}
          </div>
        ))}
        {tagline ? (
          <span
            style={{
              fontFamily: "Playfair Display",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 26,
              color: accent,
              marginTop: 4,
            }}
          >
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
            {hashtagLine(hashtags)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template D — Minimal Card ───────────────────────────────────────────────
// Clean white bg, thin frame, small photo top-left, understated typography
export function MinimalCard(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: 56,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          border: "2px solid #1c1c1c",
          padding: 44,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 140, height: 140, borderRadius: 8, overflow: "hidden" }}>
            <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Inter", fontSize: 18, letterSpacing: 3, color: "#888" }}>
              {businessName.toUpperCase()}
            </span>
            <span
              style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 46, color: "#1c1c1c", marginTop: 4 }}
            >
              {headline}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-start", gap: 26, marginTop: 44 }}>
          {items.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
                <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 32, color: "#1c1c1c" }}>
                  {s.title}
                </span>
              </div>
              {s.description ? (
                <span style={{ fontFamily: "Inter", fontSize: 19, color: "#666", marginLeft: 20 }}>
                  {s.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {tagline ? (
          <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 24, color: accent }}>
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 16, color: "#999", marginTop: 10 }}>
            {hashtagLine(hashtags)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template E — Neon Night ──────────────────────────────────────────────────
// Dark bg, glowing neon-style accent text, bold sans — for bars / late-night spots
export function NeonNight(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b0b12",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", width: "100%", height: 480, position: "relative" }}>
        <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: "linear-gradient(180deg, rgba(11,11,18,0) 55%, rgba(11,11,18,1) 100%)",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 56px 48px 56px", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />
          <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 20, color: "#ffffff", letterSpacing: 4 }}>
            {businessName.toUpperCase()}
          </span>
        </div>
        <span
          style={{
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: 76,
            color: accent,
            lineHeight: 1,
            textShadow: `0 0 40px ${accent}`,
          }}
        >
          {headline}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 30, color: "#ffffff" }}>{s.title}</span>
              {s.description ? (
                <span style={{ fontFamily: "Inter", fontSize: 18, color: "rgba(255,255,255,0.6)" }}>
                  {s.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {tagline ? (
          <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 24, color: "#ffffff", opacity: 0.85 }}>
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 16, color: accent, marginTop: "auto" }}>
            {hashtagLine(hashtags)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template F — Chalkboard ──────────────────────────────────────────────────
// Dark chalkboard-style background, handwritten headline, classic pub specials board feel
export function Chalkboard(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#232b26",
        padding: 44,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          border: "3px dashed rgba(255,255,255,0.35)",
          padding: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "Inter", fontSize: 20, color: "rgba(255,255,255,0.6)", letterSpacing: 4 }}>
          {businessName.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: 84,
            color: "#ffffff",
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          {headline}
        </span>
        <div style={{ display: "flex", width: 200, height: 3, backgroundColor: accent, marginTop: 14, marginBottom: 26 }} />

        <div style={{ display: "flex", width: "100%", height: 320, borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
          <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
          {items.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontFamily: "Caveat", fontWeight: 700, fontSize: 38, color: accent }}>{s.title}</span>
              {s.description ? (
                <span style={{ fontFamily: "Inter", fontSize: 18, color: "rgba(255,255,255,0.75)" }}>
                  {s.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {tagline ? (
          <span style={{ fontFamily: "Caveat", fontWeight: 700, fontSize: 30, color: "#ffffff", marginTop: 22 }}>
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 15, color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
            {hashtagLine(hashtags)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template G — Polaroid Stack ─────────────────────────────────────────────
// Photo styled like a polaroid snapshot with a handwritten caption underneath
export function PolaroidStack(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 4);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#efe9dd",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 56px 40px 56px",
        fontFamily: "Inter",
      }}
    >
      <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 20, color: panelColor, letterSpacing: 4 }}>
        {businessName.toUpperCase()}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          padding: 20,
          marginTop: 24,
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", width: 620, height: 500 }}>
          <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <span
          style={{
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: 42,
            color: accent,
            textAlign: "center",
            marginTop: 14,
          }}
        >
          {headline}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32, alignItems: "center" }}>
        {items.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 26, color: "#26261f" }}>
              {s.title}
            </span>
            {s.description ? (
              <span style={{ fontFamily: "Inter", fontSize: 18, color: "#666" }}>— {s.description}</span>
            ) : null}
          </div>
        ))}
      </div>

      {tagline ? (
        <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 24, color: panelColor, marginTop: 20 }}>
          {tagline}
        </span>
      ) : null}
      {hashtags && hashtags.length ? (
        <span style={{ fontFamily: "Inter", fontSize: 16, color: "#888", marginTop: 14 }}>
          {hashtagLine(hashtags)}
        </span>
      ) : null}
    </div>
  );
}

// ── Template H — Big Bold Type ──────────────────────────────────────────────
// Giant typographic poster — text does the talking, photo tucked in a small frame
export function BigBoldType(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 3);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: panelColor,
        padding: 56,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 20, color: "#ffffff", letterSpacing: 4 }}>
          {businessName.toUpperCase()}
        </span>
        <div style={{ display: "flex", width: 100, height: 100, borderRadius: 12, overflow: "hidden" }}>
          <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <span
          style={{
            fontFamily: "Playfair Display",
            fontWeight: 700,
            fontSize: 88,
            color: "#ffffff",
            lineHeight: 1.05,
          }}
        >
          {headline}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 30 }}>
          {items.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 30, color: accent }}>{s.title}</span>
              {s.description ? (
                <span style={{ fontFamily: "Inter", fontSize: 19, color: "rgba(255,255,255,0.75)" }}>
                  {s.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {tagline ? (
          <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 24, color: "#ffffff", opacity: 0.85 }}>
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 10 }}>
            {hashtagLine(hashtags)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template I — Story (Vertical) ───────────────────────────────────────────
// Tall 9:16 layout sized for Instagram/Facebook Stories
export function StoryVertical(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5efe4",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", width: "100%", height: 860, position: "relative" }}>
        <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%)",
          }}
        />
        <div style={{ position: "absolute", top: 44, left: 44, display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: "rgba(255,255,255,0.92)",
              color: panelColor,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "Playfair Display",
            }}
          >
            {businessName.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 24, color: "#ffffff" }}>{businessName}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "40px 56px", gap: 20 }}>
        <span style={{ fontFamily: "Caveat", fontWeight: 700, fontSize: 68, color: accent, lineHeight: 1 }}>
          {headline}
        </span>
        {items.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 30, color: "#26261f" }}>
              {s.title}
            </span>
            {s.description ? (
              <span style={{ fontFamily: "Inter", fontSize: 19, color: "#5a5648" }}>{s.description}</span>
            ) : null}
          </div>
        ))}
        {tagline ? (
          <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 24, color: accent, marginTop: "auto" }}>
            {tagline}
          </span>
        ) : null}
        {hashtags && hashtags.length ? (
          <span style={{ fontFamily: "Inter", fontSize: 16, color: "#7a7668" }}>{hashtagLine(hashtags)}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Template J — Menu Print ─────────────────────────────────────────────────
// Cream background, ornate double border, printed table-card feel
export function MenuPrint(props: SocialPostRenderProps) {
  const { photoDataUri, businessName, headline, specials, tagline, hashtags, accent, panelColor } = props;
  const items = specials.slice(0, 5);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f3e7",
        padding: 36,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          border: `2px solid ${panelColor}`,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            border: `1px solid ${panelColor}`,
            alignItems: "center",
            justifyContent: "center",
            padding: "36px 40px",
          }}
        >
          <span style={{ fontFamily: "Inter", fontSize: 18, color: panelColor, letterSpacing: 5 }}>
            {businessName.toUpperCase()}
          </span>
          <span
            style={{
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: 50,
              color: "#26261f",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {headline}
          </span>
          <div style={{ display: "flex", width: 120, height: 2, backgroundColor: accent, marginTop: 14, marginBottom: 22 }} />

          <div style={{ display: "flex", width: "100%", height: 280, borderRadius: 4, overflow: "hidden", marginBottom: 26 }}>
            <img src={photoDataUri} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            {items.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 28, color: "#26261f" }}>
                  {s.title}
                </span>
                {s.description ? (
                  <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 19, color: "#5a5648" }}>
                    {s.description}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {tagline ? (
            <span style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 22, color: accent, marginTop: 20 }}>
              {tagline}
            </span>
          ) : null}
          {hashtags && hashtags.length ? (
            <span style={{ fontFamily: "Inter", fontSize: 15, color: "#8a8676", marginTop: 12 }}>
              {hashtagLine(hashtags)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function renderTemplate(id: SocialPostTemplateId, props: SocialPostRenderProps) {
  switch (id) {
    case "classic":
      return <ClassicBanner {...props} />;
    case "split":
      return <SplitCard {...props} />;
    case "overlay":
      return <BoldOverlay {...props} />;
    case "minimal":
      return <MinimalCard {...props} />;
    case "neon":
      return <NeonNight {...props} />;
    case "chalkboard":
      return <Chalkboard {...props} />;
    case "polaroid":
      return <PolaroidStack {...props} />;
    case "boldtype":
      return <BigBoldType {...props} />;
    case "story":
      return <StoryVertical {...props} />;
    case "print":
      return <MenuPrint {...props} />;
  }
}
