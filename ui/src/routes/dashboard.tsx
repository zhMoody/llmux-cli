import React, { useEffect, useState, useMemo } from 'react';
import { useModelsStore } from '../stores/models';
import { useAccountsStore } from '../stores/accounts';
import { useUsageStore } from '../stores/usage';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  Activity, 
  Zap, 
  ShieldCheck, 
  Clock,
  LayoutGrid,
  History,
  RefreshCw,
  Plus,
  TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = ['#3b82f6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const fullTime = payload[0].payload.fullTime;
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 p-4 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
        <p className="text-[10px] font-black text-muted-foreground uppercase mb-3 tracking-[0.2em] border-b border-border/50 pb-2">
          {fullTime || label}
        </p>
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-4 justify-between min-w-[140px]">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px] font-bold text-foreground/90">{entry.name}</span>
              </div>
              <span className="text-xs font-black tabular-nums tracking-tight">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const StatCard = ({ icon: Icon, label, value, color }: { 
  icon: any, label: string, value: string, color: string 
}) => (
  <div className="premium-card space-y-3">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon size={16} className={color} />
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold tracking-tight">{value}</div>
  </div>
);

const ActivityItem = ({ model, time, status, latency }: { model: string, time: string, status: 'success' | 'error', latency: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/50 px-2 rounded-lg transition-colors group">
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-2 h-2 rounded-full",
        status === 'success' ? "bg-green-500" : "bg-red-500"
      )} />
      <div>
        <div className="text-sm font-medium">{model}</div>
        <div className="text-[10px] text-muted-foreground">{time}</div>
      </div>
    </div>
    <div className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{latency}</div>
  </div>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fetchModels } = useModelsStore();
  const { fetchAccounts } = useAccountsStore();
  const { summary, recentLogs, breakdown, isLoading, fetchSummary, fetchDetails } = useUsageStore();
  const [healthStatus, setHealthStatus] = useState<any[]>([]);

  const loadAll = async () => {
    await Promise.all([
      fetchModels(),
      fetchAccounts(),
      fetchSummary()
    ]);
    
    try {
      const r = await fetch('/api/health');
      const data = await r.json();
      setHealthStatus(data);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  useEffect(() => {
    loadAll();
    fetchDetails(); // 确保加载详细分组数据用于图表
  }, []);

  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0);

  // 1. 账户/别名调用量分布 (Bar Chart)
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
      .filter(([, total]: any) => total > 0) // 过滤掉无流量的模型
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(x => x[0]);
  }, [recentLogs]);

  // 2. 前 5 模型 Token 使用趋势 (累积增长趋势图)
  const modelChartData = useMemo(() => {
    if (!recentLogs.length || !top5ModelNames.length) return [];
    
    // 聚合与累积处理 (最近 50 条记录)
    const logs = [...recentLogs].slice(0, 50).reverse();
    const bucketCount = 15;
    const bucketSize = Math.ceil(logs.length / bucketCount);
    const buckets = [];
    
    let cumulative: any = {};
    top5ModelNames.forEach(m => cumulative[m] = 0);

    for (let i = 0; i < bucketCount; i++) {
        const slice = logs.slice(i * bucketSize, (i + 1) * bucketSize);
        if (slice.length === 0) continue;

        // 统计本段窗口内的增量
        slice.forEach(log => {
            if (top5ModelNames.includes(log.model)) {
                const tokens = (log.input_tokens || 0) + (log.output_tokens || 0);
                cumulative[log.model] += tokens;
            }
        });

        const bucketData: any = {
            name: new Date(slice[slice.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTime: new Date(slice[slice.length - 1].timestamp).toLocaleString(),
            ...cumulative
        };

        buckets.push(bucketData);
    }
    return buckets;
  }, [recentLogs, top5ModelNames]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">{t('common.dashboard')}</h1>
           <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Activity} 
          label={t('dashboard.stats.requests')} 
          value={summary?.totalRequests?.toLocaleString() || "0"} 
          color="text-blue-500" 
        />
        <StatCard 
          icon={Zap} 
          label={t('usage.tokens')} 
          value={totalTokens > 1000000 ? `${(totalTokens/1000000).toFixed(1)}M` : `${(totalTokens/1000).toFixed(1)}K`} 
          color="text-amber-500" 
        />
        <StatCard 
          icon={ShieldCheck} 
          label={t('dashboard.stats.health')} 
          value={summary?.totalRequests ? `${Math.round((summary.successRequests / summary.totalRequests) * 100)}%` : "100%"} 
          color="text-green-500" 
        />
        <StatCard 
          icon={Clock} 
          label={t('dashboard.stats.latency')} 
          value={`${Math.round(summary?.avgLatency || 0)}ms`} 
          color="text-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Main Area */}
        <div className="xl:col-span-8 space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Card 1: Provider Health List */}
              <div className="premium-card bg-gradient-to-br from-card to-primary/[0.02] flex flex-col">
                 <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">
                    <Activity size={14} className="text-primary" />
                    {t('dashboard.providerStatus')}
                 </div>
                 <div className="space-y-3 overflow-y-auto max-h-[220px] no-scrollbar">
                    {healthStatus.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50 group hover:border-primary/20 transition-all">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-bold text-[10px] border border-border group-hover:scale-110 transition-transform">
                              {v.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                               <div className="text-sm font-bold capitalize">{v.name || v.id}</div>
                               <div className="flex items-center gap-1.5 mt-0.5">
                                 <div className={cn(
                                   "w-1.5 h-1.5 rounded-full",
                                   v.status === 'healthy' && "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]",
                                   v.status === 'degraded' && "bg-amber-500",
                                   v.status === 'down' && "bg-red-500",
                                   v.status === 'unknown' && "bg-muted-foreground/30"
                                 )} />
                                 <span className="text-[10px] text-muted-foreground font-medium">
                                   {v.status === 'unknown' ? t('dashboard.noTraffic') : t(`common.${v.status}`)}
                                 </span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right shrink-0">
                            <div className="text-sm font-bold tabular-nums">{v.totalChecks}</div>
                            <div className="text-[9px] uppercase text-muted-foreground">{t('dashboard.calls')}</div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Card 2: Provider Bar Chart */}
              <div className="premium-card bg-gradient-to-br from-card to-primary/[0.01] flex flex-col min-h-[320px]">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                       <LayoutGrid size={14} className="text-primary" />
                       {t('dashboard.charts.providerCalls')}
                    </div>
                 </div>
                 <div className="flex-1 min-h-[220px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={providerData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                          <Bar dataKey="requests" radius={[6, 6, 0, 0]} barSize={24}>
                             {(providerData || []).map((entry: any, index: number) => (
                               <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.8} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Model Token Usage Area */}
           <div className="premium-card flex flex-col bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                       <Zap size={14} className="text-primary" />
                       {t('dashboard.charts.modelTokens')}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">{t('dashboard.charts.realTimeTrend')}</div>
                 </div>
                 <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    {top5ModelNames.map((m, i) => (
                      <div key={m} className="flex items-center gap-1.5 grayscale-[0.5] shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px]">{m}</span>
                      </div>
                    ))}
                 </div>
              </div>
              
              <div className="h-[340px] w-full relative">
                 {modelChartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={modelChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                         <defs>
                            {top5ModelNames.map((m, i) => (
                              <linearGradient key={`grad-${m}`} id={`color-${m}`} x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4}/>
                                 <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0}/>
                              </linearGradient>
                            ))}
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                         <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                            minTickGap={40}
                         />
                         <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                         />
                         <Tooltip content={<CustomTooltip />} />
                         {top5ModelNames.map((m, i) => (
                            <Area 
                              key={m}
                              type="linear" 
                              dataKey={m} 
                              stroke={CHART_COLORS[i % CHART_COLORS.length]} 
                              fillOpacity={1} 
                              fill={`url(#color-${m})`} 
                              strokeWidth={2}
                              connectNulls
                              stackId="1"
                              animationDuration={1200}
                            />
                         ))}
                      </AreaChart>
                   </ResponsiveContainer>
                 ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl bg-muted/5">
                       <div className="p-4 rounded-full bg-muted/10 mb-4">
                          <Activity size={32} className="text-muted-foreground/20" />
                       </div>
                       <div className="text-sm font-bold text-muted-foreground/30 uppercase tracking-widest">{t('dashboard.noTraffic')}</div>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Sidebar Area: Recent Activity */}
        <div className="xl:col-span-4 h-full">
           <div className="premium-card h-full bg-card/50 backdrop-blur-sm sticky top-24">
              <div className="flex items-center justify-between mb-8 border-b border-border/40 pb-4">
                 <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <History size={16} className="text-primary" />
                    {t('dashboard.recentLogs')}
                 </div>
                 <button 
                  onClick={() => navigate('/usage')}
                  className="text-[10px] font-bold text-primary hover:underline hover:opacity-80 transition-all uppercase tracking-tighter"
                 >
                   {t('dashboard.viewReports')}
                 </button>
              </div>
              
              <div className="space-y-1">
                {recentLogs.length > 0 ? recentLogs.slice(0, 10).map((log) => (
                  <ActivityItem 
                    key={log.id}
                    model={log.model}
                    time={new Date(log.timestamp).toLocaleTimeString()}
                    status={log.success === 1 ? 'success' : 'error'}
                    latency={`${log.latency_ms}ms`}
                  />
                )) : (
                  <div className="py-20 text-center text-muted-foreground/30 text-xs font-medium border border-dashed border-border rounded-2xl">
                     {t('dashboard.noActivity')}
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
