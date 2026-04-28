import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DATABASE_PATH, env } from "../env.js";
import { INIT_TABLES, SEED_DATA } from "./schema.js";

// 确保目录存在
try {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
} catch (e) {
  // Directory might already exist
}

// 初始化数据库
export const db = new Database(DATABASE_PATH);

/**
 * 执行数据库初始化
 */
export function initDb() {
  db.run("PRAGMA foreign_keys = ON;");
  db.transaction(() => {
    db.run(INIT_TABLES);
    db.run(SEED_DATA);
  })();

  // 运行可能需要的迁移
  try {
    db.run("ALTER TABLE accounts ADD COLUMN limits_cache TEXT;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: accounts]", e.message);
    }
  }

  try {
    db.run("ALTER TABLE usage_logs ADD COLUMN is_test INTEGER DEFAULT 0;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: usage_logs]", e.message);
    }
  }

  console.log(`[DB] Database initialized at: ${DATABASE_PATH}`);
}
