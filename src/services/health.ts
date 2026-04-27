import { db } from "../db/index.js";
import { decryptKey } from "./crypto.js";
import { openaiAdapter } from "../gateway/adapters/openai.js";
import { anthropicAdapter } from "../gateway/adapters/anthropic.js";
import { geminiAdapter } from "../gateway/adapters/gemini.js";

export interface HealthCheckResult {
  accountId: number;
  alias: string;
  providerId: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export class HealthService {
  /**
   * 检查所有活跃账户的健康状态
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    const stmt = db.query("SELECT * FROM accounts WHERE is_active = 1");
    const accounts = stmt.all() as any[];
    const results: HealthCheckResult[] = [];

    console.log(`[Health] Starting health check for ${accounts.length} accounts...`);

    for (const acc of accounts) {
      const startTime = Date.now();
      let success = false;
      let errorMsg = "";

      try {
        const decryptedKey = decryptKey(acc.api_key);
        const accountWithKey = { ...acc, api_key: decryptedKey };
        
        // 使用 listModels 作为轻量级的探活手段
        let models: any[] = [];
        if (acc.provider_id === "openai") {
          models = await openaiAdapter.listModels(accountWithKey);
        } else if (acc.provider_id === "anthropic") {
          models = await anthropicAdapter.listModels(accountWithKey);
        } else if (acc.provider_id === "gemini") {
          models = await geminiAdapter.listModels(accountWithKey);
        }

        success = models.length > 0;
        if (!success) errorMsg = "No models returned";
      } catch (err: any) {
        success = false;
        errorMsg = err.message;
      }

      const latency = Date.now() - startTime;
      results.push({
        accountId: acc.id,
        alias: acc.alias,
        providerId: acc.provider_id,
        success,
        error: errorMsg || undefined,
        latencyMs: latency
      });

      console.log(`[Health] Account ${acc.alias} (${acc.provider_id}): ${success ? "OK" : "FAILED (" + errorMsg + ")"}`);
    }

    return results;
  }
}

export const healthService = new HealthService();
