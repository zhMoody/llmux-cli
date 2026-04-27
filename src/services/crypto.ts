import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";
import { env } from "../env.js";

// AES-256-GCM 算法要求 32 字节密钥
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT = "llmux-salt-standard";

// 派生加密密钥
const getEncryptionKey = () => {
  const masterKey = env.MASTER_KEY || "default-fallback-insecure-key";
  return scryptSync(masterKey, SALT, 32);
};

/**
 * 加密 API Key
 * 返回格式: iv.authTag.content (hex)
 */
export function encryptKey(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

/**
 * 解密 API Key
 */
export function decryptKey(encryptedText: string): string {
  const [ivHex, tagHex, content] = encryptedText.split(".");
  if (!ivHex || !tagHex || !content) {
    throw new Error("Invalid encrypted format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = getEncryptionKey();
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
