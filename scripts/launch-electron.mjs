import { spawn } from "node:child_process";
import process from "node:process";

const child = spawn("npx", ["electron", "."], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: "http://127.0.0.1:5273"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
