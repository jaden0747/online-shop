"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function PhoneDisplay({ phone, className }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className={`inline-flex items-center gap-1 group ${className ?? ""}`}>
      <a
        href={`https://zalo.me/${phone}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-muted-foreground hover:text-blue-500 transition-colors"
        title="Open in Zalo"
      >
        {phone}
      </a>
      <span
        role="button"
        tabIndex={0}
        onClick={handleCopy}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleCopy(e as never)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
        title="Copy phone number"
      >
        {copied ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
      </span>
    </span>
  );
}
