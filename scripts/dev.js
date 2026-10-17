const { spawn } = require("node:child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npmCommand, ["run", "dev:frontend"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
  spawn(npmCommand, ["run", "api:dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      shutdown(code || 1);
    }
  });
  child.on("error", () => shutdown(1));
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
