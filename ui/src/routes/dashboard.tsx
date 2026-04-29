import React, { useEffect, useState, useMemo } from 'react';
import { useUsageStore } from '../stores/usage';
import { useModelsStore } from '../stores/models';
import { useAccountsStore } from '../stores/accounts';
import { 
  RefreshCw, 
  Plus,
  Calendar
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// 导入提取的模块化组件
import { StatGrid } from '../components/Dashboard/StatGrid';
import { HealthStatusList } from '../components/Dashboard/HealthStatusList';
import { UsageDistribution } from '../components/Dashboard/UsageDistribution';
import { UsageTrendChart } from '../components/Dashboard/UsageTrendChart';
import { RecentActivityList } from '../components/Dashboard/RecentActivityList';
import { parseServerDate } from '../utils/date';

const CHART_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fetchModels } = useModelsStore();
  const { fetchAccounts } = useAccountsStore();
  const { summary, recentLogs, breakdown, isLoading, fetchSummary, fetchDetails } = useUsageStore();
  const [healthStatus, setHealthStatus] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  // 计算时间范围
  const getTimeParams = (range: TimeRange) => {
    const now = new Date();
    let start: Date | null = null;
    
    switch (range) {
      case '1h': start = new Date(now.getTime() - 3600000); break;
      case '24h': start = new Date(now.getTime() - 86400000); break;
      case '7d': start = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': start = new Date(now.getTime() - 30 * 86400000); break;
      case 'all': start = null; break;
    }
    
    return {
      start: start ? start.toISOString().replace('T', ' ').split('.')[0] : undefined,
      end: undefined
    };
  };

  const loadAll = async () => {
    try {
      const { start, end } = getTimeParams(timeRange);
      await Promise.all([
        fetchSummary(start, end),
        fetchAccounts(),
        fetchModels(),
        checkProvidersHealth(),
        fetchDetails(start, end)
      ]);
    } catch (err) {
      console.error('Load dashboard failed:', err);
    }
  };

  const checkProvidersHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, [timeRange]);

  // 数据聚合逻辑 (保留在主页面，作为数据源)
  const providerData = useMemo(() => {
    return (breakdown?.byAccount || []).map((p: any) => ({
      name: p.name || p.id,
      requests: p.requests
    }));
  }, [breakdown]);

  const top5ModelNames = useMemo(() => {
    const modelTotals = recentLogs.reduce((acc: any, log) => {
      const tokens = (log.input_tokens || 0) + (log.output_tokens || 0);
      acc[log.model] = (acc[log.model] || 0) + tokens;
      return acc;
    }, {});
    
    return Object.entries(modelTotals)
      .filter(([, total]: any) => total > 0)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(x => x[0]);
  }, [recentLogs]);

  // 2. 前 5 模型 Token 使用趋势 (按时间段聚合的真实趋势)
  const modelChartData = useMemo(() => {
    if (!recentLogs.length || !top5ModelNames.length) return [];
    
    const parseSqliteTime = (ts: string) => parseServerDate(ts).getTime();

    const sortedLogs = [...recentLogs].sort((a, b) => parseSqliteTime(a.timestamp) - parseSqliteTime(b.timestamp));
    const minLogTime = parseSqliteTime(sortedLogs[0].timestamp);
    const lastLogTime = parseSqliteTime(sortedLogs[sortedLogs.length - 1].timestamp);
    
    // 强制将图表终点延伸到当前时间，增加“实时感”
    const now = Date.now();
    const maxTime = Math.max(lastLogTime, now);
    
    // 如果数据极少或跨度极小，默认显示最近 10 分钟
    const minTime = (maxTime - minLogTime) < 60000 ? maxTime - 600000 : minLogTime;
    const timeSpan = maxTime - minTime;
    
    // 动态增加采样率：如果是短时间监控，提高密度以减少插值的虚假性 (最多 60 个桶)
    const bucketCount = timeSpan < 600000 ? 40 : 25; 
    const bucketDuration = Math.max(timeSpan / bucketCount, 1000); 
    
    // 智能选择时间格式：如果整个跨度小于 20 分钟，则显示到秒
    const useSeconds = timeSpan < 1200000;
    const timeOptions: Intl.DateTimeFormatOptions = useSeconds 
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      : { hour: '2-digit', minute: '2-digit', hour12: false };

    const buckets: any[] = [];
    // 预留边缘空点，防止波形突然垂直切断
    for (let i = 0; i <= bucketCount; i++) {
        const bucketTime = minTime + i * bucketDuration;
        const bucketData: any = {
            timestamp: bucketTime,
            name: new Date(bucketTime).toLocaleTimeString([], timeOptions),
            displayTime: new Date(bucketTime).toLocaleString(),
        };
        top5ModelNames.forEach(m => bucketData[m] = 0);
        buckets.push(bucketData);
    }

    sortedLogs.forEach(log => {
      const modelName = log.model;
      if (!top5ModelNames.includes(modelName)) return;
      
      const logTime = parseSqliteTime(log.timestamp);
      if (logTime < minTime) return; // 忽略超出范围的旧数据
      
      const bucketIndex = Math.min(Math.floor((logTime - minTime) / bucketDuration), bucketCount);
      
      if (buckets[bucketIndex]) {
         const tokens = (log.input_tokens || 0) + (log.output_tokens || 0);
         buckets[bucketIndex][modelName] += tokens;
      }
    });

    return buckets;
  }, [recentLogs, top5ModelNames]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">{t('common.dashboard')}</h1>
           <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
           {/* 时间范围选择 */}
           <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 items-center">
              {[
                { id: '1h', label: '1H' },
                { id: '24h', label: '24H' },
                { id: '7d', label: '7D' },
                { id: 'all', label: 'ALL' }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTimeRange(r.id as TimeRange)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                    timeRange === r.id 
                      ? "bg-background text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
           </div>

           <button 
             onClick={loadAll}
             className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted transition-all flex items-center gap-2 group"
           >
             <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
             {t('models.actions.refresh')}
           </button>
           <button 
             onClick={() => navigate('/accounts')}
             className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
           >
             <Plus size={14} />
             {t('dashboard.connectNew')}
           </button>
        </div>
      </div>

      {/* 1. 核心指标卡片组 */}
      <StatGrid summary={summary} t={t} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* 左侧主要图表区域 */}
        <div className="xl:col-span-8 space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 2. 服务商健康状态列表 */}
              <HealthStatusList healthStatus={healthStatus} t={t} />

              {/* 3. 账户请求分布 (柱状图) */}
              <UsageDistribution 
                data={providerData} 
                colors={CHART_COLORS} 
                t={t} 
              />
           </div>

           {/* 4. 模型 Token 使用趋势 (面积图) */}
           <UsageTrendChart 
             data={modelChartData} 
             modelNames={top5ModelNames} 
             colors={CHART_COLORS} 
             t={t} 
           />
        </div>

        {/* 右侧实时活动侧边栏 */}
        <div className="xl:col-span-4 h-full">
           <RecentActivityList 
             recentLogs={recentLogs} 
             t={t} 
             onViewReports={() => navigate('/usage')} 
           />
        </div>
      </div>
    </div>
  );
}
