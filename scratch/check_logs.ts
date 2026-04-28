
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";

const defaultDataDir = process.platform === "win32"
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "llmux")
  : join(homedir(), ".config", "llmux");

const DATABASE_PATH = join(defaultDataDir, "db.sqlite");
const db = new Database(DATABASE_PATH);

console.log("--- Last 10 Logs ---");
const logs = db.query("SELECT id, timestamp, model, success, is_test FROM usage_logs ORDER BY id DESC LIMIT 10").all();
console.table(logs);

const summary = db.query("SELECT COUNT(*) as count, MIN(timestamp), MAX(timestamp) FROM usage_logs").get();
console.log("Summary:", summary);
