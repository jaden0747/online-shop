"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAddressCoordsStringAction } from "../actions/addresses";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type AddressRow = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
  firstForCustomer: boolean;
};

function CoordsCell({
  row,
}: {
  row: AddressRow;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    row.latitude !== null && row.longitude !== null
      ? `${row.latitude}, ${row.longitude}`
      : ""
  );
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasCoords = row.latitude !== null && row.longitude !== null;

  function startEdit() {
    setValue(
      row.latitude !== null && row.longitude !== null
        ? `${row.latitude}, ${row.longitude}`
        : ""
    );
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function save() {
    setEditing(false);
    const trimmed = value.trim();
    const current = row.latitude !== null && row.longitude !== null
      ? `${row.latitude}, ${row.longitude}`
      : "";
    if (trimmed === current) return;
    startTransition(async () => {
      await updateAddressCoordsStringAction(row.id, row.customerId, trimmed);
      router.refresh();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        placeholder="latitude, longitude"
        className="w-full bg-transparent border-b border-primary outline-none text-xs font-mono px-0 py-0"
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-accent/50 text-xs font-mono ${
        pending ? "opacity-50" : ""
      }`}
      title="Click to edit"
    >
      {hasCoords ? (
        <a
          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="text-green-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.latitude}, {row.longitude}
        </a>
      ) : (
        <span className="text-amber-500 italic">click to add</span>
      )}
    </span>
  );
}

export function AddressesTable({ rows }: { rows: AddressRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium">Customer</th>
            <th className="text-left px-4 py-2 font-medium">Label</th>
            <th className="text-left px-4 py-2 font-medium">Address</th>
            <th className="text-left px-4 py-2 font-medium">Zone</th>
            <th className="text-left px-4 py-2 font-medium min-w-[200px]">Coordinates</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                No addresses found.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/50 transition-colors">
              <td className="px-4 py-2">
                {row.firstForCustomer ? (
                  <Link
                    href={`/customers/${encodeURIComponent(row.customerPhone)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.customerName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs pl-2">↳</span>
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5">
                  {row.label}
                  {row.isDefault && (
                    <Badge variant="secondary" className="text-xs">default</Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-2 text-muted-foreground max-w-[240px] truncate">{row.address}</td>
              <td className="px-4 py-2">{row.zone}</td>
              <td className="px-4 py-2">
                <CoordsCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
