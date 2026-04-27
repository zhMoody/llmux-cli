import { db } from "../src/db/index.js";
import { encryptKey } from "../src/services/crypto.js";

async function main() {
  const apiKey = process.argv[2];
  const provider = process.argv[3] || "openai"; // 默认 openai，可传入 gemini 或 anthropic
  
  if (!apiKey) {
    console.error("❌ 错误: 请提供 API Key。用法: bun run scripts/add-test-account.ts <API_KEY> [provider]");
    process.exit(1);
  }

  const encryptedKey = encryptKey(apiKey);
  const alias = `My${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

  // 插入账户
  db.run(`
    INSERT INTO accounts (alias, provider_id, api_key, is_active, weight)
    VALUES (?, ?, ?, ?, ?)
  `, [alias, provider, encryptedKey, 1, 1]);

  console.log(`✅ ${provider} 账户 '${alias}' 已存入数据库。`);
  process.exit(0);
}

main();
