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
  limitCache?: any;
  isTest?: boolean;
}

export class UsageService {
  /**
   * 记录单次调用的用量和耗时
   */
  logUsage(params: UsageLogParams) {
    try {
      db.run(`
        INSERT INTO usage_logs (
          account_id, provider_id, model, input_tokens, output_tokens, latency_ms, success, error_message, is_test
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.accountId,
        params.providerId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.latencyMs,
        params.success ? 1 : 0,
        params.errorMessage || null,
        params.isTest ? 1 : 0
      ]);

      if (params.limitCache) {
        db.run(`UPDATE accounts SET limits_cache = ? WHERE id = ?`, [
          JSON.stringify(params.limitCache),
          params.accountId
        ]);
      }
    } catch (err) {
      console.error("[UsageService] Failed to insert usage log:", err);
    }
  }

  /**
   * 获取最近的用量记录 (排除纯后台测试记录，除非用于 Dashboard 纯趋势展示也可能不需要)
   */
  getRecentLogs(limit: number = 20) {
    const stmt = db.query("SELECT * FROM usage_logs WHERE is_test = 0 ORDER BY timestamp DESC LIMIT ?");
    return stmt.all(limit);
  }

  /**
   * 获取用量总览（总 Token，请求数等）
   */
  getSummary() {
    const stmt = db.query(`
      SELECT 
        IFNULL(SUM(input_tokens), 0) as totalInput,
        IFNULL(SUM(output_tokens), 0) as totalOutput,
        IFNULL(AVG(latency_ms), 0) as avgLatency,
        COUNT(*) as totalRequests,
        IFNULL(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successRequests
      FROM usage_logs
      WHERE is_test = 0
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
      WHERE is_test = 0
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
      WHERE is_test = 0
      GROUP BY model
      ORDER BY (input + output) DESC
    `);
    return stmt.all();
  }
  /**
   * 按账户获取用量分布
   */
  getBreakdownByAccount() {
    const stmt = db.query(`
      SELECT 
        a.alias as name,
        a.provider_id as provider,
        SUM(l.input_tokens + l.output_tokens) as totalTokens,
        COUNT(*) as requests
      FROM usage_logs l
      JOIN accounts a ON l.account_id = a.id
      WHERE l.is_test = 0
      GROUP BY a.id, a.alias
    `);
    return stmt.all();
  }
}

export const usageService = new UsageService();
