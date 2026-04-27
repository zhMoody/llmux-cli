import { healthService } from "../src/services/health.js";
import { initDb } from "../src/db/index.js";

async function main() {
  // 1. 初始化数据库
  initDb();

  // 2. 执行探活
  const results = await healthService.checkAll();
  
  console.log("\n--- Health Check Report ---");
  console.table(results);
  process.exit(0);
}

main();
