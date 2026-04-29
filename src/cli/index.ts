#!/usr/bin/env bun
import { cac } from "cac";
import { startCommand } from "./commands/start.js";
import { env } from "../env.js";

import packageJson from "../../package.json" with { type: "json" };

const cli = cac("llmux");

cli
  .command("start", "Start the llmux gateway and Web UI")
  .option("--port <port>", "Port to listen on", { default: env.PORT })
  .option("--no-browser", "Do not open browser on start")
  .action(async (options) => {
    await startCommand(options);
  });

cli
  .command("stop", "Stop the running llmux service")
  .action(() => {
    console.log("Stop functionality is reserved for future background service (daemon) management.");
    console.log("For now, please use Ctrl+C to stop the process.");
  });

cli
  .command("status", "Check the status of llmux service")
  .action(() => {
    console.log("Status functionality is reserved for checking background service (daemon) state.");
    console.log("Current process is running in the foreground.");
  });

cli.help();
cli.version(packageJson.version);

// 如果没有传入任何命令（例如双击exe运行），默认执行 start 命令
if (process.argv.length === 2) {
  process.argv.push("start");
}

cli.parse();
