import { startGateway } from "../../gateway/index.js";
import { initDb } from "../../db/index.js";

export async function startCommand(options: { port?: number; openBrowser?: boolean }) {
  console.log("Starting llmux...");
  
  // 1. 初始化数据库
  initDb();

  // 2. 启动 Gateway
  startGateway();

  // TODO: 如果需要，打开浏览器访问 Web UI
  if (options.openBrowser !== false) {
    // 逻辑待实现
  }
}
