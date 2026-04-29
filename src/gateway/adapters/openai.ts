import type { Account, Adapter, ChatRequest } from "../types.js";

/**
 * OpenAI 适配器
 * 支持官方 API 及所有 OpenAI 兼容接口（如 Ollama, DeepSeek 等）
 */
export class OpenAIAdapter implements Adapter {
  async handleChat(request: ChatRequest, account: Account): Promise<Response> {
    const baseUrl = account.base_url || "https://api.openai.com/v1";
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.api_key}`,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    return response;
  }

  async listModels(account: Account): Promise<any[]> {
    const baseUrl = account.base_url || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${account.api_key}` },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) return [];
    const data = await response.json() as any;
    return (data.data || []).map((m: any) => ({ ...m, owned_by: account.alias }));
  }
}

export const openaiAdapter = new OpenAIAdapter();
