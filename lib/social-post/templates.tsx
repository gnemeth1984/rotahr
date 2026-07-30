import React from "react";
import type { SocialPostRenderProps, SocialPostTemplateId } from "./types";

export const TEMPLATE_SIZE: Record<SocialPostTemplateId, { width: number; height: number }> = {
  classic: { width: 1080, height: 1350 },
  split: { width: 1080, height: 1080 },
  overlay: { width: 1080, height: 1350 },
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

export function renderTemplate(id: SocialPostTemplateId, props: SocialPostRenderProps) {
  switch (id) {
    case "classic":
      return <ClassicBanner {...props} />;
    case "split":
      return <SplitCard {...props} />;
    case "overlay":
      return <BoldOverlay {...props} />;
  }
}
