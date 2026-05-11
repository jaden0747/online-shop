import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

export const BASE_DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
export const TESTING_FLAG = path.join(BASE_DATA_DIR, ".testing-mode");

// Keep DATA_DIR as an alias for BASE_DATA_DIR for legacy imports
export const DATA_DIR = BASE_DATA_DIR;

export function getDataDir(): string {
  return fs.existsSync(TESTING_FLAG)
    ? path.join(BASE_DATA_DIR, "test")
    : BASE_DATA_DIR;
}

function ensure() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- mtime-based cache ---
const cache = new Map<string, { mtimeMs: number; data: Map<string, unknown[]> }>();

function getCachedSheets(file: string): Map<string, unknown[]> | null {
  const fp = path.join(getDataDir(), file);
  if (!fs.existsSync(fp)) return null;
  const stat = fs.statSync(fp);
  const entry = cache.get(file);
  if (entry && entry.mtimeMs === stat.mtimeMs) return entry.data;
  return null; // stale or missing
}

function setCachedSheet(file: string, sheet: string, rows: unknown[]) {
  const fp = path.join(getDataDir(), file);
  if (!fs.existsSync(fp)) return;
  const stat = fs.statSync(fp);
  let entry = cache.get(file);
  if (!entry || entry.mtimeMs !== stat.mtimeMs) {
    entry = { mtimeMs: stat.mtimeMs, data: new Map() };
    cache.set(file, entry);
  }
  entry.data.set(sheet, rows);
}

function invalidateCache(file: string) {
  cache.delete(file);
}

/** Get modification times for all data files. */
export function getFileMtimes(): Record<string, number> {
  ensure();
  const dir = getDataDir();
  const result: Record<string, number> = {};
  if (!fs.existsSync(dir)) return result;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".xlsx")) {
      const stat = fs.statSync(path.join(dir, f));
      result[f] = stat.mtimeMs;
    }
  }
  return result;
}

/** Convert an Excel serial date number or date string to ISO string. */
export function parseExcelDate(val: string | number | null | undefined): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    // Excel serial date: days since 1900-01-00 (with 1900 leap year bug)
    const d = new Date((val - 25569) * 86400 * 1000);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

export function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function toBool(val: unknown): boolean {
  return val === true || val === 1 || val === "true" || val === "1" || val === "TRUE";
}

export function toStr(val: unknown): string {
  return val === null || val === undefined ? "" : String(val).trim();
}

export function toStrOrNull(val: unknown): string | null {
  const s = toStr(val);
  return s === "" ? null : s;
}

/** Read all rows from a named sheet. Returns [] if file/sheet missing. */
export function readRows<T extends object>(file: string, sheet: string): T[] {
  ensure();
  const fp = path.join(getDataDir(), file);
  if (!fs.existsSync(fp)) return [];

  // Check cache
  const cached = getCachedSheets(file);
  if (cached && cached.has(sheet)) return cached.get(sheet) as T[];

  try {
    const wb = XLSX.read(fs.readFileSync(fp));
    const ws = wb.Sheets[sheet];
    if (!ws || !ws["!ref"]) return [];
    const rows = XLSX.utils.sheet_to_json<T>(ws, { defval: null });
    setCachedSheet(file, sheet, rows);
    return rows;
  } catch {
    return [];
  }
}

/** Write rows to a named sheet, preserving other sheets in the file. */
export function writeRows<T extends object>(
  file: string,
  sheet: string,
  rows: T[]
): void {
  ensure();
  const fp = path.join(getDataDir(), file);
  let wb: XLSX.WorkBook;
  try {
    wb = fs.existsSync(fp)
      ? XLSX.read(fs.readFileSync(fp))
      : XLSX.utils.book_new();
  } catch {
    wb = XLSX.utils.book_new();
  }

  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([[]]);

  wb.Sheets[sheet] = ws;
  if (!wb.SheetNames.includes(sheet)) wb.SheetNames.push(sheet);
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(fp, buf);
  invalidateCache(file);
}

export function dataFilePath(file: string): string {
  ensure();
  return path.join(getDataDir(), file);
}
