export type SocialPostTemplateId = "classic" | "split" | "overlay";

export interface SocialPostSpecialInput {
  title: string;
  description?: string;
}

export interface SocialPostRenderProps {
  photoDataUri: string;
  businessName: string;
  headline: string;
  specials: SocialPostSpecialInput[];
  tagline?: string;
  hashtags?: string[];
  accent: string; // hex accent color, e.g. #d9662b
  panelColor: string; // header/panel base color, e.g. #1f3d2e
}

export const TEMPLATE_OPTIONS: { id: SocialPostTemplateId; label: string; description: string }[] = [
  {
    id: "classic",
    label: "Classic Banner",
    description: "Full photo, branded header banner, specials list below, hashtag footer.",
  },
  {
    id: "split",
    label: "Split Card",
    description: "Photo on one side, specials panel on the other — like a printed table card.",
  },
  {
    id: "overlay",
    label: "Bold Overlay",
    description: "Full-bleed photo with a dark gradient and specials text overlaid on top.",
  },
];

export const ACCENT_PRESETS = [
  { label: "Terracotta", accent: "#d9662b", panel: "#1f3d2e" },
  { label: "Burgundy", accent: "#e0a458", panel: "#3b1420" },
  { label: "Charcoal & Gold", accent: "#e3b23c", panel: "#1c1c1c" },
  { label: "Navy & Coral", accent: "#ff6b5b", panel: "#0f1c35" },
];
