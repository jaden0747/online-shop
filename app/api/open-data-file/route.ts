import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");

const ALLOWED_FILES = new Set([
  "customers.xlsx",
  "subscriptions.xlsx",
  "menu.xlsx",
  "pricing.xlsx",
  "orders.xlsx",
]);

export async function POST(req: NextRequest) {
  const { file } = await req.json().catch(() => ({}));

  if (!file || !ALLOWED_FILES.has(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  // Strict path validation — ensure resolved path stays within DATA_DIR
  const filePath = path.resolve(DATA_DIR, file);
  if (!filePath.startsWith(DATA_DIR + path.sep) && filePath !== DATA_DIR) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  // Ensure the data directory exists (create empty file if needed so Finder can open the folder)
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    // File doesn't exist yet — reveal the parent folder instead
    exec(`open "${DATA_DIR}"`);
  } else {
    // Reveal the specific file in Finder
    exec(`open -R "${filePath}"`);
  }

  return NextResponse.json({ ok: true });
}
