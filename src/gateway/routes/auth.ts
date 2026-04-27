import { db } from "../../db/index.js";
import { encryptKey } from "../../services/crypto.js";

/**
 * 接收手动抓取的 Web Session Token
 */
export async function handleWebSession(req: Request) {
  try {
    const body = await req.json() as any;
    const { token, provider, alias } = body;

    if (!token || !provider) {
      return Response.json({ error: "Missing token or provider" }, { status: 400 });
    }

    // 加密存储 Session Token
    const encryptedToken = encryptKey(token);
    const finalAlias = alias || `${provider}-web-${Math.floor(Math.random() * 1000)}`;

    const stmt = db.prepare(`
      INSERT INTO accounts (alias, provider_id, api_key, is_active, weight, notes)
      VALUES (?, ?, ?, 1, 1, ?)
    `);
    
    stmt.run(finalAlias, `${provider}-web`, encryptedToken, "Imported via Web Session Capture");

    console.log(`[Auth] Successfully imported Web Session for ${provider}`);

    return Response.json({ 
      success: true, 
      message: `Web Session for ${provider} imported successfully as ${finalAlias}` 
    });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
