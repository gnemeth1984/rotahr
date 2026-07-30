export type SocialPostTemplateId =
  | "classic"
  | "split"
  | "overlay"
  | "minimal"
  | "neon"
  | "chalkboard"
  | "polaroid"
  | "boldtype"
  | "story"
  | "print";

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
  {
    id: "minimal",
    label: "Minimal Card",
    description: "Clean white background, thin frame, small photo — understated and modern.",
  },
  {
    id: "neon",
    label: "Neon Night",
    description: "Dark background with glowing neon accent text — great for bars & late-night spots.",
  },
  {
    id: "chalkboard",
    label: "Chalkboard",
    description: "Dark chalkboard look with a handwritten-style headline — classic pub specials board.",
  },
  {
    id: "polaroid",
    label: "Polaroid Stack",
    description: "Photo styled like a polaroid snapshot with a handwritten caption underneath.",
  },
  {
    id: "boldtype",
    label: "Big Bold Type",
    description: "Giant typographic poster style with the photo tucked in a small frame — text does the talking.",
  },
  {
    id: "story",
    label: "Story (Vertical)",
    description: "Tall 9:16 layout sized for Instagram/Facebook Stories — photo top, specials below.",
  },
  {
    id: "print",
    label: "Menu Print",
    description: "Cream background with an ornate double border — looks like a printed table card.",
  },
];

export const ACCENT_PRESETS = [
  { label: "Terracotta", accent: "#d9662b", panel: "#1f3d2e" },
  { label: "Burgundy", accent: "#e0a458", panel: "#3b1420" },
  { label: "Charcoal & Gold", accent: "#e3b23c", panel: "#1c1c1c" },
  { label: "Navy & Coral", accent: "#ff6b5b", panel: "#0f1c35" },
];
