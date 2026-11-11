// Boots an isolated MongoDB + the production build, runs Playwright, tears down.
// Usage: npm run build && npm run test:e2e
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = process.env.E2E_PORT ?? "3100";
const mongod = await MongoMemoryServer.create();
const env = {
  ...process.env,
  MONGODB_URI: mongod.getUri(),
  MONGODB_DB_NAME: "spendly_e2e",
  AUTH_SECRET: "e2e-auth-secret-that-is-at-least-32-characters",
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  PORT,
};

// Refuse to run against a stale server left on the port
try {
  await fetch(`http://localhost:${PORT}/login`);
  console.error(`Port ${PORT} is already in use — stop the existing server first.`);
  await mongod.stop();
  process.exit(1);
} catch {}

// detached → own process group, so we can stop npx *and* the next-server child
const server = spawn("npx", ["next", "start", "-p", PORT], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

const cleanup = async (code) => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await mongod.stop();
  process.exit(code);
};

// Wait for readiness
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    const res = await fetch(`http://localhost:${PORT}/login`);
    if (res.ok) break;
  } catch {}
  if (Date.now() > deadline) {
    console.error("Server did not start:\n" + serverLog);
    await cleanup(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

const pw = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], {
  env: { ...env, E2E_BASE_URL: `http://localhost:${PORT}` },
  stdio: "inherit",
});
pw.on("exit", async (code) => {
  if (code !== 0) console.error("\n--- server log (tail) ---\n" + serverLog.split("\n").slice(-40).join("\n"));
  await cleanup(code ?? 1);
});
