import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { DataDirectoryPicker } from "@/components/data-directory-picker";

afterEach(() => {
  delete (window as any).electronAPI;
});

function makeElectronAPI(dir = "/Users/test/data") {
  return {
    getDataDirectory: vi.fn().mockResolvedValue(dir),
    selectDataDirectory: vi.fn().mockResolvedValue("/Users/test/new-data"),
  };
}

describe("DataDirectoryPicker", () => {
  it("shows non-Electron message when electronAPI is absent", () => {
    render(<DataDirectoryPicker />);
    expect(screen.getByText(/only available in the desktop app/i)).toBeInTheDocument();
  });

  it("renders the current data directory path", async () => {
    (window as any).electronAPI = makeElectronAPI("/Users/phong/shop/data");
    await act(async () => render(<DataDirectoryPicker />));
    await waitFor(() =>
      expect(screen.getByTestId("data-directory-path")).toHaveTextContent("/Users/phong/shop/data")
    );
  });

  it("shows change directory button", async () => {
    (window as any).electronAPI = makeElectronAPI();
    await act(async () => render(<DataDirectoryPicker />));
    expect(screen.getByTestId("data-directory-change-btn")).toBeInTheDocument();
  });

  it("updates path and shows restart prompt after selecting a new directory", async () => {
    const api = makeElectronAPI("/old/path");
    (window as any).electronAPI = api;
    await act(async () => render(<DataDirectoryPicker />));

    await act(async () => {
      fireEvent.click(screen.getByTestId("data-directory-change-btn"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("data-directory-path")).toHaveTextContent("/Users/test/new-data")
    );
    expect(screen.getByTestId("data-directory-restart-prompt")).toBeInTheDocument();
  });

  it("does not show restart prompt when dialog is cancelled", async () => {
    const api = {
      getDataDirectory: vi.fn().mockResolvedValue("/old/path"),
      selectDataDirectory: vi.fn().mockResolvedValue(null),
    };
    (window as any).electronAPI = api;
    await act(async () => render(<DataDirectoryPicker />));

    await act(async () => {
      fireEvent.click(screen.getByTestId("data-directory-change-btn"));
    });

    expect(screen.queryByTestId("data-directory-restart-prompt")).not.toBeInTheDocument();
  });
});
