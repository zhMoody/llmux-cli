import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DATABASE_PATH } from "../env.js";
import { INIT_TABLES, SEED_DATA } from "./schema.js";
import { migrateLegacyKeys } from "../services/crypto.js";

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

  try {
    db.run("ALTER TABLE accounts ADD COLUMN limits_cache_updated_at DATETIME;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: accounts limits_cache_updated_at]", e.message);
    }
  }

  try {
    db.run("ALTER TABLE accounts ADD COLUMN anthropic_base_url TEXT;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: accounts anthropic_base_url]", e.message);
    }
  }

  // 迁移 usage_logs.timestamp：DATETIME 字符串 → 毫秒 INTEGER
  try {
    const sample = db.query("SELECT timestamp FROM usage_logs LIMIT 1").get() as { timestamp: unknown } | undefined;
    if (sample && typeof sample.timestamp === "string") {
      console.log("[DB Migration] Converting usage_logs.timestamp from UTC string to milliseconds...");
      db.transaction(() => {
        db.run(`CREATE TABLE usage_logs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT,
          model TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          latency_ms INTEGER,
          success INTEGER,
          error_message TEXT,
          is_test INTEGER DEFAULT 0
        );`);
        db.run(`INSERT INTO usage_logs_new (id, timestamp, account_id, provider_id, model, input_tokens, output_tokens, latency_ms, success, error_message, is_test)
          SELECT id, CAST(strftime('%s', timestamp) AS INTEGER) * 1000,
            account_id, provider_id, model, input_tokens, output_tokens, latency_ms, success, error_message, is_test
          FROM usage_logs;`);
        db.run("DROP TABLE usage_logs;");
        db.run("ALTER TABLE usage_logs_new RENAME TO usage_logs;");
      })();
      console.log("[DB Migration] usage_logs.timestamp migration completed");
    }
  } catch (e: any) {
    console.error("[DB Migration Error: usage_logs timestamp]", e.message);
  }

  try {
    db.run("ALTER TABLE usage_logs ADD COLUMN cache_read_input_tokens INTEGER DEFAULT 0;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: usage_logs cache_read_input_tokens]", e.message);
    }
  }

  try {
    db.run("ALTER TABLE usage_logs ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT 0;");
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      console.error("[DB Migration Error: usage_logs cache_creation_input_tokens]", e.message);
    }
  }

  console.log(`[DB] Database initialized at: ${DATABASE_PATH}`);
  migrateLegacyKeys(db);
}
