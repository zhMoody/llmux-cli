import React, { useMemo } from 'react';
import { History, Zap, Activity, Clock } from 'lucide-react';
import { parseServerDate } from '../../utils/date';
import { useUsageStore, UsageLog } from '../../stores/usage';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TFunction } from 'i18next';

// 注册子组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
);

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

interface ActivityItemProps {
  model: string;
  time: string;
  status: 'success' | 'error';
  latency: string;
  provider?: string;
}

const ActivityItem = ({ model, time, status, latency, provider }: ActivityItemProps) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/50 px-2 rounded-lg transition-colors group">
    <div className="flex items-center gap-3 min-w-0">
      <div className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        status === 'success' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
      )} />
      <div className="min-w-0">
        <div className="text-[11px] font-bold truncate leading-tight">{model}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground/60 font-medium">{time}</span>
          {provider && (
            <>
              <span className="text-[8px] opacity-20">|</span>
              <span className="text-[9px] text-primary/50 font-bold uppercase tracking-tighter">{provider}</span>
            </>
          )}
        </div>
      </div>
    </div>
    <div className="text-[10px] font-mono font-bold text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0">{latency}</div>
  </div>
);

interface RecentActivityListProps {
  recentLogs: UsageLog[];
  t: TFunction;
  onViewReports: () => void;
}

export const RecentActivityList = ({ recentLogs, t, onViewReports }: RecentActivityListProps) => {
  // 计算过去 30 次请求的成功率和平均延迟
  const stats = useMemo(() => {
    if (!recentLogs.length) return { successRate: 0, avgLatency: 0 };
    const last30 = recentLogs.slice(0, 30);
    const successCount = last30.filter(l => l.success === 1).length;
    const totalLatency = last30.reduce((acc, l) => acc + (l.latency_ms || 0), 0);
    
    return {
      successRate: Math.round((successCount / last30.length) * 100),
      avgLatency: Math.round(totalLatency / last30.length)
    };
  }, [recentLogs]);

  // 构造脉冲图数据 - 使用实色对齐画风
  const chartData: ChartData<'bar'> = useMemo(() => {
    const displayLogs = [...recentLogs.slice(0, 50)].reverse();
    return {
      labels: displayLogs.map(() => ''),
      datasets: [{
        data: displayLogs.map(l => l.latency_ms || 0),
        // 成功用实色蓝 (#3b82f6)，失败用实色红 (#ef4444)
        // 高延迟 (> 2000ms) 给予透明度处理
        backgroundColor: displayLogs.map(l => {
            if (l.success !== 1) return '#ef4444';
            return (l.latency_ms || 0) > 2000 ? 'rgba(59, 130, 246, 0.4)' : '#3b82f6';
        }),
        borderRadius: 0, // 像左边柱状图一样方正
        barThickness: 3,
      }]
    };
  }, [recentLogs]);

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // 去掉动画，保持干脆利落
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: '#09090b',
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
        displayColors: false,
        callbacks: {
          label: (context) => ` ${context.parsed.y}ms`
        }
      }
    },
    scales: {
      x: { display: false },
      y: { 
        display: false, 
        beginAtZero: true,
        max: recentLogs.length > 0 ? Math.max(...recentLogs.slice(0, 50).map(l => l.latency_ms || 0)) * 1.1 : 1000
      }
    }
  };

  return (
    <div className="premium-card flex flex-col h-full bg-card border-border/60 sticky top-24">
      {/* 头部 - 模仿左侧卡片标题风格 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <History size={16} className="text-[#3b82f6]" />
          <span className="text-sm font-bold text-foreground/80">{t('dashboard.recentLogs')}</span>
        </div>
        <button 
          onClick={onViewReports}
          className="text-[10px] font-bold text-[#3b82f6] hover:underline transition-all"
        >
          {t('dashboard.viewReports')}
        </button>
      </div>
      
      {/* 脉冲图 */}
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('dashboard.monitor.latencyPulse')}</span>
          <span className="text-[10px] font-mono text-muted-foreground/60">{recentLogs.length} {t('dashboard.monitor.reqs')}</span>
        </div>
        <div className="h-16 w-full bg-muted/20 rounded-lg p-2 border border-border/40">
           {recentLogs.length > 0 ? (
             <Bar data={chartData} options={chartOptions} />
           ) : (
             <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground/30 italic">{t('dashboard.noActivity')}</div>
           )}
        </div>
      </div>

      {/* 核心指标 - 完美复制顶部 StatCard 风格 */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <div className="flex items-center gap-4 bg-background border border-border/60 p-4 rounded-2xl shadow-sm">
           <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#3b82f6]">
              <Zap size={20} />
           </div>
           <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{t('dashboard.monitor.successRate')}</div>
              <div className="text-xl font-bold text-foreground">{stats.successRate}%</div>
           </div>
        </div>
        <div className="flex items-center gap-4 bg-background border border-border/60 p-4 rounded-2xl shadow-sm">
           <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Clock size={20} />
           </div>
           <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{t('dashboard.monitor.avgLag')}</div>
              <div className="text-xl font-bold text-foreground">{stats.avgLatency}ms</div>
           </div>
        </div>
      </div>
      
      {/* 活动列表 */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{t('dashboard.monitor.liveFeed')}</div>
        <div className="space-y-1 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin">
          {recentLogs.length > 0 ? recentLogs.slice(0, 15).map((log) => (
            <ActivityItem 
              key={log.id}
              model={log.model}
              time={parseServerDate(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              status={log.success === 1 ? 'success' : 'error'}
              latency={`${log.latency_ms}ms`}
              provider={log.provider_id}
            />
          )) : (
            <div className="py-20 text-center text-muted-foreground/20 text-[10px] font-bold uppercase border border-dashed border-border/60 rounded-2xl">
              {t('dashboard.noActivity')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
