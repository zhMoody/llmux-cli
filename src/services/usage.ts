import { db } from "../db/index.js";

export interface UsageLogParams {
  accountId: number;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
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
  private buildTimeQuery(baseQuery: string, startTime?: number, endTime?: number): { sql: string; params: any[] } {
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
          timestamp, account_id, provider_id, model, input_tokens, output_tokens,
          cache_read_input_tokens, cache_creation_input_tokens,
          latency_ms, success, error_message, is_test
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        Date.now(),
        params.accountId,
        params.providerId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.cacheReadInputTokens ?? 0,
        params.cacheCreationInputTokens ?? 0,
        params.latencyMs,
        params.success ? 1 : 0,
        params.errorMessage || null,
        params.isTest ? 1 : 0
      ]);

      if (params.limitCache) {
        db.run(`UPDATE accounts SET limits_cache = ?, limits_cache_updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
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
  getRecentLogs(limit: number = 20, startTime?: number, endTime?: number) {
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
  getSummary(startTime?: number, endTime?: number) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT
        IFNULL(SUM(input_tokens), 0) as totalInput,
        IFNULL(SUM(output_tokens), 0) as totalOutput,
        IFNULL(SUM(cache_read_input_tokens), 0) as totalCacheRead,
        IFNULL(SUM(cache_creation_input_tokens), 0) as totalCacheCreate,
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
   * 获取故障转移统计（自动切换账号的效果）
   */
  getFailoverStats(startTime?: number, endTime?: number) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT
        COUNT(*) as failedRequests,
        IFNULL(SUM(CASE WHEN error_message LIKE '%429%' OR error_message LIKE '%401%' OR error_message LIKE '%403%' THEN 1 ELSE 0 END), 0) as failoverTriggers
      FROM usage_logs
      WHERE is_test = 0 AND success = 0`,
      startTime,
      endTime
    );
    const failureStats = db.query(sql).get(...params) as any;

    // 计算救回的请求数：总成功数 - (总请求数 - 失败数)
    // 即：如果没有故障转移，成功数应该是 (总请求数 - 失败数)，实际成功数超出的部分就是救回的
    const { sql: summarySQL, params: summaryParams } = this.buildTimeQuery(
      `SELECT
        COUNT(*) as totalRequests,
        IFNULL(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as successRequests
      FROM usage_logs
      WHERE is_test = 0`,
      startTime,
      endTime
    );
    const summary = db.query(summarySQL).get(...summaryParams) as any;

    const expectedSuccess = summary.totalRequests - failureStats.failedRequests;
    const recoveredRequests = Math.max(0, summary.successRequests - expectedSuccess);
    const failoverSuccessRate = failureStats.failoverTriggers > 0
      ? (recoveredRequests / failureStats.failoverTriggers) * 100
      : 0;

    return {
      failoverTriggers: failureStats.failoverTriggers || 0,
      recoveredRequests: recoveredRequests || 0,
      failoverSuccessRate: Math.min(100, failoverSuccessRate)
    };
  }

  /**
   * 按服务商获取用量分布
   */
  getBreakdownByProvider(startTime?: number, endTime?: number) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        provider_id as id,
        SUM(input_tokens) as input,
        SUM(output_tokens) as output,
        SUM(input_tokens + output_tokens) as totalTokens,
        COUNT(*) as requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        AVG(latency_ms) as avgLatency
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
  getBreakdownByModel(startTime?: number, endTime?: number) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        model,
        SUM(input_tokens) as input,
        SUM(output_tokens) as output,
        COUNT(*) as requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        AVG(latency_ms) as avgLatency
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
  getBreakdownByAccount(startTime?: number, endTime?: number) {
    const { sql, params } = this.buildTimeQuery(
      `SELECT 
        a.id as id,
        a.alias as name,
        a.provider_id as provider,
        SUM(l.input_tokens) as input,
        SUM(l.output_tokens) as output,
        SUM(l.input_tokens + l.output_tokens) as totalTokens,
        COUNT(*) as requests,
        SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END) as successCount,
        AVG(l.latency_ms) as avgLatency
      FROM usage_logs l
      JOIN accounts a ON l.account_id = a.id
      WHERE l.is_test = 0`,
      startTime,
      endTime
    );
    return db.query(`${sql} GROUP BY a.id, a.alias`).all(...params);
  }

  /**
   * 获取详细审计日志（分页与过滤）
   */
  getDetailedLogs(options: {
    startTime?: number,
    endTime?: number,
    model?: string,
    provider?: string,
    success?: number,
    limit?: number,
    offset?: number
  }) {
    let baseSql = `
      SELECT 
        l.*, 
        a.alias as account_name
      FROM usage_logs l
      LEFT JOIN accounts a ON l.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.startTime) {
      baseSql += ` AND l.timestamp >= ?`;
      params.push(options.startTime);
    }
    if (options.endTime) {
      baseSql += ` AND l.timestamp <= ?`;
      params.push(options.endTime);
    }
    if (options.model) {
      baseSql += ` AND l.model LIKE ?`;
      params.push(`%${options.model}%`);
    }
    if (options.provider) {
      baseSql += ` AND l.provider_id = ?`;
      params.push(options.provider);
    }
    if (options.success !== undefined) {
      baseSql += ` AND l.success = ?`;
      params.push(options.success);
    }

    baseSql += ` ORDER BY l.timestamp DESC`;

    if (options.limit) {
      baseSql += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options.offset) {
      baseSql += ` OFFSET ?`;
      params.push(options.offset);
    }

    return db.query(baseSql).all(...params);
  }
}

export const usageService = new UsageService();
