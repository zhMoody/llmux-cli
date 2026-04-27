import { db } from "../db/index.js";
import { decryptKey } from "./crypto.js";
import { openaiAdapter } from "../gateway/adapters/openai.js";
import { anthropicAdapter } from "../gateway/adapters/anthropic.js";
import { geminiAdapter } from "../gateway/adapters/gemini.js";
import { usageService } from "./usage.js";
import type { ChatRequest, Account } from "../gateway/types.js";

// 用于保存各 Provider 的轮询游标（内存状态，重启后重置）
const accountIndices = new Map<string, number>();

export class Dispatcher {
  /**
   * 将模型别名解析为真实的模型名和对应的 Provider
   */
  resolveModel(modelName: string): { providerId: string; targetModel: string } {
    // 1. 查询别名表
    const stmt = db.query("SELECT target_model, provider_id FROM model_aliases WHERE alias = ?");
    const alias = stmt.get(modelName) as { target_model: string; provider_id: string } | undefined;
    
    if (alias && alias.provider_id) {
      return { 
        providerId: alias.provider_id, 
        targetModel: alias.target_model 
      };
    }

    // 2. 根据前缀猜测 Provider
    let providerId = "openai"; // 默认 fallback
    if (modelName.startsWith("claude-")) providerId = "anthropic";
    else if (modelName.startsWith("gemini-")) providerId = "gemini";
    else if (modelName.startsWith("gpt-") || modelName.startsWith("o1-") || modelName.startsWith("o3-")) providerId = "openai";
    
    return { providerId, targetModel: modelName };
  }

  /**
   * 获取某 Provider 下的所有健康可用账户，并解密 Key
   */
  getAccounts(providerId: string): Account[] {
    const stmt = db.query("SELECT * FROM accounts WHERE provider_id = ? AND is_active = 1 ORDER BY weight DESC, id ASC");
    const accounts = stmt.all(providerId) as Account[];
    
    return accounts.map(acc => {
      try {
        return {
          ...acc,
          api_key: decryptKey(acc.api_key)
        };
      } catch (e) {
        console.error(`[Dispatcher] Failed to decrypt API Key for account ${acc.alias} (ID: ${acc.id})`);
        return { ...acc, api_key: "" }; // 返回空 key
      }
    }).filter(acc => acc.api_key !== "");
  }

  /**
   * 调度聊天请求（带自动重试机制）
   */
  async dispatchChat(request: ChatRequest): Promise<Response> {
    const { providerId, targetModel } = this.resolveModel(request.model);
    const originalModel = request.model;
    
    // 覆写为真实模型名
    request.model = targetModel;

    const accounts = this.getAccounts(providerId);
    if (accounts.length === 0) {
      return Response.json({ error: `No active accounts available for provider: ${providerId}` }, { status: 503 });
    }

    // 获取当前轮询索引
    let idx = accountIndices.get(providerId) || 0;
    const maxAttempts = accounts.length; 
    let attempts = 0;
    let lastResponse: Response | null = null;

    while (attempts < maxAttempts) {
      const currentIdx = (idx + attempts) % accounts.length;
      const account = accounts[currentIdx];
      const startTime = Date.now();

      try {
        let response: Response;
        switch (providerId) {
          case "openai":
            response = await openaiAdapter.handleChat(request, account);
            break;
          case "anthropic":
            response = await anthropicAdapter.handleChat(request, account);
            break;
          case "gemini":
            response = await geminiAdapter.handleChat(request, account);
            break;
          default:
            return Response.json({ error: `Unsupported provider: ${providerId}` }, { status: 400 });
        }

        const latency = Date.now() - startTime;

        // 拦截 429 限速和鉴权错误，触发自动切换
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.warn(`[Dispatcher] Account ${account.alias} (ID: ${account.id}) failed with status ${response.status}. Trying next...`);
          
          usageService.logUsage({
            accountId: account.id,
            providerId,
            model: targetModel,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorMessage: errorMsg
          });

          lastResponse = response;
          attempts++;
          continue;
        }

        // 成功响应逻辑
        accountIndices.set(providerId, (currentIdx + 1) % accounts.length);

        // 如果是非流式响应，我们尝试解析 Token 数量（通过克隆响应体避免干扰后续流程）
        if (!request.stream) {
          this.logNonStreamUsage(response.clone(), account.id, providerId, targetModel, latency);
        } else {
          // 流式响应目前简单记录
          usageService.logUsage({
            accountId: account.id,
            providerId,
            model: targetModel,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: true
          });
        }

        return response;

      } catch (err: any) {
        const latency = Date.now() - startTime;
        console.error(`[Dispatcher] Account ${account.alias} failed:`, err.message);
        
        usageService.logUsage({
          accountId: account.id,
          providerId,
          model: targetModel,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: latency,
          success: false,
          errorMessage: err.message
        });

        attempts++;
      }
    }

    return lastResponse || Response.json({ error: "All accounts exhausted" }, { status: 503 });
  }

  /**
   * 异步解析并记录非流式响应的用量
   */
  private async logNonStreamUsage(response: Response, accountId: number, providerId: string, model: string, latency: number) {
    try {
      const data = await response.json() as any;
      usageService.logUsage({
        accountId,
        providerId,
        model,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        latencyMs: latency,
        success: true
      });
    } catch (e) {
      // 解析失败不影响主流程
    }
  }

  /**
   * 汇总所有活跃账户的模型列表（对所有账户取并集）
   */
  async listAllModels(): Promise<any[]> {
    const providers = ["openai", "anthropic", "gemini"];
    const allModels: any[] = [];
    const seenModels = new Set<string>();

    // 1. 收集所有活跃账户
    const activeAccounts: Account[] = [];
    for (const p of providers) {
      activeAccounts.push(...this.getAccounts(p));
    }

    // 2. 并发请求所有账户的模型列表
    const modelPromises = activeAccounts.map(async (acc) => {
      try {
        let models: any[] = [];
        if (acc.provider_id === "openai") models = await openaiAdapter.listModels(acc);
        else if (acc.provider_id === "anthropic") models = await anthropicAdapter.listModels(acc);
        else if (acc.provider_id === "gemini") models = await geminiAdapter.listModels(acc);
        return models;
      } catch (e) {
        console.error(`[Dispatcher] Failed to list models for account ${acc.alias}:`, e);
        return [];
      }
    });

    const results = await Promise.all(modelPromises);

    // 3. 取并集去重
    for (const models of results) {
      for (const m of models) {
        if (!seenModels.has(m.id)) {
          allModels.push(m);
          seenModels.add(m.id);
        }
      }
    }

    return allModels;
  }
}

export const dispatcher = new Dispatcher();
