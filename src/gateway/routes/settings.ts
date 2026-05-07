import { settingsService } from "../../services/settings.js";
import { db } from "../../db/index.js";
import { decryptKey, encryptKey } from "../../services/crypto.js";

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
      const tables = ['usage_logs', 'api_keys', 'model_aliases', 'accounts'];
      for (const table of tables) {
        db.run(`DELETE FROM ${table}`);
        console.log(`[Purge] Cleared table: ${table}`);
      }
    })();

    db.run("VACUUM");
    console.log("[Purge] Database VACUUM complete.");

    console.log("✅ [Settings] Full reset successful. System is now clean.");
    return Response.json({ success: true, message: "System heart-reset complete" });
  } catch (err: any) {
    console.error("❌ [Settings] Purge operation failed:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export function exportConfig() {
  try {
    const accounts = (db.query("SELECT alias, provider_id, api_key, base_url, anthropic_base_url, is_active, weight, notes FROM accounts").all() as any[])
      .map((a) => ({ ...a, api_key: decryptKey(a.api_key) }));
    const aliases = db.query("SELECT alias, target_model, provider_id FROM model_aliases").all();
    const keys = db.query("SELECT name, key, allowed_models FROM api_keys").all();
    const settings = db.query("SELECT key, value FROM settings").all();

    const payload = JSON.stringify({ version: 1, accounts, aliases, keys, settings }, null, 2);

    return new Response(payload, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="llmux-config-${Date.now()}.json"`
      }
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function importConfig(req: Request) {
  try {
    const body = await req.json() as any;
    const { accounts = [], aliases = [], keys = [], settings: s = [] } = body;

    db.transaction(() => {
      for (const a of accounts) {
        db.prepare(`INSERT OR REPLACE INTO accounts (alias, provider_id, api_key, base_url, anthropic_base_url, is_active, weight, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(a.alias, a.provider_id, encryptKey(a.api_key), a.base_url ?? null, a.anthropic_base_url ?? null, a.is_active ?? 1, a.weight ?? 1, a.notes ?? null);
      }
      for (const al of aliases) {
        db.prepare(`INSERT OR REPLACE INTO model_aliases (alias, target_model, provider_id) VALUES (?, ?, ?)`)
          .run(al.alias, al.target_model, al.provider_id ?? null);
      }
      for (const k of keys) {
        db.prepare(`INSERT OR REPLACE INTO api_keys (name, key, allowed_models) VALUES (?, ?, ?)`)
          .run(k.name, k.key, k.allowed_models ?? '*');
      }
      for (const { key, value } of s) {
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value);
      }
    })();

    return Response.json({ success: true, imported: { accounts: accounts.length, aliases: aliases.length, keys: keys.length } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

