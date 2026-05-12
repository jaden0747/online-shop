import { readRows, writeRows, toStr, toStrOrNull, toNum } from "./excel";
import type { CreditTransaction } from "./types";

const FILE = "credits.xlsx";
const SHEET = "Credits";

function parseCreditTransaction(raw: Record<string, unknown>): CreditTransaction {
  return {
    id: toStr(raw.id),
    customerId: toStr(raw.customerId),
    type: (toStr(raw.type) || "manual_topup") as CreditTransaction["type"],
    amount: toNum(raw.amount),
    subscriptionId: toStrOrNull(raw.subscriptionId),
    note: toStr(raw.note),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllCreditTransactions(): CreditTransaction[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parseCreditTransaction)
    .filter((t) => t.id && t.customerId);
}

export function getCreditTransactionsByCustomer(customerId: string): CreditTransaction[] {
  return getAllCreditTransactions().filter((t) => t.customerId === customerId);
}

function saveCreditTransactions(transactions: CreditTransaction[]): void {
  writeRows(FILE, SHEET, transactions);
}

export function createCreditTransaction(
  data: Omit<CreditTransaction, "id" | "createdAt">
): CreditTransaction {
  const all = getAllCreditTransactions();
  const tx: CreditTransaction = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  all.push(tx);
  saveCreditTransactions(all);
  return tx;
}

export function deleteCreditTransaction(id: string): void {
  saveCreditTransactions(getAllCreditTransactions().filter((t) => t.id !== id));
}
