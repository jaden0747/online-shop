"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertMenuItemAction, deleteMenuItemAction } from "../actions/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  goals: string;
} | null;

export function MenuSlot({
  weekLabel,
  day,
  slot,
  item,
  label,
}: {
  weekLabel: string;
  day: number;
  slot: number;
  item: Item;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      await upsertMenuItemAction(formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  const isEmpty = !item;

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 min-h-[100px] flex flex-col ${
        isEmpty ? "border-dashed bg-muted/20" : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                />
              }
            >
              {isEmpty ? <Plus size={12} /> : <Pencil size={12} />}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isEmpty ? "Add" : "Edit"} {label}
                </DialogTitle>
              </DialogHeader>
              <form action={action} className="space-y-4">
                <input type="hidden" name="weekLabel" value={weekLabel} />
                <input type="hidden" name="day" value={day} />
                <input type="hidden" name="slot" value={slot} />
                <div className="space-y-1">
                  <Label htmlFor="name">Meal name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={item?.name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={item?.description ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goals">
                    Suitable for{" "}
                    <span className="text-muted-foreground text-xs">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    id="goals"
                    name="goals"
                    defaultValue={item?.goals ?? "cutting, maintenance, bulking"}
                    placeholder="cutting, maintenance, bulking"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="calories">Calories</Label>
                    <Input
                      id="calories"
                      name="calories"
                      type="number"
                      defaultValue={item?.calories ?? ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="protein">Protein (g)</Label>
                    <Input
                      id="protein"
                      name="protein"
                      type="number"
                      step="0.1"
                      defaultValue={item?.protein ?? ""}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {item && (
            <DeleteMenuItemButton id={item.id} />
          )}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-xs text-muted-foreground flex-1 flex items-center justify-center">
          Not set
        </p>
      ) : (
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium leading-tight">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate" title={item.description}>{item.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DeleteMenuItemButton({ id }: { id: string }) {
  const [pending, startTransition] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        startTransition(true);
        deleteMenuItemAction(id).finally(() => startTransition(false));
      }}
    >
      <Trash2 size={12} />
    </Button>
  );
}
