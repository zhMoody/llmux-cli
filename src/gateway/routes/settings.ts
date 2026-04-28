import { settingsService } from "../../services/settings.js";
import { db } from "../../db/index.js";

export function getSettings() {
  try {
    const data = settingsService.getAll();
    return Response.json(data);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function updateSettings(req: Request) {
  try {
    const body = await req.json();
    settingsService.batchSet(body);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export function purgeDatabase() {
  try {
    console.log("⚠️ [Settings] Starting critical database purge...");
    
    db.transaction(() => {
      // 按照外键依赖关系，先删日志，再删账号和 Key
      const tables = ['usage_logs', 'api_keys', 'model_aliases', 'accounts'];
      for (const table of tables) {
        db.run(`DELETE FROM ${table}`);
        console.log(`[Purge] Cleared table: ${table}`);
      }
    })();
    
    // 物理收缩磁盘空间并清空自增 ID (必须在事务之外执行)
    db.run("VACUUM");
    console.log("[Purge] Database VACUUM complete.");
    
    console.log("✅ [Settings] Full reset successful. System is now clean.");
    return Response.json({ success: true, message: "System heart-reset complete" });
  } catch (err: any) {
    console.error("❌ [Settings] Purge operation failed:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
