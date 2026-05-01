import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "../env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "llmux-salt-standard";
const LEGACY_FALLBACK_KEY = "default-fallback-insecure-key";

// 获取或生成持久化主密钥，返回 key 和是否是新生成的
const getMasterKey = (): { key: string; isNew: boolean } => {
  if (env.MASTER_KEY) return { key: env.MASTER_KEY, isNew: false };

  const keyPath = join(env.DATA_DIR, "master.key");
  if (existsSync(keyPath)) {
    return { key: readFileSync(keyPath, "utf8").trim(), isNew: false };
  }

  const generated = randomBytes(32).toString("hex");
  mkdirSync(env.DATA_DIR, { recursive: true });
  writeFileSync(keyPath, generated, { encoding: "utf8", mode: 0o600 });
  return { key: generated, isNew: true };
};

const { key: MASTER_KEY, isNew: IS_NEW_KEY } = getMasterKey();

function deriveKey(masterKey: string) {
  return scryptSync(masterKey, SALT, 32);
}

function encryptWith(text: string, masterKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(masterKey), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

function decryptWith(encryptedText: string, masterKey: string): string {
  const [ivHex, tagHex, content] = encryptedText.split(".");
  if (!ivHex || !tagHex || !content) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, deriveKey(masterKey), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * 加密 API Key，返回格式: iv.authTag.content (hex)
 */
export function encryptKey(text: string): string {
  return encryptWith(text, MASTER_KEY);
}

/**
 * 解密 API Key
 */
export function decryptKey(encryptedText: string): string {
  return decryptWith(encryptedText, MASTER_KEY);
}

/**
 * 启动时迁移：将旧 fallback key 加密的账号数据重新用新 key 加密
 * 仅在首次生成 master.key 时执行
 */
export function migrateLegacyKeys(db: { query: Function; prepare: Function }) {
  if (!IS_NEW_KEY) return;

  const accounts = db.query("SELECT id, alias, api_key FROM accounts").all() as {
    id: number; alias: string; api_key: string;
  }[];

  if (accounts.length === 0) return;

  let migrated = 0;
  for (const acc of accounts) {
    try {
      const plain = decryptWith(acc.api_key, LEGACY_FALLBACK_KEY);
      const reEncrypted = encryptWith(plain, MASTER_KEY);
      db.prepare("UPDATE accounts SET api_key = ? WHERE id = ?").run(reEncrypted, acc.id);
      migrated++;
    } catch {
      // 解密失败说明不是旧 key 加密的，跳过
    }
  }

  if (migrated > 0) {
    console.log(`[Crypto] Migrated ${migrated} account key(s) to new master key.`);
  }
}
