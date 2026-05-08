"use server";

import { enableTestingMode, disableTestingMode, loadScenario, type ScenarioId } from "@/lib/data/testing";
import { revalidatePath } from "next/cache";

export async function enableTestingAction() {
  enableTestingMode();
  revalidatePath("/", "layout");
}

export async function disableTestingAction() {
  disableTestingMode();
  revalidatePath("/", "layout");
}

export async function loadScenarioAction(id: ScenarioId) {
  loadScenario(id);
  revalidatePath("/", "layout");
}
