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
  "addresses.xlsx",
  "settings.xlsx",
]);

function openFolder(folderPath: string) {
  const platform = process.platform;
  if (platform === "win32") {
    exec(`explorer "${folderPath}"`);
  } else if (platform === "linux") {
    exec(`xdg-open "${folderPath}"`);
  } else {
    exec(`open "${folderPath}"`);
  }
}

export async function POST(req: NextRequest) {
  const { file } = await req.json().catch(() => ({}));

  if (!file || !ALLOWED_FILES.has(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.resolve(DATA_DIR, file);
  if (!filePath.startsWith(DATA_DIR + path.sep) && filePath !== DATA_DIR) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  openFolder(DATA_DIR);

  return NextResponse.json({ ok: true });
}
