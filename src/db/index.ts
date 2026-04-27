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
  console.log(`[DB] Database initialized at: ${DATABASE_PATH}`);
}
