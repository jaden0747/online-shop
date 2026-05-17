const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns road distance in km via OSRM public API.
// Falls back to Haversine if OSRM is unreachable.
export async function roadDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): Promise<{ distanceKm: number; method: "osrm" | "haversine" }> {
  // OSRM expects lng,lat order
  const url =
    `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json() as { code: string; routes?: { distance: number }[] };
      if (data.code === "Ok" && data.routes?.[0]?.distance != null) {
        return { distanceKm: data.routes[0].distance / 1000, method: "osrm" };
      }
    }
  } catch {
    // network error or timeout — fall through to Haversine
  }
  return { distanceKm: haversineKm(lat1, lng1, lat2, lng2), method: "haversine" };
}

export function calcShippingFee(
  distanceKm: number,
  zones: {
    zone1MaxKm: number; zone1: number;
    zone2MaxKm: number; zone2: number;
    zone3MaxKm: number; zone3: number;
    zone4PerKm: number;
  }
): number {
  if (distanceKm <= zones.zone1MaxKm) return zones.zone1;
  if (distanceKm <= zones.zone2MaxKm) return zones.zone2;
  if (distanceKm <= zones.zone3MaxKm) return zones.zone3;
  return Math.round(distanceKm * zones.zone4PerKm);
}
