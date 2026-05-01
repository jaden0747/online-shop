import { NextResponse } from "next/server";
import { getFileMtimes } from "@/lib/data/excel";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getFileMtimes());
}
