import { db } from "../../db/index.js";

/**
 * 列出所有 API Key
 */
export async function listApiKeys() {
  const keys = db.query("SELECT id, name, key, allowed_models, created_at FROM api_keys ORDER BY created_at DESC").all();
  return Response.json(keys);
}

/**
 * 创建新的 API Key
 */
export async function createApiKey(req: Request) {
  try {
    const { name, allowed_models } = await req.json() as any;
    const newKey = `sk-llmux-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    db.prepare(`
      INSERT INTO api_keys (name, key, allowed_models)
      VALUES (?, ?, ?)
    `).run(name || "Untitled Key", newKey, allowed_models ? JSON.stringify(allowed_models) : "*");

    return Response.json({ success: true, key: newKey });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 删除 API Key
 */
export async function deleteApiKey(id: string) {
  db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  return Response.json({ success: true });
}

/**
 * 更新 API Key 配置 (不修改 Key 本身)
 */
export async function updateApiKey(id: string, req: Request) {
  try {
    const { name, allowed_models } = await req.json() as any;
    
    db.prepare(`
      UPDATE api_keys 
      SET name = ?, allowed_models = ?
      WHERE id = ?
    `).run(
      name || "Untitled Key", 
      typeof allowed_models === 'string' ? allowed_models : JSON.stringify(allowed_models),
      id
    );

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 校验权限中间件逻辑
 */
export function checkAuth(req: Request, requestedModel?: string): { authorized: boolean; error?: string } {


  const authHeader = req.headers.get("Authorization");
  const xApiKey = req.headers.get("x-api-key");
  const providedKey = (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : authHeader) || xApiKey;

  if (!providedKey) return { authorized: false, error: "Missing API Key. Gateway is locked." };

  const keyRecord = db.query("SELECT * FROM api_keys WHERE key = ?").get(providedKey) as any;
  
  if (!keyRecord) return { authorized: false, error: "Invalid API Key" };

  // 校验模型权限
  if (requestedModel && keyRecord.allowed_models !== "*") {
    try {
      const allowed = JSON.parse(keyRecord.allowed_models);
      if (Array.isArray(allowed) && !allowed.includes(requestedModel)) {
        return { authorized: false, error: `Model '${requestedModel}' is not authorized for this API Key` };
      }
    } catch (e) {
      return { authorized: false, error: "Invalid permission configuration on server" };
    }
  }

  return { authorized: true };
}
