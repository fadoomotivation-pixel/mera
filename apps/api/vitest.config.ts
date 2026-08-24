import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envTestPath = path.join(dir, ".env.test");
const envVars: Record<string, string> = {};
try {
  for (const line of readFileSync(envTestPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (m) envVars[m[1]!] = m[2]!;
  }
} catch {
  // no .env.test — fall back to whatever the shell already has set
}

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false, // shared Postgres test DB — avoid cross-test races
    env: envVars,
  },
});
