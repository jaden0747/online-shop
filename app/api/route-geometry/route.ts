import { NextRequest, NextResponse } from "next/server";

// Public OSRM-compatible servers. Add a self-hosted URL via OSRM_URL env var if you have one.
const OSRM_BACKENDS = [
  process.env.OSRM_URL,
  "https://routing.openstreetmap.de/routed-car",
  "https://router.project-osrm.org",
].filter(Boolean) as string[];

export async function POST(req: NextRequest) {
  const { waypoints } = (await req.json()) as { waypoints: { lat: number; lng: number }[] };
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json({ error: "need at least 2 waypoints" }, { status: 400 });
  }

  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const errors: string[] = [];

  for (const base of OSRM_BACKENDS) {
    const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`);
        console.warn(`[route-geometry] ${base} -> HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.code !== "Ok") {
        errors.push(`${base}: code=${data.code}`);
        console.warn(`[route-geometry] ${base} -> code=${data.code}`, data.message);
        continue;
      }
      const geom = data.routes?.[0]?.geometry;
      if (!geom?.coordinates) {
        errors.push(`${base}: no geometry`);
        continue;
      }
      const positions = geom.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      return NextResponse.json({ positions, source: base });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${base}: ${msg}`);
      console.warn(`[route-geometry] ${base} -> error`, msg);
    }
  }

  return NextResponse.json({ error: "all backends failed", details: errors }, { status: 502 });
}
