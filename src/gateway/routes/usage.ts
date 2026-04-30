import { usageService } from "../../services/usage.js";

/**
 * 获取用量汇总统计 (供 Dashboard 头部卡片使用)
 */
export function getUsageSummary(req?: Request) {
  try {
    const url = req ? new URL(req.url) : null;
    const start = url?.searchParams.get("start") || undefined;
    const end = url?.searchParams.get("end") || undefined;

    const summary = usageService.getSummary(start, end);
    const failoverStats = usageService.getFailoverStats(start, end);
    const recent = usageService.getRecentLogs(1000, start, end);
    return Response.json({
      summary: summary || { totalInput: 0, totalOutput: 0, avgLatency: 0, totalRequests: 0, successRequests: 0 },
      failoverStats: failoverStats || { failoverTriggers: 0, recoveredRequests: 0, failoverSuccessRate: 0 },
      recent
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 获取详细的分组用量 (供 Usage 页面使用)
 */
export function getUsageDetails(req?: Request) {
  try {
    const url = req ? new URL(req.url) : null;
    const start = url?.searchParams.get("start") || undefined;
    const end = url?.searchParams.get("end") || undefined;

    const byModel = usageService.getBreakdownByModel(start, end);
    const byProvider = usageService.getBreakdownByProvider(start, end);
    const byAccount = usageService.getBreakdownByAccount(start, end);
    return Response.json({
      byModel,
      byProvider,
      byAccount
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 获取分页审计日志
 */
export function getUsageLogs(req: Request) {
  try {
    const url = new URL(req.url);
    const options = {
      startTime: url.searchParams.get("start") || undefined,
      endTime: url.searchParams.get("end") || undefined,
      model: url.searchParams.get("model") || undefined,
      provider: url.searchParams.get("provider") || undefined,
      success: url.searchParams.has("success") ? Number(url.searchParams.get("success")) : undefined,
      limit: Number(url.searchParams.get("limit")) || 50,
      offset: Number(url.searchParams.get("offset")) || 0
    };

    const logs = usageService.getDetailedLogs(options);
    return Response.json(logs);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
