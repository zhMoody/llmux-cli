import { usageService } from "../../services/usage.js";

/**
 * 获取用量汇总统计 (供 Dashboard 头部卡片使用)
 */
export function getUsageSummary() {
  try {
    const summary = usageService.getSummary();
    const recent = usageService.getRecentLogs(100); // 增加采样点到 100 条，确保趋势图充实
    return Response.json({
      summary: summary || { totalInput: 0, totalOutput: 0, avgLatency: 0, totalRequests: 0, successRequests: 0 },
      recent
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 获取详细的分组用量 (供 Usage 页面使用)
 */
export function getUsageDetails() {
  try {
    const byModel = usageService.getBreakdownByModel();
    const byProvider = usageService.getBreakdownByProvider();
    const byAccount = usageService.getBreakdownByAccount();
    return Response.json({
      byModel,
      byProvider,
      byAccount
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
