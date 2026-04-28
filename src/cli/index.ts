#!/usr/bin/env bun
import { cac } from "cac";
import { startCommand } from "./commands/start.js";
import { env } from "../env.js";

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
    console.log("Stop functionality not yet implemented (use Ctrl+C for now).");
  });

cli
  .command("status", "Check the status of llmux service")
  .action(() => {
    console.log("LLMux status: running (assuming this process is active)");
  });

cli.help();
cli.version("1.0.0");

// 如果没有传入任何命令（例如双击exe运行），默认执行 start 命令
if (process.argv.length === 2) {
  process.argv.push("start");
}

cli.parse();
