"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

type Mode = "new" | "upsert" | "override";

type Result = {
  created: number;
  updated: number;
  skipped: number;
  deleted?: number;
  errors: string[];
};

const MODES: { value: Mode; label: string; description: string; danger?: boolean }[] = [
  {
    value: "new",
    label: "New customers only",
    description: "Adds rows whose phone number is not yet in the system. Existing customers are untouched.",
  },
  {
    value: "upsert",
    label: "Add new + update existing",
    description: "Adds new customers and updates name / address / zone for existing ones (matched by phone).",
  },
  {
    value: "override",
    label: "Override entire database",
    description: "Upserts all rows AND removes any customer whose phone is not in the file. Use with caution.",
    danger: true,
  },
];

export function ImportCustomersForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("new");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    if (mode === "override" && !confirm(
      "This will overwrite AND delete customers not in the file.\n\nAre you sure you want to continue?"
    )) return;

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);

    const res = await fetch("/api/import-customers", { method: "POST", body: fd });
    const data: Result = await res.json();
    setResult(data);
    setLoading(false);

    if (data.created > 0 || data.updated > 0 || (data.deleted ?? 0) > 0) {
      router.refresh();
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setResult(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload size={13} className="mr-1" />
        Import
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Mode */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Import mode</legend>
            {MODES.map(({ value, label, description, danger }) => (
              <label key={value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className={`font-medium${danger ? " text-destructive" : ""}`}>{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* File picker */}
          <div className="space-y-1">
            <label className="text-sm font-medium">File (.xlsx or .csv)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              Use the{" "}
              <a
                href="/customer-import-template.csv"
                download
                className="underline underline-offset-2 hover:text-foreground"
              >
                import template
              </a>{" "}
              to ensure the correct column layout.
            </p>
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">Import complete</p>
              <p className="text-muted-foreground">
                Created: <span className="text-foreground font-medium">{result.created}</span>
                {" · "}Updated: <span className="text-foreground font-medium">{result.updated}</span>
                {" · "}Skipped: <span className="text-foreground font-medium">{result.skipped}</span>
                {(result.deleted ?? 0) > 0 && (
                  <>{" · "}Deleted: <span className="text-destructive font-medium">{result.deleted}</span></>
                )}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-destructive text-xs max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <Button
            type="submit"
            className={`w-full${mode === "override" ? " bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
            disabled={loading}
          >
            {loading ? "Importing…" : mode === "override" ? "Override Database" : "Import"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
