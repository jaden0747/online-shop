"use client";

import { useTransition } from "react";
import { enableTestingAction } from "@/app/actions/testing";
import { Button } from "@/components/ui/button";

export function TestingToggle({ isActive }: { isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  if (isActive) {
    return (
      <p className="text-sm text-red-600 font-medium">
        Testing mode is currently active. Use the banner to disable.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => {
      enableTestingAction();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Enabling…" : "Enable Testing Mode"}
      </Button>
    </form>
  );
}
