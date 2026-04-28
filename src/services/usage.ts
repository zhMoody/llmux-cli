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
   * 辅助方法：构建时间范围 SQL 片段
   */
  private buildTimeQuery(baseQuery: string, startTime?: string, endTime?: string): { sql: string; params: any[] } {
    let sql = baseQuery;
    const params: any[] = [];
    const hasWhere = baseQuery.toUpperCase().includes("WHERE");
    
    if (startTime || endTime) {
      sql += hasWhere ? " AND " : " WHERE ";
      if (startTime && endTime) {
        sql += "timestamp BETWEEN ? AND ?";
        params.push(startTime, endTime);
      } else if (startTime) {
        sql += "timestamp >= ?";
        params.push(startTime);
      } else if (endTime) {
        sql += "timestamp <= ?";
        params.push(endTime);
      }
    }
    
    return { sql, params };
  }

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
   * 获取最近的用量记录
   */
  getRecentLogs(limit: number = 20, startTime?: string, endTime?: string) {
    const { sql, params } = this.buildTimeQuery(
      "SELECT * FROM usage_logs WHERE is_test = 0", 
      startTime, 
      endTime
    );
    const stmt = db.query(`${sql} ORDER BY timestamp DESC LIMIT ?`);
    return stmt.all(...params, limit);
  }

  /**
   * 获取用量总览（总 Token，请求数等）
   */
  getSummary(startTime?: string, endTime?: string) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        IFNULL(SUM(input_tokens), 0) as totalInput,
        IFNULL(SUM(output_tokens), 0) as totalOutput,
        IFNULL(AVG(latency_ms), 0) as avgLatency,
        COUNT(*) as totalRequests,
        IFNULL(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successRequests
      FROM usage_logs
      WHERE is_test = 0`,
      startTime,
      endTime
    );
    return db.query(sql).get(...params);
  }

  /**
   * 按服务商获取用量分布
   */
  getBreakdownByProvider(startTime?: string, endTime?: string) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        provider_id as id,
        SUM(input_tokens + output_tokens) as totalTokens,
        COUNT(*) as requests
      FROM usage_logs 
      WHERE is_test = 0`,
      startTime,
      endTime
    );
    return db.query(`${sql} GROUP BY provider_id`).all(...params);
  }

  /**
   * 按模型获取用量分布
   */
  getBreakdownByModel(startTime?: string, endTime?: string) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        model,
        SUM(input_tokens) as input,
        SUM(output_tokens) as output,
        COUNT(*) as requests
      FROM usage_logs
      WHERE is_test = 0`,
      startTime,
      endTime
    );
    return db.query(`${sql} GROUP BY model ORDER BY (input + output) DESC`).all(...params);
  }
  /**
   * 按账户获取用量分布
   */
  getBreakdownByAccount(startTime?: string, endTime?: string) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        a.alias as name,
        a.provider_id as provider,
        SUM(l.input_tokens + l.output_tokens) as totalTokens,
        COUNT(*) as requests
      FROM usage_logs l
      JOIN accounts a ON l.account_id = a.id
      WHERE l.is_test = 0`,
      startTime,
      endTime
    );
    return db.query(`${sql} GROUP BY a.id, a.alias`).all(...params);
  }
}

export const usageService = new UsageService();
