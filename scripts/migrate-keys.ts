/**
 * 迁移脚本：将数据库中用旧 key 加密的账号 API Key 重新用新 key 加密
 * 用法：bun run scripts/migrate-keys.ts
 */
import { Database } from "bun:sqlite";
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "llmux-salt-standard";

const OLD_MASTER_KEY = "default-fallback-insecure-key";

const dataDir = join(homedir(), ".config", "llmux");
const newMasterKey = readFileSync(join(dataDir, "master.key"), "utf8").trim();

function deriveKey(masterKey: string) {
  return scryptSync(masterKey, SALT, 32);
}

function decrypt(encryptedText: string, masterKey: string): string {
  const [ivHex, tagHex, content] = encryptedText.split(".");
  if (!ivHex || !tagHex || !content) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(masterKey);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function encrypt(text: string, masterKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

const dbPath = join(dataDir, "db.sqlite");
const db = new Database(dbPath);

const accounts = db.query("SELECT id, alias, api_key FROM accounts").all() as { id: number; alias: string; api_key: string }[];

console.log(`找到 ${accounts.length} 个账号，开始迁移...`);

let success = 0;
let failed = 0;

for (const acc of accounts) {
  try {
    const plainKey = decrypt(acc.api_key, OLD_MASTER_KEY);
    const newEncrypted = encrypt(plainKey, newMasterKey);
    db.prepare("UPDATE accounts SET api_key = ? WHERE id = ?").run(newEncrypted, acc.id);
    console.log(`✓ ${acc.alias} (ID: ${acc.id}) 迁移成功`);
    success++;
  } catch (e: any) {
    // 可能已经是新 key 加密的，尝试用新 key 解密验证
    try {
      decrypt(acc.api_key, newMasterKey);
      console.log(`- ${acc.alias} (ID: ${acc.id}) 已是新 key，跳过`);
      success++;
    } catch {
      console.error(`✗ ${acc.alias} (ID: ${acc.id}) 迁移失败: ${e.message}`);
      failed++;
    }
  }
}

db.close();
console.log(`\n完成：${success} 成功，${failed} 失败`);
