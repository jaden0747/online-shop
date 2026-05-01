"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL = 2000; // 2 seconds

export function DataFileWatcher() {
  const router = useRouter();
  const mtimesRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const res = await fetch("/api/file-status");
        if (!res.ok) return;
        const mtimes: Record<string, number> = await res.json();

        if (mtimesRef.current === null) {
          // First load — just store
          mtimesRef.current = mtimes;
          return;
        }

        // Compare with previous
        let changed = false;
        for (const [file, mtime] of Object.entries(mtimes)) {
          if (mtimesRef.current[file] !== mtime) {
            changed = true;
            break;
          }
        }
        // Check for deleted files
        if (!changed) {
          for (const file of Object.keys(mtimesRef.current)) {
            if (!(file in mtimes)) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          mtimesRef.current = mtimes;
          router.refresh();
        }
      } catch {
        // Network error — ignore
      }
    }

    check();
    timer = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
