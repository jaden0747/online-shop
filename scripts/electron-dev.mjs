import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT ?? 3000);
const devUrl = `http://127.0.0.1:${port}`;
const binExt = process.platform === "win32" ? ".cmd" : "";
const nextBin = path.join(rootDir, "node_modules", ".bin", `next${binExt}`);
const electronBin = path.join(rootDir, "node_modules", ".bin", `electron${binExt}`);

let nextProcess = null;
let electronProcess = null;
let shuttingDown = false;

function canReachDevServer() {
  return new Promise((resolve) => {
    const req = http.get(devUrl, (res) => {
      res.resume();
      resolve(true);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForDevServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canReachDevServer()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next dev server was not reachable at ${devUrl} within ${timeoutMs / 1000}s`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electronProcess && !electronProcess.killed) electronProcess.kill();
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
  process.exitCode = code;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal === "SIGINT" ? 130 : 143));
}

const existingServer = await canReachDevServer();
if (!existingServer) {
  console.log(`[electron-dev] Starting Next dev server on ${devUrl}`);
  nextProcess = spawn(nextBin, ["dev", "-p", String(port)], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });
  nextProcess.on("exit", (code, signal) => {
    if (!shuttingDown && electronProcess) {
      console.error(`[electron-dev] Next dev server exited (${signal ?? code})`);
      shutdown(code ?? 1);
    }
  });
  await waitForDevServer();
} else {
  console.log(`[electron-dev] Reusing existing Next dev server at ${devUrl}`);
}

electronProcess = spawn(electronBin, ["."], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

electronProcess.on("exit", (code, signal) => {
  if (!shuttingDown) {
    console.log(`[electron-dev] Electron exited (${signal ?? code ?? 0})`);
    shutdown(code ?? 0);
  }
});
