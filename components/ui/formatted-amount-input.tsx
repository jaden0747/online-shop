"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("en-US");

function formatRaw(raw: string): string {
  if (!raw || !/^\d+$/.test(raw)) return raw;
  return fmt.format(Number(raw));
}

type Props = {
  value: string | number;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export function FormattedAmountInput({
  value,
  onChange,
  className,
  placeholder,
  id,
  onKeyDown,
}: Props) {
  const [focused, setFocused] = useState(false);
  const str = typeof value === "number" ? (value === 0 ? "" : String(value)) : value;

  return (
    <Input
      type="text"
      inputMode="numeric"
      id={id}
      className={className}
      placeholder={placeholder}
      value={focused ? str : formatRaw(str)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        if (raw === "" || /^\d+$/.test(raw)) onChange(raw);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
