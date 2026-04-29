import type { Account, Adapter, ChatRequest } from "../types.js";

/**
 * 通用 OpenAI 兼容适配器
 * 用于适配 阿里云百炼 (DashScope)、DeepSeek、Groq 等支持 OpenAI 格式的服务商
 */
export class CustomAdapter implements Adapter {
  async handleChat(request: ChatRequest, account: Account): Promise<Response> {
    const baseUrl = (account.base_url || "https://api.openai.com/v1").replace(/\/$/, "");
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${account.api_key}`,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[Custom Adapter] External API Error (${response.status}):`, errorData);
        return new Response(errorData, { 
          status: response.status,
          headers: { "Content-Type": "application/json" }
        });
      }

      // 直接透传流或普通响应
      return response;
    } catch (e: any) {
      console.error(`[Custom Adapter] Fetch error:`, e.message);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  async listModels(account: Account): Promise<any[]> {
    if (!account.base_url) return [];
    
    const baseUrl = account.base_url.replace(/\/$/, "");
    const url = `${baseUrl}/models`;

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${account.api_key}`,
        },
        signal: AbortSignal.timeout(30000) // 15秒超时，防止供应商 API 拖累网关
      });
      
      if (!response.ok) {
        console.warn(`[Custom Adapter] Could not fetch models from ${url} (Status: ${response.status})`);
        return [];
      }

      const data = await response.json() as any;
      const models = (data.data || []).map((m: any) => ({
        id: m.id,
        object: "model",
        created: m.created || Date.now(),
        owned_by: account.alias
      }));

      console.log(`[Custom Adapter] ${account.alias} successfully listed ${models.length} models.`);
      return models;
    } catch (err: any) {
      console.warn(`[Custom Adapter] listModels error for ${account.alias}:`, err.message);
      return [];
    }
  }
}

export const customAdapter = new CustomAdapter();
