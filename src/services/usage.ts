import { db } from "../db/index.js";

export interface UsageLogParams {
  accountId: number;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

export class UsageService {
  /**
   * 记录单次调用的用量和耗时
   */
  logUsage(params: UsageLogParams) {
    try {
      db.run(`
        INSERT INTO usage_logs (
          account_id, provider_id, model, input_tokens, output_tokens, latency_ms, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.accountId,
        params.providerId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.latencyMs,
        params.success ? 1 : 0,
        params.errorMessage || null
      ]);
    } catch (err) {
      console.error("[UsageService] Failed to insert usage log:", err);
    }
  }

  /**
   * 获取最近的用量记录
   */
  getRecentLogs(limit: number = 20) {
    const stmt = db.query("SELECT * FROM usage_logs ORDER BY timestamp DESC LIMIT ?");
    return stmt.all(limit);
  }

  /**
   * 获取用量总览（总 Token，请求数等）
   */
  getSummary() {
    const stmt = db.query(`
      SELECT 
        SUM(input_tokens) as totalInput,
        SUM(output_tokens) as totalOutput,
        AVG(latency_ms) as avgLatency,
        COUNT(*) as totalRequests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successRequests
      FROM usage_logs
    `);
    return stmt.get();
  }

  /**
   * 按服务商获取用量分布
   */
  getBreakdownByProvider() {
    const stmt = db.query(`
      SELECT 
        provider_id as id,
        SUM(input_tokens + output_tokens) as totalTokens,
        COUNT(*) as requests
      FROM usage_logs 
      GROUP BY provider_id
    `);
    return stmt.all();
  }

  /**
   * 按模型获取用量分布
   */
  getBreakdownByModel() {
    const stmt = db.query(`
      SELECT 
        model,
        SUM(input_tokens) as input,
        SUM(output_tokens) as output,
        COUNT(*) as requests
      FROM usage_logs
      GROUP BY model
      ORDER BY (input + output) DESC
    `);
    return stmt.all();
  }
}

export const usageService = new UsageService();
