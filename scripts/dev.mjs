import { spawn } from "node:child_process";

const processes = [
  spawn(process.execPath, ["--env-file=.env", "server.mjs"], {
    stdio: "inherit",
  }),
  spawn("npm", ["--prefix", "frontend", "run", "dev", "--", "--host", "127.0.0.1"], {
    stdio: "inherit",
  }),
];

function shutdown(signal = "SIGTERM") {
  for (const child of processes) child.kill(signal);
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
    shutdown();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
