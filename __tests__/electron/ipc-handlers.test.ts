import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Helpers extracted from electron/main.js logic — tested here in isolation.

function readConfig(configPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, data: Record<string, string>) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
}

function resolveDataDir(configPath: string, fallback: string): string {
  const config = readConfig(configPath);
  if (config.dataDir && fs.existsSync(config.dataDir)) {
    return config.dataDir;
  }
  return fallback;
}

describe("IPC handler logic", () => {
  let tmpDir: string;
  let configPath: string;
  const fallback = "/default/userData/data";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-test-"));
    configPath = path.join(tmpDir, "app-config.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("readConfig", () => {
    it("returns empty object when config file does not exist", () => {
      expect(readConfig(configPath)).toEqual({});
    });

    it("returns parsed JSON from config file", () => {
      writeConfig(configPath, { dataDir: "/some/path" });
      expect(readConfig(configPath)).toEqual({ dataDir: "/some/path" });
    });

    it("returns empty object for malformed JSON", () => {
      fs.writeFileSync(configPath, "{ bad json }", "utf-8");
      expect(readConfig(configPath)).toEqual({});
    });
  });

  describe("writeConfig", () => {
    it("writes JSON to the config file", () => {
      writeConfig(configPath, { dataDir: "/my/dir" });
      const raw = fs.readFileSync(configPath, "utf-8");
      expect(JSON.parse(raw)).toEqual({ dataDir: "/my/dir" });
    });

    it("overwrites existing config", () => {
      writeConfig(configPath, { dataDir: "/old" });
      writeConfig(configPath, { dataDir: "/new" });
      expect(readConfig(configPath)).toEqual({ dataDir: "/new" });
    });
  });

  describe("resolveDataDir", () => {
    it("returns fallback when no config exists", () => {
      expect(resolveDataDir(configPath, fallback)).toBe(fallback);
    });

    it("returns fallback when configured path does not exist on disk", () => {
      writeConfig(configPath, { dataDir: "/nonexistent/path" });
      expect(resolveDataDir(configPath, fallback)).toBe(fallback);
    });

    it("returns configured path when it exists on disk", () => {
      writeConfig(configPath, { dataDir: tmpDir });
      expect(resolveDataDir(configPath, fallback)).toBe(tmpDir);
    });
  });
});
