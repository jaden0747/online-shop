import { isTestingMode } from "@/lib/data/testing";
import { SidebarClient } from "./sidebar-client";

export function Sidebar() {
  const testingMode = isTestingMode();
  return <SidebarClient testingMode={testingMode} />;
}
