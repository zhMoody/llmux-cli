
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";

const defaultDataDir = process.platform === "win32"
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "llmux")
  : join(homedir(), ".config", "llmux");

const DATABASE_PATH = join(defaultDataDir, "db.sqlite");
const db = new Database(DATABASE_PATH);

const result = db.query("SELECT COUNT(*), MAX(timestamp) as last_ts FROM usage_logs").get();
console.log(JSON.stringify(result));
