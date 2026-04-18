import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_KAKAO_REST_KEY: "",
  VITE_QONVERSION_PROJECT_KEY: "",
};

const child = spawn(
  npmCommand,
  ["run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"],
  {
    stdio: "inherit",
    env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
