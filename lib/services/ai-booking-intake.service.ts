// @ts-nocheck
import { prisma } from "@/lib/db";
import { tableService } from "./table.service";
import { reservationService } from "./reservation.service";
import * as chrono from "chrono-node";

// ─── NLP helpers ──────────────────────────────────────────────────────────────

function extractPartySize(msg: string): number | null {
  // "12 people", "table for 4", "party of 6", "8 guests", "just 2"
  const patterns = [
    /(?:party of|table for|group of|for)\s+(\d+)/i,
    /(\d+)\s+(?:people|persons?|guests?|covers?|pax)/i,
    /just\s+(\d+)/i,
    /(\d+)\s+of\s+us/i,
  ];
  for (const re of patterns) {
    const m = msg.match(re);
    if (m) return parseInt(m[1]);
  }
  // Bare number as last resort if small
  const bare = msg.match(/\b([1-9][0-9]?)\b/);
  if (bare) return parseInt(bare[1]);
  return null;
}

function extractOccasion(msg: string): string | null {
  const occasions = [
    "birthday",
    "anniversary",
    "wedding",
    "engagement",
    "graduation",
    "christmas",
    "valentines",
    "hen party",
    "stag party",
    "work dinner",
    "business dinner",
    "leaving do",
  ];
  const l = msg.toLowerCase();
  for (const o of occasions) {
    if (l.includes(o)) return o;
  }
  return null;
}

function extractDietary(msg: string): string | null {
  const dietary = [
    "vegan",
    "vegetarian",
    "gluten.free",
    "nut allergy",
    "dairy.free",
    "halal",
    "kosher",
    "pescatarian",
    "celiac",
  ];
  const found: string[] = [];
  const l = msg.toLowerCase();
  for (const d of dietary) {
    if (new RegExp(d).test(l)) found.push(d.replace(".", "-"));
  }
  return found.length > 0 ? found.join(", ") : null;
}

function extractSpecialRequests(msg: string): string[] {
  const triggers = [
    { re: /cake/i, note: "Customer requested a cake — confirm with kitchen." },
    { re: /high\s?chair/i, note: "High chair needed." },
    { re: /wheelchair/i, note: "Wheelchair accessible seating required." },
    { re: /outside|outdoor/i, note: "Outdoor/patio seating requested." },
    { re: /quiet|private/i, note: "Quiet or private area requested." },
    { re: /decor|decoration/i, note: "Table decoration requested." },
    { re: /balloon/i, note: "Balloons requested." },
    { re: /candle/i, note: "Candles requested." },
    { re: /surprise/i, note: "Surprise element — do not mention to the guest." },
    { re: /photo|photographer/i, note: "Photography requested." },
    { re: /menu.*advance|advance.*menu/i, note: "Pre-order menu required." },
  ];
  return triggers.filter((t) => t.re.test(msg)).map((t) => t.note);
}

function generateKitchenNotes(
  partySize: number,
  occasion: string | null,
  dietary: string | null,
  specialRequests: string[]
): string {
  const lines: string[] = [`Party of ${partySize}.`];
  if (occasion) lines.push(`Occasion: ${occasion}.`);
  if (dietary) lines.push(`Dietary requirements: ${dietary}.`);
  if (specialRequests.length > 0) lines.push(...specialRequests);
  if (partySize >= 10) lines.push("Large party — pre-set sharing starters recommended.");
  if (partySize >= 20) lines.push("Banquet-style service may be required. Confirm with manager.");
  return lines.join(" ");
}

function generateUpsells(
  partySize: number,
  occasion: string | null,
  dietary: string | null
): string {
  const upsells: string[] = [];
  if (occasion === "birthday") upsells.push("Offer birthday cake (€25).", "Suggest a bottle of prosecco for the table.");
  if (occasion === "anniversary") upsells.push("Suggest anniversary cake or dessert platter.", "Offer a complimentary glass of champagne.");
  if (partySize >= 8) upsells.push("Suggest a set menu or sharing platter package.", "Offer a drinks package for the table.");
  if (partySize >= 15) upsells.push("Recommend pre-ordering for a smoother service.", "Suggest a cocktail welcome drink.");
  if (!dietary || !dietary.includes("vegan")) upsells.push("Suggest the chef's special for the evening.");
  if (upsells.length === 0) upsells.push("Offer the specials board.", "Suggest a bottle of wine.");
  return upsells.join(" ");
}

