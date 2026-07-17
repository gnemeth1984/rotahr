export interface OfferPreset {
  id: "birthday" | "winback" | "vip" | "welcome" | "custom";
  label: string;
  title: string;
  description: string;
  codePrefix: string;
  why: string; // shown in the UI to explain when/why to use this
}

export const OFFER_PRESETS: OfferPreset[] = [
  {
    id: "birthday",
    label: "Birthday drink",
    title: "Happy Birthday! 🎉",
    description: "Enjoy a free drink on us during your birthday month — see you soon!",
    codePrefix: "BDAY",
    why: "Sent automatically around a customer's birthday — one of the highest open-rate emails you can send, and it costs you one drink to bring someone back in the door.",
  },
  {
    id: "winback",
    label: "Win-back offer",
    title: "We miss you!",
    description: "It's been a while since your last visit — here's a free coffee on us next time you're in.",
    codePrefix: "WINBACK",
    why: "For customers who haven't been back in a while (check 'Last visit' on their profile). A small free item is usually cheaper than the ad spend it'd take to win a totally new customer.",
  },
  {
    id: "vip",
    label: "VIP thank-you",
    title: "Thank you for being a regular!",
    description: "As a thank you for choosing us again and again, enjoy a free drink on your next visit.",
    codePrefix: "VIP",
    why: "For your most frequent visitors (check visit count on their profile). Regulars rarely get thanked directly — it's cheap to do and it's exactly the group most likely to tell friends.",
  },
  {
    id: "welcome",
    label: "First-visit welcome",
    title: "Welcome — thanks for stopping by!",
    description: "Thanks for visiting us for the first time. Here's a free coffee on your next visit, on us.",
    codePrefix: "WELCOME",
    why: "For brand-new customers after their first booking. A small gesture like this is what turns a one-time visitor into a repeat customer.",
  },
  {
    id: "custom",
    label: "Custom offer",
    title: "",
    description: "",
    codePrefix: "OFFER",
    why: "Write your own — e.g. a specific discount, a seasonal promotion, or an apology after a bad experience.",
  },
];

export function getPreset(id: string): OfferPreset {
  return OFFER_PRESETS.find((p) => p.id === id) || OFFER_PRESETS[4];
}

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateOfferCode(customerName: string, codePrefix: string) {
  const namePart = (customerName.split(" ")[0] || "GUEST").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "GUEST";
  return `${namePart}-${codePrefix}-${randomSuffix()}`;
}
