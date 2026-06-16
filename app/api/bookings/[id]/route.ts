import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { reservationService, updateReservationSchema } from "@/lib/services/reservation.service";
import { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/bookings/[id]
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const reservation = await reservationService.getById(id, businessId);
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    return NextResponse.json({ reservation });
  } catch (err) {
    console.error("[bookings/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 });
  }
}

// PUT /api/bookings/[id]
export async function PUT(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const reservation = await reservationService.update(id, businessId, parsed.data);
    return NextResponse.json({ reservation });
  } catch (err: any) {
    if (err?.message === "Reservation not found") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    console.error("[bookings/[id] PUT]", err);
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
  }
}

// DELETE /api/bookings/[id] — soft cancel (sets status to CANCELLED)
export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const reservation = await reservationService.update(id, businessId, { status: "CANCELLED" });
    return NextResponse.json({ reservation });
  } catch (err: any) {
    if (err?.message === "Reservation not found") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    console.error("[bookings/[id] DELETE]", err);
    return NextResponse.json({ error: "Failed to cancel reservation" }, { status: 500 });
  }
}
