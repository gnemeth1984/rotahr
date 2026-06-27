import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customers = await prisma.customer.findMany({
    where: { businessId: session.user.businessId, isAnonymised: false },
    include: {
      reservations: { select: { id: true, date: true, status: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = customers.map((c) => {
    const visits = c.reservations.filter((r) => r.status !== "no-show" && r.status !== "cancelled").length;
    const noShows = c.reservations.filter((r) => r.status === "no-show").length;
    const lastVisit = c.reservations
      .filter((r) => r.status !== "no-show" && r.status !== "cancelled")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date;

    return [
      c.name,
      c.email ?? "",
      c.phone ?? "",
      c.birthday ? new Date(c.birthday).toISOString().split("T")[0] : "",
      c.tags.join("|"),
      visits,
      noShows,
      lastVisit ? new Date(lastVisit).toISOString().split("T")[0] : "",
      c.gdprConsent ? "Yes" : "No",
      c.dietaryNotes ?? "",
      c.allergies ?? "",
      new Date(c.createdAt).toISOString().split("T")[0],
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  const header = [
    "Name",
    "Email",
    "Phone",
    "Birthday",
    "Tags",
    "Total Visits",
    "No-Shows",
    "Last Visit",
    "GDPR Consent",
    "Dietary Notes",
    "Allergies",
    "Created",
  ].join(",");

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
