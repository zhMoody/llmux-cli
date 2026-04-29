import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageStore } from '../stores/usage';
import { 
  BarChart3, 
  Coins, 
  TrendingUp, 
  Layers,
  Loader2,
  Calendar,
  Filter,
  DollarSign,
  Activity,
  ArrowUpRight,
  Clock,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartData,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
type ViewType = 'breakdown' | 'logs';

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function Usage() {
  const { t } = useTranslation();
  const { summary, breakdown, logs, isLoading, fetchSummary, fetchDetails, fetchLogs } = useUsageStore();
  
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [activeView, setActiveView] = useState<ViewType>('breakdown');
  const [searchQuery, setSearchQuery] = useState('');
  const [prices, setPrices] = useState<Record<string, { input: number, output: number }>>({});
  const [page, setPage] = useState(0);

  // 加载价格数据
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const localRes = await fetch('/api/models/prices').catch(() => null);
        if (localRes && localRes.ok) {
          const localData = await localRes.json();
          const priceMap: Record<string, any> = {};
          localData.forEach((p: any) => {
            priceMap[p.model_id] = { input: p.input_price, output: p.output_price };
          });
          setPrices(priceMap);
          return;
        }
      } catch (e) {}
    };
    loadPrices();
  }, []);

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

  const loadData = async () => {
    const { start, end } = getTimeParams(timeRange);
    await Promise.all([
      fetchSummary(start, end),
      fetchDetails(start, end),
      fetchLogs({ start, end, limit: 50, offset: page * 50 })
    ]);
  };

  useEffect(() => {
    loadData();
  }, [timeRange, page]);

  const processedBreakdown = useMemo(() => {
    if (!breakdown) return null;
    const calculateCost = (item: any) => {
      const modelKey = Object.keys(prices).find(k => item.model?.includes(k) || k.includes(item.model)) || '';
      const p = prices[modelKey] || { input: 0.002, output: 0.006 };
      const inputCost = ((item.input || 0) / 1000) * p.input;
      const outputCost = ((item.output || 0) / 1000) * p.output;
      return item.totalTokens ? (item.totalTokens / 1000) * ((p.input + p.output) / 2) : (inputCost + outputCost);
    };

    return {
      byModel: (breakdown.byModel || []).map(m => ({ ...m, cost: calculateCost(m) })),
      byProvider: (breakdown.byProvider || []).map(p => ({ ...p, cost: calculateCost(p) })),
      byAccount: (breakdown.byAccount || []).map(a => ({ ...a, cost: calculateCost(a) }))
    };
  }, [breakdown, prices]);

  const totalCost = useMemo(() => {
    return processedBreakdown?.byModel.reduce((acc, curr) => acc + curr.cost, 0) || 0;
  }, [processedBreakdown]);

  // 虚拟“省下”金额逻辑：假设优化前平均成本比现在高 25%
  const estimatedSavings = totalCost * 0.25;

  const doughnutData: ChartData<'doughnut'> = {
    labels: processedBreakdown?.byProvider.map(p => p.id) || [],
    datasets: [{
      data: processedBreakdown?.byProvider.map(p => p.cost) || [],
      backgroundColor: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      borderRadius: 4
    }]
  };

  const barData: ChartData<'bar'> = {
    labels: processedBreakdown?.byModel.slice(0, 5).map(m => m.model) || [],
    datasets: [{
      label: 'Avg Latency (ms)',
      data: processedBreakdown?.byModel.slice(0, 5).map(m => m.avgLatency) || [],
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: '#6366f1',
      borderWidth: 2,
      borderRadius: 6,
    }]
  };

  const handleExport = () => {
    if (!processedBreakdown) return;
    const headers = ["Model", "Input Tokens", "Output Tokens", "Requests", "Cost (USD)"];
    const rows = processedBreakdown.byModel.map(m => [
      m.model, m.input, m.output, m.requests, m.cost.toFixed(4)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `llmux_usage_${timeRange}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredModelBreakdown = processedBreakdown?.byModel.filter(m => 
    m.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-inner shadow-primary/5">
            <Zap size={28} className="fill-primary/20" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('usage.title')}</h1>
            <p className="text-sm text-muted-foreground font-medium">{t('usage.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50">
            {[
              { id: '1h', label: '1H' },
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '1M' }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setTimeRange(r.id as TimeRange)}
                className={cn(
                  "px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider",
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
            onClick={loadData}
            className="p-2.5 bg-muted/50 hover:bg-muted border border-border/50 rounded-xl transition-all"
          >
            <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black transition-all hover:opacity-90 shadow-lg shadow-primary/20"
          >
            <ArrowUpRight size={14} />
            {t('usage.downloadCsv')}
          </button>
        </div>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="premium-card bg-gradient-to-br from-indigo-600 to-indigo-500 text-white border-0 shadow-xl shadow-indigo-500/20 overflow-hidden relative group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
             <Coins size={80} />
           </div>
           <div className="relative z-10 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{t('usage.estimatedModelCost')}</div>
              <div className="text-4xl font-black tracking-tighter tabular-nums">${totalCost.toFixed(2)}</div>
              <div className="flex items-center gap-1.5 pt-2">
                  <div className="px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-bold backdrop-blur-sm">{t('usage.processed')}</div>
              </div>
           </div>
        </div>

        <div className="premium-card border-emerald-500/20 bg-emerald-500/[0.02] overflow-hidden relative group">
           <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-600">
             <TrendingUp size={80} />
           </div>
           <div className="space-y-4">
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">{t('usage.estimatedSavings')}</div>
              <div className="text-4xl font-black tracking-tighter tabular-nums text-emerald-600">${estimatedSavings.toFixed(2)}</div>
              <div className="text-[10px] font-bold text-emerald-600/60 uppercase">{t('usage.optimizationValue')}</div>
           </div>
        </div>

        <div className="premium-card">
           <div className="space-y-4">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('usage.totalTokens')}</div>
              <div className="text-4xl font-black tracking-tighter tabular-nums">{formatTokens((summary?.totalInput || 0) + (summary?.totalOutput || 0))}</div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" /> {formatTokens(summary?.totalInput || 0)} In
                 </div>
                 <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {formatTokens(summary?.totalOutput || 0)} Out
                 </div>
              </div>
           </div>
        </div>

        <div className="premium-card">
           <div className="space-y-4">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{t('dashboard.stats.latency')}</div>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-black tracking-tighter tabular-nums">{Math.round(summary?.avgLatency || 0)}</div>
                <div className="text-sm font-bold text-muted-foreground mb-1.5">ms</div>
              </div>
              <div className="flex items-center justify-between">
                 <div className="text-[10px] font-bold text-muted-foreground uppercase">{t('dashboard.stats.health')}</div>
                 <div className="text-[10px] font-black text-green-500">{summary?.totalRequests ? ((summary.successRequests / summary.totalRequests) * 100).toFixed(1) : '0.0'}%</div>
              </div>
           </div>
        </div>
      </div>

      {/* Analytics Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="premium-card lg:col-span-1 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-full h-[200px]">
              <Doughnut 
                data={doughnutData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  cutout: '75%'
                }} 
              />
            </div>
            <div className="mt-6 text-center">
               <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('usage.realTimePricing')}</div>
               <div className="text-lg font-black">{t('usage.activeVendors', { count: processedBreakdown?.byProvider.length || 0 })}</div>
            </div>
         </div>

         <div className="premium-card lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
               <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('usage.efficiency')}</div>
               <div className="text-[10px] font-bold px-2 py-1 bg-muted rounded-lg text-muted-foreground uppercase">{t('usage.performance')}</div>
            </div>
            <div className="h-[200px]">
               <Bar 
                 data={barData} 
                 options={{
                   responsive: true,
                   maintainAspectRatio: false,
                   plugins: { legend: { display: false } },
                   scales: { 
                     x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                     y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } }
                   }
                 }} 
               />
            </div>
         </div>
      </div>

      {/* Data Center Section */}
      <div className="premium-card border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
           <div className="flex p-1 bg-muted/60 rounded-xl border border-border/40">
             {[
               { id: 'breakdown', label: t('usage.breakdown'), icon: <Layers size={14}/> },
               { id: 'logs', label: t('usage.auditLogs'), icon: <FileText size={14}/> }
             ].map(v => (
               <button
                 key={v.id}
                 onClick={() => setActiveView(v.id as ViewType)}
                 className={cn(
                   "flex items-center gap-2 px-6 py-2 text-[11px] font-black rounded-lg transition-all uppercase tracking-tight",
                   activeView === v.id 
                     ? "bg-background text-primary shadow-sm border border-border/20" 
                     : "text-muted-foreground hover:text-foreground"
                 )}
               >
                 {v.icon}
                 {v.label}
               </button>
             ))}
           </div>

           <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={16} />
              <input 
                type="text" 
                placeholder={activeView === 'breakdown' ? t('usage.searchModels') : t('usage.searchLogs')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted/40 border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          {activeView === 'breakdown' ? (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-black uppercase text-muted-foreground/40 border-b border-border/20">
                  <th className="pb-4 px-4">{t('common.models')}</th>
                  <th className="pb-4 text-right px-4">USAGE (I/O)</th>
                  <th className="pb-4 text-right px-4">{t('usage.performance')}</th>
                  <th className="pb-4 text-right px-4">{t('usage.cost')}</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {filteredModelBreakdown?.map((item) => (
                  <tr key={item.model} className="group bg-muted/5 hover:bg-primary/[0.03] transition-all duration-300">
                    <td className="py-4 px-4 rounded-l-2xl border-l border-t border-b border-transparent group-hover:border-primary/10">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold group-hover:text-primary transition-colors">{item.model}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter opacity-60">{t('usage.provisioned')}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right px-4 tabular-nums">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-foreground">{formatTokens(item.input + item.output)}</span>
                        <span className="text-[9px] text-muted-foreground/50 font-mono tracking-tighter">{formatTokens(item.input)}i / {formatTokens(item.output)}o</span>
                      </div>
                    </td>
                    <td className="py-4 text-right px-4">
                       <div className="flex flex-col items-end gap-1">
                          <div className="text-xs font-bold tabular-nums">{Math.round(item.avgLatency)}ms</div>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                             <div className="h-full bg-primary/40 rounded-full" style={{ width: `${(item.successCount / (item.requests || 1) * 100)}%` }} />
                          </div>
                       </div>
                    </td>
                    <td className="py-4 text-right px-4 rounded-r-2xl border-r border-t border-b border-transparent group-hover:border-primary/10">
                      <div className="inline-flex items-center px-3 py-1 bg-primary/5 border border-primary/10 rounded-lg text-xs font-black text-primary shadow-sm shadow-primary/5">
                        ${item.cost.toFixed(4)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-black uppercase text-muted-foreground/40 border-b border-border/20">
                  <th className="pb-4 px-4">{t('usage.time')}</th>
                  <th className="pb-4 px-4">{t('common.models')}</th>
                  <th className="pb-4 px-4">{t('usage.account')}</th>
                  <th className="pb-4 text-right px-4">{t('usage.latency')}</th>
                  <th className="pb-4 text-right px-4">{t('usage.status')}</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {logs.map((log) => (
                  <tr key={log.id} className="group bg-muted/5 hover:bg-primary/[0.03] transition-all duration-300">
                    <td className="py-4 px-4 rounded-l-2xl text-[10px] font-bold text-muted-foreground tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-xs font-black group-hover:text-primary transition-colors">{log.model}</td>
                    <td className="py-4 px-4">
                       <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                         <span className="text-[11px] font-bold uppercase tracking-tight">{log.account_name || 'System'}</span>
                       </div>
                    </td>
                    <td className="py-4 text-right px-4 tabular-nums text-xs font-bold text-muted-foreground">
                      {log.latency_ms}ms
                    </td>
                    <td className="py-4 text-right px-4 rounded-r-2xl">
                       <div className={cn(
                         "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tighter uppercase",
                         log.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                       )}>
                         {log.success ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                         {log.success ? t('usage.success') : t('usage.failed')}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination for Logs */}
          {activeView === 'logs' && logs.length > 0 && (
             <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
                <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{t('usage.page', { page: page + 1 })}</div>
                <div className="flex gap-2">
                   <button 
                     disabled={page === 0}
                     onClick={() => setPage(p => Math.max(0, p - 1))}
                     className="p-2 bg-muted/40 hover:bg-muted border border-border/40 rounded-lg disabled:opacity-30 transition-all"
                   >
                     <ChevronLeft size={16}/>
                   </button>
                   <button 
                     disabled={logs.length < 50}
                     onClick={() => setPage(p => p + 1)}
                     className="p-2 bg-muted/40 hover:bg-muted border border-border/40 rounded-lg disabled:opacity-30 transition-all"
                   >
                     <ChevronRight size={16}/>
                   </button>
                </div>
             </div>
          )}

          {(!logs.length && !processedBreakdown?.byModel.length && !isLoading) && (
            <div className="py-32 flex flex-col items-center justify-center text-muted-foreground/30">
               <Activity size={48} className="opacity-10 mb-6" />
               <div className="text-sm font-black uppercase tracking-widest">{t('usage.noData')}</div>
               <p className="text-[10px] mt-2 font-medium">Capture traffic to see insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
