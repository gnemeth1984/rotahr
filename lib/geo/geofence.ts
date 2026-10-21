import { prisma } from "@/lib/db";
import { distanceMetres, isValidCoord } from "@/lib/geo/distance";

export type Geofence = { lat: number; lng: number; radius: number; source: "venue" | "business" };

export type GeoStatus = "inside" | "outside" | "no_location" | "not_configured";

export type GeoResult = {
  status: GeoStatus;
  distanceM: number | null;
  lat: number | null;
  lng: number | null;
};

/** Extra slack for phone GPS error, capped so a vague fix can't stretch the fence far. */
export const MAX_ACCURACY_TOLERANCE_M = 50;

/**
 * The premises pin that applies to an employee: their venue's pin if it has
 * one, otherwise the business pin. Null when neither is set (geofence off).
 */
export async function resolveGeofence(
  businessId: string,
  venueId?: string | null
): Promise<Geofence | null> {
  if (venueId) {
    const v = await prisma.venue.findFirst({
      where: { id: venueId, businessId },
      select: { geoLat: true, geoLng: true, geoRadius: true },
    });
    if (v && isValidCoord(v.geoLat, v.geoLng)) {
      return { lat: v.geoLat as number, lng: v.geoLng as number, radius: v.geoRadius || 200, source: "venue" };
    }
  }
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { geoLat: true, geoLng: true, geoRadius: true },
  });
  if (b && isValidCoord(b.geoLat, b.geoLng)) {
    return { lat: b.geoLat as number, lng: b.geoLng as number, radius: b.geoRadius || 200, source: "business" };
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Pure: classify a reported position against a fence. */
export function evaluateGeofence(
  fence: Geofence | null,
  latitude: unknown,
  longitude: unknown,
  accuracy?: unknown
): GeoResult {
  const lat = toNum(latitude);
  const lng = toNum(longitude);
  const hasCoord = isValidCoord(lat, lng);
  const base = { lat: hasCoord ? lat : null, lng: hasCoord ? lng : null };

  if (!fence) return { status: "not_configured", distanceM: null, ...base };
  if (!hasCoord) return { status: "no_location", distanceM: null, ...base };

  const distanceM = Math.round(distanceMetres(lat as number, lng as number, fence.lat, fence.lng));
  const acc = toNum(accuracy);
  const tolerance = acc && acc > 0 ? Math.min(acc, MAX_ACCURACY_TOLERANCE_M) : 0;
  return {
    status: distanceM <= fence.radius + tolerance ? "inside" : "outside",
    distanceM,
    ...base,
  };
}
