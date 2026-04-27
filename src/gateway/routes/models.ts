import { db } from "../../db/index.js";
import { dispatcher } from "../../services/dispatcher.js";

/**
 * 获取所有可用模型（聚合所有活跃账户）
 */
export async function getAvailableModels() {
  try {
    const models = await dispatcher.listAllModels();
    return Response.json(models);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 获取所有模型别名
 */
export async function getModelAliases() {
  try {
    const stmt = db.query("SELECT * FROM model_aliases");
    const aliases = stmt.all();
    return Response.json(aliases);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 添加或更新模型别名
 */
export async function setModelAlias(req: Request) {
  try {
    const body = await req.json() as any;
    const { alias, target_model, provider_id } = body;

    if (!alias || !target_model) {
      return Response.json({ error: "Missing required fields: alias, target_model" }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO model_aliases (alias, target_model, provider_id)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(alias, target_model, provider_id || null);

    return Response.json({ success: true, message: "Alias set successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 删除模型别名
 */
export async function deleteModelAlias(id: string) {
  try {
    const stmt = db.prepare("DELETE FROM model_aliases WHERE id = ?");
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      return Response.json({ error: "Alias not found" }, { status: 404 });
    }

    return Response.json({ success: true, message: "Alias deleted successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
