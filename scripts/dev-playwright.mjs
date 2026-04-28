import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

// E2E specs install network mocks via page.route, so the supabase-js client
// never makes real HTTP calls — but supabase.js (src/lib/supabase.js) throws
// at module load if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing,
// which prevents the React app from mounting and surfaces every spec as a
// timeout on the first locator. Provide placeholder values for test runs so
// the client constructs cleanly; the mocks handle every real request.
// Match the same fallback the E2E spec files use (e.g.
// tests/e2e/critical-flows.spec.js:7) so the projectRef used to derive the
// storage key (`sb-<projectRef>-auth-token`) is identical on both sides:
// the browser reads from VITE_SUPABASE_URL, the test runner reads from
// process.env.VITE_SUPABASE_URL via dotenv, and a mismatch makes the seeded
// auth token invisible to the app — every spec then falls back to the role
// chooser and times out on the first dashboard locator.
const placeholderEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key",
};
const childEnv = { ...process.env };
for (const [key, value] of Object.entries(placeholderEnv)) {
  if (!childEnv[key]) childEnv[key] = value;
}

const child = spawn(
  npmCommand,
  ["run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"],
  {
    stdio: "inherit",
    env: childEnv,
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