// ─── Main function ────────────────────────────────────────────────────────────

export interface BookingIntakeResult {
  parsed: {
    customerName: string | null;
    partySize: number | null;
    date: string | null;
    time: string | null;
    occasion: string | null;
    dietary: string | null;
    notes: string;
  };
  tableAssigned: { id: string; name: string; capacity: number } | null;
  tableWarning: string | null;
  staffingWarnings: string[];
  conflicts: string[];
  kitchenNotes: string;
  upsellNotes: string;
  reservationCreated: boolean;
  reservationId: string | null;
  confirmationSummary: string;
}

export async function processBookingIntake(
  message: string,
  businessId: string,
  createdById: string
): Promise<BookingIntakeResult> {
  const now = new Date();

  // ── 1. Parse ──────────────────────────────────────────────────────────────
  const partySize = extractPartySize(message);
  const occasion = extractOccasion(message);
  const dietary = extractDietary(message);
  const specialRequests = extractSpecialRequests(message);

  // Parse date/time with chrono
  const chronoParsed = chrono.parse(message, now, { forwardDate: true });
  let parsedDate: Date | null = null;
  let parsedTime: Date | null = null;

  if (chronoParsed.length > 0) {
    const p = chronoParsed[0];
    parsedDate = p.start.date();
    parsedTime = p.start.date();
  }

  // Extract customer name (simple heuristic: "for John Smith" / "booking for Sarah")
  const nameMatch = message.match(/(?:for|name[:\s]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const customerName = nameMatch?.[1] ?? null;

  const notes = [
    occasion ? `Occasion: ${occasion}` : null,
    dietary ? `Dietary: ${dietary}` : null,
    ...specialRequests,
  ]
    .filter(Boolean)
    .join(". ");

  const kitchenNotes = generateKitchenNotes(
    partySize ?? 0,
    occasion,
    dietary,
    specialRequests
  );

  const upsellNotes = generateUpsells(partySize ?? 0, occasion, dietary);

  // ── 2. Missing fields guard ───────────────────────────────────────────────
  const missing: string[] = [];
  if (!partySize) missing.push("party size");
  if (!parsedDate) missing.push("date");
  if (!parsedTime) missing.push("time");
  if (!customerName) missing.push("customer name");

  if (missing.length > 0) {
    return {
      parsed: {
        customerName,
        partySize,
        date: parsedDate?.toISOString() ?? null,
        time: parsedTime?.toISOString() ?? null,
        occasion,
        dietary,
        notes,
      },
      tableAssigned: null,
      tableWarning: null,
      staffingWarnings: [],
      conflicts: [],
      kitchenNotes,
      upsellNotes,
      reservationCreated: false,
      reservationId: null,
      confirmationSummary: `Missing info to complete the booking: **${missing.join(", ")}**. Please provide these and try again.`,
    };
  }

  // ── 3. Table assignment ───────────────────────────────────────────────────
  const tableAssigned = await tableService.findAvailable(
    businessId,
    partySize!,
    parsedDate!,
    parsedTime!
  );
  const tableWarning = tableAssigned
    ? null
    : `No available table found for ${partySize} people at that time. Booking created without a table — assign manually.`;

  // ── 4. Staffing check ─────────────────────────────────────────────────────
  const staffingWarnings: string[] = [];
  const dateStart = new Date(parsedDate!.toDateString());
  const dateEnd = new Date(dateStart.getTime() + 86400000);

  const shiftsOnDay = await prisma.shift.findMany({
    where: {
      businessId,
      date: { gte: dateStart, lt: dateEnd },
      published: true,
    },
    include: {
      employee: { include: { department: { select: { name: true } } } },
    },
  });

  const byDept: Record<string, number> = {};
  for (const s of shiftsOnDay) {
    const dept = s.employee.department?.name ?? "General";
    byDept[dept] = (byDept[dept] ?? 0) + 1;
  }

  if (shiftsOnDay.length === 0) {
    staffingWarnings.push("No published shifts found for this date — check your rota.");
  } else {
    if (partySize! >= 10 && (byDept["Kitchen"] ?? 0) < 2) {
      staffingWarnings.push("Large party: consider adding extra kitchen staff.");
    }
    if (partySize! >= 15 && (byDept["Bar"] ?? 0) < 2) {
      staffingWarnings.push("Large party: consider adding extra bar staff.");
    }
    if (partySize! >= 20 && shiftsOnDay.length < 5) {
      staffingWarnings.push("Very large party: current staffing may be insufficient. Recommend adding floor staff.");
    }
  }

  // ── 5. Conflict detection ─────────────────────────────────────────────────
  const conflicts: string[] = [];
  const windowStart = new Date(parsedTime!.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(parsedTime!.getTime() + 2 * 60 * 60 * 1000);

  const overlapping = await prisma.reservation.findMany({
    where: {
      businessId,
      status: { in: ["CONFIRMED", "PENDING", "SEATED"] },
      date: { gte: dateStart, lt: dateEnd },
      time: { gte: windowStart, lte: windowEnd },
    },
  });

  const totalCoversInWindow = overlapping.reduce((sum, r) => sum + r.partySize, 0) + partySize!;
  if (totalCoversInWindow > 80) {
    conflicts.push(`High cover count in this time window: ~${totalCoversInWindow} covers. Kitchen may be under pressure.`);
  }

  const largeParties = overlapping.filter((r) => r.partySize >= 10);
  if (largeParties.length >= 2) {
    conflicts.push("Multiple large parties already booked in this window. Consider staggering start times.");
  }

  // ── 6. Create reservation ─────────────────────────────────────────────────
  const allWarnings = [
    ...(tableWarning ? [tableWarning] : []),
    ...staffingWarnings,
    ...conflicts,
  ].join(" | ");

  const reservation = await reservationService.create(
    {
      customerName: customerName!,
      partySize: partySize!,
      date: parsedDate!.toISOString(),
      time: parsedTime!.toISOString(),
      notes: notes || undefined,
      dietary: dietary ?? undefined,
      occasion: occasion ?? undefined,
      tableId: tableAssigned?.id,
      kitchenNotes,
      upsellNotes,
      aiWarnings: allWarnings || undefined,
    },
    businessId,
    createdById
  );

  // ── 7. Confirmation summary ───────────────────────────────────────────────
  const dateStr = parsedDate!.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = parsedTime!.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const summaryLines = [
    `✅ **Booking confirmed** for **${customerName}** — party of **${partySize}**`,
    `📅 ${dateStr} at ${timeStr}`,
    tableAssigned
      ? `🪑 Table assigned: **${tableAssigned.name}** (capacity ${tableAssigned.capacity})`
      : `⚠️ No table assigned — please assign manually`,
    occasion ? `🎉 Occasion: ${occasion}` : null,
    dietary ? `🥗 Dietary: ${dietary}` : null,
    staffingWarnings.length > 0 ? `👥 Staffing: ${staffingWarnings.join("; ")}` : null,
    conflicts.length > 0 ? `⚠️ Conflicts: ${conflicts.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    parsed: {
      customerName,
      partySize,
      date: parsedDate!.toISOString(),
      time: parsedTime!.toISOString(),
      occasion,
      dietary,
      notes,
    },
    tableAssigned,
    tableWarning,
    staffingWarnings,
    conflicts,
    kitchenNotes,
    upsellNotes,
    reservationCreated: true,
    reservationId: reservation.id,
    confirmationSummary: summaryLines,
  };
}
