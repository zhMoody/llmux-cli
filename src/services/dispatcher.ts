import { db } from "../db/index.js";
import { decryptKey } from "./crypto.js";
import { openaiAdapter } from "../gateway/adapters/openai.js";
import { anthropicAdapter } from "../gateway/adapters/anthropic.js";
import { geminiAdapter } from "../gateway/adapters/gemini.js";
import { customAdapter } from "../gateway/adapters/custom.js";
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
   * 获取某 Provider 下的所有健康可用账户 (如果 providerId 为空则获取所有)，并解密 Key
   * 支持通过 provider_id 或 account alias 进行匹配
   */
  getAccounts(providerId?: string): Account[] {
    let query = "SELECT * FROM accounts WHERE is_active = 1";
    let params: any[] = [];

    if (providerId) {
      // 智能匹配：优先匹配 provider_id，如果没有则匹配 alias (别名回退)
      const hasProviderId = db.query("SELECT 1 FROM accounts WHERE provider_id = ? AND is_active = 1").get(providerId);
      if (hasProviderId) {
        query += " AND provider_id = ?";
      } else {
        query += " AND alias = ?";
      }
      params.push(providerId);
    }

    query += " ORDER BY weight DESC, id ASC";

    const stmt = db.query(query);
    const accounts = stmt.all(...params) as Account[];

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
  async dispatchChat(request: ChatRequest, forcedProviderId?: string): Promise<Response> {
    const { providerId: resolvedProviderId, targetModel } = this.resolveModel(request.model);
    const providerId = forcedProviderId || resolvedProviderId;
    const originalModel = request.model;

    // 覆写为真实模型名
    request.model = targetModel;

    const accounts = this.getAccounts(providerId);
    if (accounts.length === 0) {
      return Response.json({ error: `No active accounts available for: ${providerId}` }, { status: 503 });
    }

    // 获取当前轮询索引，立即推进避免并发请求撞同一账号
    let idx = accountIndices.get(providerId) || 0;
    accountIndices.set(providerId, (idx + 1) % accounts.length);
    const maxAttempts = accounts.length;
    let attempts = 0;
    let lastResponse: Response | null = null;

    while (attempts < maxAttempts) {
      const currentIdx = (idx + attempts) % accounts.length;
      const account = accounts[currentIdx];
      const startTime = Date.now();

      // 根据该账户真实的 provider_id 确定 Provider 类型
      const realProviderId = account.provider_id;
      const providerMeta = db.query("SELECT type FROM providers WHERE id = ?").get(realProviderId) as { type: string } | undefined;
      const providerType = providerMeta?.type || realProviderId;

      try {
        let response: Response;
        switch (providerType) {
          case "openai":
            response = await openaiAdapter.handleChat(request, account);
            break;
          case "anthropic":
            response = await anthropicAdapter.handleChat(request, account);
            break;
          case "gemini":
            response = await geminiAdapter.handleChat(request, account);
            break;
          case "custom":
          case "poe":
          case "claude":
          case "qwen":
            response = await customAdapter.handleChat(request, account);
            break;
          default:
            // 如果 ID 匹配常见前缀也尝试使用 Custom
            if (["deepseek", "kimi", "moonshot", "step"].includes(realProviderId)) {
              response = await customAdapter.handleChat(request, account);
              break;
            }
            return Response.json({ error: `Unsupported provider type: ${providerType} (ID: ${realProviderId})` }, { status: 400 });
        }
        const latency = Date.now() - startTime;

        // 拦截 429 限速和鉴权错误，触发自动切换
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.warn(`[Dispatcher] Account ${account.alias} (ID: ${account.id}) failed with status ${response.status}. Trying next...`);
          
          usageService.logUsage({
            accountId: account.id,
            providerId: account.provider_id,
            model: targetModel,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorMessage: errorMsg,
            isTest: request.is_test
          });

          lastResponse = response;
          attempts++;
          continue;
        }

        // 非流式响应，解析 Token 数量（克隆响应体避免干扰后续流程）
        if (!request.stream) {
          this.logNonStreamUsage(response.clone(), account.id, account.provider_id, targetModel, latency, request.is_test);
        } else {
          // 流式响应异步追踪并在结束时尝试解析最终的 usage 块
          this.logStreamUsage(response.clone(), account.id, account.provider_id, targetModel, latency, request);
        }

        return response;

      } catch (err: any) {
        const latency = Date.now() - startTime;
        console.error(`[Dispatcher] Account ${account.alias} failed:`, err.message);
        
        usageService.logUsage({
          accountId: account.id,
          providerId: account.provider_id,
          model: targetModel,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: latency,
          success: false,
          errorMessage: err.message,
          isTest: request.is_test
        });

        attempts++;
      }
    }

    return lastResponse || Response.json({ error: "All accounts exhausted" }, { status: 503 });
  }

  private getLimitCacheFromHeaders(headers: Headers) {
    const limits: any = {};
    const extract = (key: string) => {
      const val = headers.get(key);
      if (val) limits[key] = val;
    };
    extract('x-ratelimit-limit-requests');
    extract('x-ratelimit-remaining-requests');
    extract('x-ratelimit-limit-tokens');
    extract('x-ratelimit-remaining-tokens');
    extract('x-quota-total');
    extract('x-quota-remaining');
    return Object.keys(limits).length > 0 ? limits : undefined;
  }

  /**
   * 异步解析并记录非流式响应的用量
   */
  private async logNonStreamUsage(response: Response, accountId: number, providerId: string, model: string, latency: number, isTest?: boolean) {
    try {
      const data = await response.json() as any;
      usageService.logUsage({
        accountId,
        providerId,
        model,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        latencyMs: latency,
        success: true,
        limitCache: this.getLimitCacheFromHeaders(response.headers),
        isTest
      });
    } catch (e) {
      // 解析失败不影响主流程
    }
  }

  /**
   * 异步解析并记录流式响应的用量（拦截 usage 分块或使用估算值）
   */
  private async logStreamUsage(response: Response, accountId: number, providerId: string, model: string, latency: number, request: any) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    
    // 初始估算值
    const inputChars = JSON.stringify(request.messages || []).length;
    let promptTokens = Math.ceil(inputChars / 4);
    let completionTokens = 0;
    let chunkCount = 0;
    let hasUsage = false;

    try {
      if (!response.body) return;
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunkCount++;
        const chunkText = decoder.decode(value, { stream: true });
        
        if (chunkText.includes('"usage"')) {
          const lines = chunkText.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.usage) {
                  promptTokens = data.usage.prompt_tokens || promptTokens;
                  completionTokens = data.usage.completion_tokens || completionTokens;
                  hasUsage = true;
                }
              } catch(e) {}
            }
          }
        }
      }
    } catch (e) {
      // 流读取可能因客户端中断而报错
      console.warn(`[Dispatcher] Stream log interrupted for ${model}:`, e instanceof Error ? e.message : String(e));
    } finally {
      if (reader) {
        try { reader.releaseLock(); } catch(e) {}
      }

      // 无论是否异常中断，都尝试记录已知的用量
      if (!hasUsage && chunkCount > 0) {
        completionTokens = Math.floor(chunkCount * 1.2) || 1;
      }

      // 如果有产生内容或已经有 promptTokens，则记录
      if (promptTokens > 0 || completionTokens > 0) {
        usageService.logUsage({
          accountId,
          providerId,
          model,
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          latencyMs: latency,
          success: true, // 只要有响应流产生，通常视为部分成功
          limitCache: this.getLimitCacheFromHeaders(response.headers),
          isTest: request.is_test
        });
      }
    }
  }

  /**
   * 汇总所有活跃账户的模型列表（对所有账户取并集）
   */
  async listAllModels(): Promise<any[]> {
    const allModels: any[] = [];
    const seenModelKeys = new Set<string>();

    // 1. 获取所有活跃账户
    const activeAccounts = this.getAccounts();

    // 2. 并发请求所有账户的模型列表
    const modelPromises = activeAccounts.map(async (acc) => {
      try {
        let models: any[] = [];
        const providerType = (db.query("SELECT type FROM providers WHERE id = ?").get(acc.provider_id) as any)?.type || acc.provider_id;

        if (providerType === "openai") models = await openaiAdapter.listModels(acc);
        else if (providerType === "anthropic") models = await anthropicAdapter.listModels(acc);
        else if (providerType === "gemini") models = await geminiAdapter.listModels(acc);
        else if (["custom", "poe", "claude", "qwen"].includes(providerType)) models = await customAdapter.listModels(acc);
        
        // 将模型打上账户别名的标签，方便前端显示和后续路由
        return models.map(m => ({
          ...m,
          owned_by: acc.alias // 使用账户别名作为显示厂商
        }));
      } catch (e) {
        console.error(`[Dispatcher] Failed to list models for account ${acc.alias}:`, e);
        return [];
      }
    });

    const results = await Promise.all(modelPromises);

    // 3. 汇总并去重 (相同账号下的相同模型去重，不同账号的同名模型保留)
    for (const models of results) {
      for (const m of models) {
        const key = `${m.owned_by}:${m.id}`;
        if (!seenModelKeys.has(key)) {
          allModels.push(m);
          seenModelKeys.add(key);
        }
      }
    }

    return allModels;
  }

  /**
   * 仅列出用户定义的模型别名（用于精简 v1/models 输出）
   */
  listModelAliases(): any[] {
    const aliases = db.query("SELECT alias FROM model_aliases").all() as { alias: string }[];
    return aliases.map(a => ({
      id: a.alias,
      object: "model",
      created: Date.now(),
      owned_by: "llmux-alias"
    }));
  }
}

export const dispatcher = new Dispatcher();
