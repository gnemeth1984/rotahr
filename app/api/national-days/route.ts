import { NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour

export async function GET() {
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yyyy = today.getFullYear();
    const dateStr = `${mm}/${dd}/${yyyy}`;

    const res = await fetch(`https://www.checkiday.com/api/3/?d=${dateStr}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("Checkiday fetch failed");

    const json = await res.json();

    if (json.error !== "none") throw new Error("Checkiday error: " + json.error);

    // Return top 6 holidays, cleaned up
    const holidays = (json.holidays ?? []).slice(0, 6).map((h: { name: string; url: string }) => ({
      name: h.name,
      url: h.url,
    }));

    return NextResponse.json({ date: json.date, holidays });
  } catch (e) {
    console.error("National days API error:", e);
    return NextResponse.json({ date: null, holidays: [] });
  }
}
