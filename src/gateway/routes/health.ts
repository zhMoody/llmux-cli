import { db } from "../../db/index.js";
import { dispatcher } from "../../services/dispatcher.js";

/**
 * 获取服务商健康摘要 (按账户展开)
 */
export function getHealthStatus() {
  try {
    const accounts = dispatcher.getAccounts();
    const healthData = accounts.map(acc => {
      const p = acc.provider_id;
      
      // 获取厂商基础信息 (用于备选名称)
      const providerMeta = db.query("SELECT name FROM providers WHERE id = ?").get(p) as { name: string } | undefined;
      const providerName = providerMeta?.name || p;

      // 优先使用账户别名，没有则用厂商名
      const name = acc.alias || providerName;

      // 查询该账户最近 50 次请求的成功率
      const stats = db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success
        FROM usage_logs 
        WHERE account_id = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `).get(acc.id) as { total: number; success: number };

      let status = "unknown";
      if (stats && stats.total > 0) {
        const rate = stats.success / stats.total;
        if (rate > 0.9) status = "healthy";
        else if (rate > 0.5) status = "degraded";
        else status = "down";
      }

      return {
        id: `acc_${acc.id}`, // 使用唯一账户 ID 避免前端 Key 冲突
        name: name,
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
