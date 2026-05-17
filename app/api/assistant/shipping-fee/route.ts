import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/data/settings";
import { getCustomerById, getAllAddresses } from "@/lib/data/customers";
import { roadDistanceKm, calcShippingFee } from "@/lib/utils/distance";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = req.headers.get("x-source") ?? "unknown";
  const externalUserId = req.headers.get("x-external-user-id") ?? null;

  const settings = getSettings();
  const zones = {
    zone1MaxKm: settings.shippingFeeZone1MaxKm,
    zone1: settings.shippingFeeZone1,
    zone2MaxKm: settings.shippingFeeZone2MaxKm,
    zone2: settings.shippingFeeZone2,
    zone3MaxKm: settings.shippingFeeZone3MaxKm,
    zone3: settings.shippingFeeZone3,
    zone4PerKm: settings.shippingFeeZone4PerKm,
  };

  let lat: number;
  let lng: number;
  let resolvedCustomerId: string | null = null;

  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");
  const customerId = searchParams.get("customerId");
  const addressId = searchParams.get("addressId");

  if (rawLat && rawLng) {
    lat = parseFloat(rawLat);
    lng = parseFloat(rawLng);
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng must be valid numbers" }, { status: 400 });
    }
  } else if (customerId && addressId) {
    const customer = getCustomerById(customerId);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    resolvedCustomerId = customer.id;

    const addr = getAllAddresses().find((a) => a.id === addressId && a.customerId === customerId);
    if (!addr) {
      return NextResponse.json({ error: "Address not found for this customer" }, { status: 404 });
    }
    if (addr.latitude == null || addr.longitude == null) {
      return NextResponse.json(
        { error: "Address has no coordinates — cannot estimate shipping fee" },
        { status: 422 }
      );
    }
    lat = addr.latitude;
    lng = addr.longitude;
  } else {
    return NextResponse.json(
      { error: "Provide either lat+lng or customerId+addressId" },
      { status: 400 }
    );
  }

  const { distanceKm, method } = await roadDistanceKm(settings.hubLat, settings.hubLng, lat, lng);
  const fee = calcShippingFee(distanceKm, zones);

  const result = {
    fee,
    distanceKm: Math.round(distanceKm * 10) / 10,
    distanceMethod: method,
    zones: {
      zone1: `0–${zones.zone1MaxKm}km → ${zones.zone1.toLocaleString()}đ`,
      zone2: `${zones.zone1MaxKm}–${zones.zone2MaxKm}km → ${zones.zone2.toLocaleString()}đ`,
      zone3: `${zones.zone2MaxKm}–${zones.zone3MaxKm}km → ${zones.zone3.toLocaleString()}đ`,
      zone4: `>${zones.zone3MaxKm}km → ${zones.zone4PerKm.toLocaleString()}đ/km`,
    },
  };

  appendAssistantLog({
    source,
    externalUserId,
    customerId: resolvedCustomerId,
    action: "shipping_fee_estimate",
    request: rawLat ? { lat, lng } : { customerId, addressId },
    result,
  });

  return NextResponse.json(result);
}
