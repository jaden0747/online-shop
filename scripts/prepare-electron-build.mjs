import { copyFileSync, cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const nextDir = path.join(rootDir, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");
const runtimeSourceDir = path.join(
  rootDir,
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server"
);
const runtimeTargetDir = path.join(
  standaloneDir,
  "node_modules",
  "next",
  "dist",
  "compiled",
  "next-server"
);

console.log("==> Preparing Next.js output for Electron...");
rmSync(nextDir, { recursive: true, force: true });
execSync("npx next build", { cwd: rootDir, stdio: "inherit" });

cpSync(path.join(rootDir, "public"), path.join(standaloneDir, "public"), {
  recursive: true,
  force: true,
});
mkdirSync(standaloneNextDir, { recursive: true });
cpSync(path.join(nextDir, "static"), path.join(standaloneNextDir, "static"), {
  recursive: true,
  force: true,
});

mkdirSync(runtimeTargetDir, { recursive: true });
for (const entry of readdirSync(runtimeSourceDir)) {
  if (!entry.endsWith(".runtime.prod.js")) continue;
  copyFileSync(path.join(runtimeSourceDir, entry), path.join(runtimeTargetDir, entry));
}

console.log("==> Electron build assets are ready.");
