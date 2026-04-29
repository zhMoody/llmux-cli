import { db } from "../../db/index.js";
import { decryptKey, encryptKey } from "../../services/crypto.js";
import { openaiAdapter } from "../adapters/openai.js";
import { anthropicAdapter } from "../adapters/anthropic.js";
import { geminiAdapter } from "../adapters/gemini.js";
import { customAdapter } from "../adapters/custom.js";

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

    // --- 强制校验逻辑 ---
    // 构造临时账户对象进行校验
    const tempAccount = { id: 0, alias, provider_id, api_key, base_url: base_url || null, is_active: 1, weight: 1 };
    let models: any[] = [];
    
    try {
      // 根据厂商类型获取模型列表
      const providerMeta = db.query("SELECT type FROM providers WHERE id = ?").get(provider_id) as { type: string } | undefined;
      const type = providerMeta?.type || provider_id;

      if (type === "openai") models = await openaiAdapter.listModels(tempAccount);
      else if (type === "anthropic") models = await anthropicAdapter.listModels(tempAccount);
      else if (type === "gemini") models = await geminiAdapter.listModels(tempAccount);
      else if (["custom", "poe", "claude", "qwen"].includes(type)) models = await customAdapter.listModels(tempAccount);

      if (models.length === 0) {
        return Response.json({ error: "accounts.validationFailed" }, { status: 400 });
      }
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    // --- 校验结束 ---

    const stmt = db.prepare(`
      INSERT INTO accounts (alias, provider_id, api_key, base_url, weight, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(alias, provider_id, encryptedKey, base_url || null, weight || 1, notes || null);

    return Response.json({ 
      success: true, 
      message: "Account verified and created successfully", 
      modelCount: models.length 
    });
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

    // --- 强制校验逻辑 ---
    // 如果修改了关键信息，需要重新校验
    if (api_key !== "********" || base_url !== undefined) {
      const tempAccount = { 
        id: parseInt(id), 
        alias: alias || existing.alias, 
        provider_id: provider_id || existing.provider_id, 
        api_key: (api_key && api_key !== "********") ? api_key : decryptKey(existing.api_key), 
        base_url: base_url !== undefined ? base_url : existing.base_url, 
        is_active: is_active !== undefined ? is_active : existing.is_active, 
        weight: weight !== undefined ? weight : existing.weight 
      };
      
      try {
        const providerMeta = db.query("SELECT type FROM providers WHERE id = ?").get(tempAccount.provider_id) as { type: string } | undefined;
        const type = providerMeta?.type || tempAccount.provider_id;
        let models: any[] = [];

        if (type === "openai") models = await openaiAdapter.listModels(tempAccount);
        else if (type === "anthropic") models = await anthropicAdapter.listModels(tempAccount);
        else if (type === "gemini") models = await geminiAdapter.listModels(tempAccount);
        else if (["custom", "poe", "claude", "qwen"].includes(type)) models = await customAdapter.listModels(tempAccount);

        if (models.length === 0) {
          return Response.json({ error: "accounts.validationFailed" }, { status: 400 });
        }
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    }
    // --- 校验结束 ---

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
