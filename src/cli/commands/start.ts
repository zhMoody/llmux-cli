import { startGateway } from "../../gateway/index.js";
import { initDb, db } from "../../db/index.js";

export async function startCommand(options: { port?: number; openBrowser?: boolean }) {
  console.log("\n🚀 Starting LLMux Gateway...");
  
  // 1. 初始化数据库
  initDb();

  // 2. 检查安全状态
  const existingKey = db.query("SELECT * FROM api_keys LIMIT 1").get() as any;

  // 3. 启动 Gateway
  startGateway();

  if (!existingKey) {
    console.log("\n" + "!".repeat(50));
    console.log("⚠️  INSECURE MODE: No API Keys found.");
    console.log("   The gateway is currently OPEN to the network.");
    console.log("   Please go to the Web UI -> Keys to create a key.");
    console.log("!".repeat(50) + "\n");
  } else {
    console.log("\n" + "=".repeat(50));
    console.log("🛡️  GATEWAY SECURITY ACTIVE");
    console.log("   API Key authentication is required.");
    console.log("=".repeat(50) + "\n");
  }

  // TODO: 如果需要，打开浏览器访问 Web UI
  if (options.openBrowser !== false) {
    // 逻辑待实现
  }
}
