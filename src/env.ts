// Loads .env.local before any other module reads process.env.
// Imported first in main.ts: ESM evaluates imports in order, so this runs before led.ts and jev.ts.
// The project's own .env.local wins over the repo root's; variables already in the environment win over both.

import { fileURLToPath } from "node:url";

for (const rel of ["../.env.local", "../../.env.local"]) {
  try {
    process.loadEnvFile(fileURLToPath(new URL(rel, import.meta.url)));
  } catch {
    /* file missing is fine */
  }
}
