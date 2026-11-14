const { spawn } = require("node:child_process");
const path = require("node:path");
const { createFrontendContext } = require("./build");

const ROOT = path.resolve(__dirname, "..");
let context;
let server;
let stopping = false;

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (server && server.exitCode === null) server.kill();
  if (context) await context.dispose();
  process.exitCode = exitCode;
}

async function start() {
  context = await createFrontendContext({ watch: true });
  server = spawn(process.execPath, ["--watch", "backend/server.js"], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit"
  });
  server.on("error", error => {
    console.error("Could not start the DineSync API:", error);
    stop(1);
  });
  server.on("exit", code => {
    if (!stopping) stop(code || 0);
  });
  console.log("DineSync is available at http://localhost:3000");
  console.log("Frontend changes rebuild automatically; refresh the browser to see them.");
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

start().catch(error => {
  console.error("Development server failed to start:", error);
  stop(1);
});
