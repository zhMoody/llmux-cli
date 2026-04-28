import { db } from "../../db/index.js";
import { encryptKey } from "../../services/crypto.js";

/**
 * 获取所有账户列表 (脱敏处理)
 */
export async function listAccounts() {
  const stmt = db.query("SELECT id, alias, provider_id, base_url, is_active, weight, notes, created_at FROM accounts ORDER BY created_at DESC");
  const accounts = stmt.all();
  return Response.json(accounts);
}

/**
 * 添加新账户
 */
export async function createAccount(req: Request) {
  try {
    const body = await req.json() as any;
    const { alias, provider_id, api_key, base_url, weight, notes } = body;

    if (!alias || !provider_id || !api_key) {
      return Response.json({ error: "Missing required fields: alias, provider_id, api_key" }, { status: 400 });
    }

    const encryptedKey = encryptKey(api_key);

    const stmt = db.prepare(`
      INSERT INTO accounts (alias, provider_id, api_key, base_url, weight, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(alias, provider_id, encryptedKey, base_url || null, weight || 1, notes || null);

    return Response.json({ success: true, message: "Account created successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 更新账户信息
 */
export async function updateAccount(id: string, req: Request) {
  try {
    const body = await req.json() as any;
    const { alias, provider_id, api_key, base_url, is_active, weight, notes } = body;

    // 1. 先检查账户是否存在
    const existing = db.query("SELECT * FROM accounts WHERE id = ?").get(id) as any;
    if (!existing) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    // 2. 准备更新字段
    let updatedKey = existing.api_key;
    if (api_key && api_key !== "********") {
      updatedKey = encryptKey(api_key);
    }

    const stmt = db.prepare(`
      UPDATE accounts 
      SET alias = ?, provider_id = ?, api_key = ?, base_url = ?, is_active = ?, weight = ?, notes = ?
      WHERE id = ?
    `);

    stmt.run(
      alias || existing.alias,
      provider_id || existing.provider_id,
      updatedKey,
      base_url !== undefined ? base_url : existing.base_url,
      is_active !== undefined ? is_active : existing.is_active,
      weight !== undefined ? weight : existing.weight,
      notes !== undefined ? notes : existing.notes,
      id
    );

    return Response.json({ success: true, message: "Account updated successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 删除账户 (连带删除所有用量日志及历史记录)
 */
export async function deleteAccount(id: string) {
  try {
    const info = db.transaction(() => {
      // 1. 删除所有关联的用量记录
      db.prepare("DELETE FROM usage_logs WHERE account_id = ?").run(id);
      // 2. 删除账户本身
      const stmt = db.prepare("DELETE FROM accounts WHERE id = ?");
      return stmt.run(id);
    })();
    
    if (info.changes === 0) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    return Response.json({ success: true, message: "Account and all associated history deleted successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 导出账户用量数据为 CSV
 */
export async function exportAccountUsage(id: string) {
  try {
    const logs = db.query("SELECT timestamp, model, input_tokens, output_tokens, latency_ms, success FROM usage_logs WHERE account_id = ? ORDER BY timestamp DESC").all(id) as any[];
    
    const headers = ["Timestamp", "Model", "Input Tokens", "Output Tokens", "Latency (ms)", "Status"];
    const csvContent = [
      headers.join(","),
      ...logs.map(log => [
        log.timestamp,
        log.model,
        log.input_tokens,
        log.output_tokens,
        log.latency_ms,
        log.success === 1 ? "Success" : "Error"
      ].join(","))
    ].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="usage_history_account_${id}.csv"`
      }
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
