// @ts-nocheck
import { prisma } from "@/lib/db";
import * as chrono from "chrono-node";
import { tableService } from "@/lib/services/table.service";

export interface BookingIntakeResult {
  parsed: {
    customerName: string | null;
    partySize: number | null;
    date: string | null;
    time: string | null;
    occasion: string | null;
    dietary: string | null;
    notes: string | null;
  };
  tableAssignment: {
    tableId: string | null;
    tableName: string | null;
    tableCapacity: number | null;
    assigned: boolean;
    reason: string;
  };
  staffing: {
    shiftsOnDate: number;
    barStaff: number;
    floorStaff: number;
    kitchenStaff: number;
    adequate: boolean;
    warnings: string[];
  };
  kitchenNotes: string;
  upsellSuggestions: string;
  managerSummary: string;
  warnings: string[];
  canCreate: boolean;
}

// ─── NLP helpers ─────────────────────────────────────────────────────────────

function extractPartySize(msg: string): number | null {
  // "12 people", "table for 4", "party of 6", "8 guests"
  const patterns = [
    /\bfor\s+(\d+)\b/i,
    /\b(\d+)\s+(?:people|guests?|persons?|covers?|pax)\b/i,
    /\bparty\s+of\s+(\d+)\b/i,
    /\btable\s+(?:of|for)\s+(\d+)\b/i,
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractCustomerName(msg: string): string | null {
  // "booking for John Smith", "under the name Walsh", "name: Christy"
  const patterns = [
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\bname[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\bunder\s+(?:the\s+name\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (m && !["the", "a", "an", "this", "that"].includes(m[1].toLowerCase())) {
      return m[1];
    }
  }
  return null;
}

function extractOccasion(msg: string): string | null {
  const occasions: Record<string, string> = {
    birthday: "Birthday",
    anniversary: "Anniversary",
    "hen party": "Hen Party",
    "stag party": "Stag Party",
    engagement: "Engagement",
    "baby shower": "Baby Shower",
    graduation: "Graduation",
    christmas: "Christmas Party",
    "work do": "Work Event",
    "staff party": "Staff Party",
    "business dinner": "Business Dinner",
    wake: "Wake",
    celebration: "Celebration",
  };
  const lower = msg.toLowerCase();
  for (const [key, label] of Object.entries(occasions)) {
    if (lower.includes(key)) return label;
  }
  return null;
}

function extractDietary(msg: string): string | null {
  const items: string[] = [];
  const checks: [RegExp, string][] = [
    [/\bvegan\b/i, "Vegan"],
    [/\bvegetarian\b/i, "Vegetarian"],
    [/\bgluten.?free\b/i, "Gluten-free"],
    [/\bnut.?allerg/i, "Nut allergy"],
    [/\bdairy.?free\b/i, "Dairy-free"],
    [/\bhalal\b/i, "Halal"],
    [/\bkosher\b/i, "Kosher"],
    [/\bcoeliac\b/i, "Coeliac"],
    [/\ballerg/i, "Allergy noted"],
  ];
  for (const [re, label] of checks) {
    if (re.test(msg)) items.push(label);
  }
  return items.length > 0 ? items.join(", ") : null;
}

function extractNotes(msg: string): string | null {
  const noteKeywords = ["cake", "balloon", "flower", "decorat", "high chair", "wheelchair", "window", "quiet", "private", "outdoor", "garden"];
  const found: string[] = [];
  for (const kw of noteKeywords) {
    if (msg.toLowerCase().includes(kw)) found.push(kw);
  }
  return found.length > 0 ? `Special requests noted: ${found.join(", ")}` : null;
}

function generateKitchenNotes(
  partySize: number | null,
  occasion: string | null,
  dietary: string | null,
  notes: string | null
): string {
  const lines: string[] = [];
  if (partySize) lines.push(`Party of ${partySize}.`);
  if (occasion) {
    lines.push(`Occasion: ${occasion}.`);
    if (occasion === "Birthday") lines.push("Prepare birthday cake/dessert presentation.");
    if (occasion === "Anniversary") lines.push("Consider complimentary dessert or amuse-bouche.");
  }
  if (dietary) lines.push(`Dietary requirements: ${dietary}. Ensure all dishes accommodate.`);
  if (notes) lines.push(notes);
  if (partySize && partySize >= 10) lines.push("Large party — pre-set starters recommended. Coordinate with floor staff on timing.");
  return lines.join(" ") || "Standard service.";
}

function generateUpsells(
  partySize: number | null,
  occasion: string | null
): string {
  const upsells: string[] = [];
  if (occasion === "Birthday") upsells.push("Birthday cake (€35)", "Prosecco on arrival (€8/glass)", "Balloon package (€15)");
  if (occasion === "Anniversary") upsells.push("Champagne on arrival (€12/glass)", "Sharing dessert platter (€18)");
  if (occasion === "Hen Party" || occasion === "Stag Party") upsells.push("Welcome shots round (€6/pp)", "Party platters (€45)", "Cocktail pitchers (€32)");
  if (partySize && partySize >= 8) upsells.push("Set menu option (saves kitchen time)", "Pre-paid bar tab setup");
  if (upsells.length === 0) upsells.push("House wine selection", "Sharing starters board (€22)");
  return upsells.join(" | ");
}

// ─── Main intake function ─────────────────────────────────────────────────────

export async function processBookingIntake(
  message: string,
  businessId: string,
  now: Date = new Date()
): Promise<BookingIntakeResult> {
  const warnings: string[] = [];

  // 1. Parse fields
  const partySize = extractPartySize(message);
  const customerName = extractCustomerName(message);
  const occasion = extractOccasion(message);
  const dietary = extractDietary(message);
  const notes = extractNotes(message);

  // 2. Parse date/time
  const chronoParsed = chrono.parse(message, now, { forwardDate: true });
  let dateStr: string | null = null;
  let timeStr: string | null = null;
  let dateTime: Date | null = null;

  if (chronoParsed.length > 0) {
    dateTime = chronoParsed[0].start.date();
    dateStr = dateTime.toISOString().split("T")[0];
    timeStr = dateTime.toISOString();
  }

  if (!dateTime) warnings.push("Could not parse date/time — please specify clearly.");
  if (!partySize) warnings.push("Party size not detected — please specify number of guests.");
  if (!customerName) warnings.push("Customer name not detected.");

  // 3. Table assignment
  let tableAssignment: BookingIntakeResult["tableAssignment"] = {
    tableId: null,
    tableName: null,
    tableCapacity: null,
    assigned: false,
    reason: "No date/time or party size provided.",
  };

  if (dateTime && partySize) {
    const available = await tableService.findAvailable(businessId, partySize, dateTime);
    if (available.length > 0) {
      const t = available[0];
      tableAssignment = {
        tableId: t.id,
        tableName: t.name,
        tableCapacity: t.capacity,
        assigned: true,
        reason: `Table "${t.name}" (capacity ${t.capacity}) is available.`,
      };
    } else {
      warnings.push(`No available table for ${partySize} guests at this time.`);
      tableAssignment = {
        tableId: null,
        tableName: null,
        tableCapacity: null,
        assigned: false,
        reason: `No table with capacity ≥ ${partySize} is available at this time.`,
      };
    }
  }

  // 4. Staffing check
  const staffingWarnings: string[] = [];
  let shiftsOnDate = 0;
  let barStaff = 0;
  let floorStaff = 0;
  let kitchenStaff = 0;

  if (dateTime) {
    const dayStart = new Date(dateTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateTime);
    dayEnd.setHours(23, 59, 59, 999);

    const shifts = await prisma.shift.findMany({
      where: {
        employee: { businessId },
        date: { gte: dayStart, lte: dayEnd },
        published: true,
      },
      include: { employee: { include: { department: true } } },
    });

    shiftsOnDate = shifts.length;

    for (const s of shifts) {
      const dept = s.employee.department?.name?.toLowerCase() ?? "";
      const role = s.employee.role?.toLowerCase() ?? "";
      if (dept.includes("bar") || role.includes("bar")) barStaff++;
      else if (dept.includes("kitchen") || role.includes("kitchen") || role.includes("chef")) kitchenStaff++;
      else floorStaff++;
    }

    // Rules: per 20 covers need 1 kitchen, per 15 need 1 floor, per 30 need 1 bar
    if (partySize) {
      const needKitchen = Math.ceil(partySize / 20);
      const needFloor = Math.ceil(partySize / 15);
      if (kitchenStaff < needKitchen) staffingWarnings.push(`Kitchen understaffed — ${kitchenStaff} on shift, recommend ${needKitchen} for this party size.`);
      if (floorStaff < needFloor) staffingWarnings.push(`Floor understaffed — ${floorStaff} on shift, recommend ${needFloor} for this party size.`);
      if (barStaff === 0) staffingWarnings.push("No bar staff scheduled for this date.");
    }

    if (shiftsOnDate === 0) staffingWarnings.push("No published shifts found for this date — schedule staff before confirming.");
  }

  warnings.push(...staffingWarnings);

  const staffing: BookingIntakeResult["staffing"] = {
    shiftsOnDate,
    barStaff,
    floorStaff,
    kitchenStaff,
    adequate: staffingWarnings.length === 0,
    warnings: staffingWarnings,
  };

  // 5. Generate kitchen notes & upsells
  const kitchenNotes = generateKitchenNotes(partySize, occasion, dietary, notes);
  const upsellSuggestions = generateUpsells(partySize, occasion);

  // 6. Manager summary
  const canCreate = !!dateTime && !!partySize;
  const managerSummary = [
    `📋 Booking Intake Summary`,
    `─────────────────────────`,
    `Customer: ${customerName ?? "Not specified"}`,
    `Party: ${partySize ?? "?"} guests`,
    `Date/Time: ${dateTime ? dateTime.toLocaleString("en-IE") : "Not parsed"}`,
    `Occasion: ${occasion ?? "None"}`,
    `Dietary: ${dietary ?? "None"}`,
    `Table: ${tableAssignment.assigned ? tableAssignment.tableName : "Not assigned"}`,
    `Staffing: ${staffing.adequate ? "✅ Adequate" : "⚠️ " + staffingWarnings[0]}`,
    warnings.length > 1 ? `\n⚠️ Warnings:\n${warnings.map((w) => "• " + w).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    parsed: {
      customerName,
      partySize,
      date: dateStr,
      time: timeStr,
      occasion,
      dietary,
      notes,
    },
    tableAssignment,
    staffing,
    kitchenNotes,
    upsellSuggestions,
    managerSummary,
    warnings,
    canCreate,
  };
}
