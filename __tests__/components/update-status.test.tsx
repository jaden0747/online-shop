import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { AppUpdateStatus } from "@/components/update-status";
import type { UpdateStatus } from "@/electron/electron.d";

function makeElectronAPI(statusToEmit?: UpdateStatus) {
  let captured: ((s: any) => void) | null = null;
  const api = {
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    installUpdate: vi.fn().mockResolvedValue(undefined),
    onUpdateStatus: vi.fn((cb: (s: any) => void) => {
      captured = cb;
      if (statusToEmit) cb(statusToEmit);
      return () => { captured = null; };
    }),
    emit: (s: any) => captured?.(s),
  };
  return api;
}

afterEach(() => {
  delete (window as any).electronAPI;
});

describe("AppUpdateStatus", () => {
  it("renders nothing when no electronAPI", () => {
    const { container } = render(<AppUpdateStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is null (electronAPI present, no status yet)", () => {
    (window as any).electronAPI = makeElectronAPI();
    const { container } = render(<AppUpdateStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders checking state", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "checking" });
    await act(async () => render(<AppUpdateStatus />));
    expect(screen.getByTestId("update-status-checking")).toBeInTheDocument();
  });

  it("renders up-to-date state", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "not-available" });
    await act(async () => render(<AppUpdateStatus />));
    expect(screen.getByTestId("update-status-up-to-date")).toBeInTheDocument();
  });

  it("renders update available state with version", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "available", version: "2.0.0" });
    await act(async () => render(<AppUpdateStatus />));
    const el = screen.getByTestId("update-status-available");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("2.0.0");
  });

  it("renders downloading state with percent", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "downloading", percent: 42 });
    await act(async () => render(<AppUpdateStatus />));
    const el = screen.getByTestId("update-status-downloading");
    expect(el).toHaveTextContent("42%");
  });

  it("renders install button when update is downloaded", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "downloaded", version: "2.0.0" });
    await act(async () => render(<AppUpdateStatus />));
    const btn = screen.getByTestId("update-status-install-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("2.0.0");
  });

  it("calls installUpdate when install button is clicked", async () => {
    const api = makeElectronAPI({ type: "downloaded", version: "2.0.0" });
    (window as any).electronAPI = api;
    await act(async () => render(<AppUpdateStatus />));
    fireEvent.click(screen.getByTestId("update-status-install-btn"));
    expect(api.installUpdate).toHaveBeenCalled();
  });

  it("renders error state", async () => {
    (window as any).electronAPI = makeElectronAPI({ type: "error", message: "network timeout" });
    await act(async () => render(<AppUpdateStatus />));
    expect(screen.getByTestId("update-status-error")).toBeInTheDocument();
  });
});
