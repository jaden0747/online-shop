import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppVersionBadge } from "@/components/app-version-badge";

describe("AppVersionBadge", () => {
  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it("renders version from electronAPI", async () => {
    (window as any).electronAPI = {
      getAppVersion: vi.fn().mockResolvedValue("1.2.3"),
    };
    render(<AppVersionBadge />);
    await waitFor(() =>
      expect(screen.getByTestId("app-version-badge")).toHaveTextContent("v1.2.3")
    );
  });

  it("renders version from fetch fallback when no electronAPI", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ version: "0.9.0" }),
    } as any);
    render(<AppVersionBadge />);
    await waitFor(() =>
      expect(screen.getByTestId("app-version-badge")).toHaveTextContent("v0.9.0")
    );
  });

  it("renders nothing when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network"));
    render(<AppVersionBadge />);
    await waitFor(() =>
      expect(screen.queryByTestId("app-version-badge")).not.toBeInTheDocument()
    );
  });
});
