import { db } from "../../db/index.js";
import { dispatcher } from "../../services/dispatcher.js";

/**
 * 获取服务商健康摘要
 */
export function getHealthStatus() {
  try {
    const accounts = dispatcher.getAccounts();
    const providers = Array.from(new Set(accounts.map(a => a.provider_id)));
    const healthData = providers.map(p => {
      // 获取厂商显示名称
      const providerMeta = db.query("SELECT name FROM providers WHERE id = ?").get(p) as { name: string } | undefined;
      const name = providerMeta?.name || p;

      // 查询最近 50 次请求的成功率
      const stats = db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success
        FROM usage_logs 
        WHERE provider_id = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `).get(p) as { total: number; success: number };

      let status = "unknown";
      if (stats && stats.total > 0) {
        const rate = stats.success / stats.total;
        if (rate > 0.9) status = "healthy";
        else if (rate > 0.5) status = "degraded";
        else status = "down";
      }

      return {
        id: p,
        name,
        status,
        lastSuccess: stats?.success || 0,
        totalChecks: stats?.total || 0
      };
    });

    return Response.json(healthData);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
