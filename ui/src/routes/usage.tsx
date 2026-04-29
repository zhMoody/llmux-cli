import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageStore } from '../stores/usage';
import { 
  Layers,
  ArrowUpRight,
  Search,
  RefreshCw,
  FileText,
  Activity,
  Zap
} from 'lucide-react';
import { ChartData } from 'chart.js';

// Sub-components
import { UsageStats } from '../components/Usage/UsageStats';
import { UsageCharts } from '../components/Usage/UsageCharts';
import { UsageTable } from '../components/Usage/UsageTable';
import { UsageLogs } from '../components/Usage/UsageLogs';

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

  // Load Pricing Data
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
      // Find exact price or use a reasonable default ($0.002/$0.006 per 1k)
      const modelKey = Object.keys(prices).find(k => item.model?.includes(k) || k.includes(item.model)) || '';
      const p = prices[modelKey] || { input: 0.002, output: 0.006 };
      
      const inputCost = ((item.input || 0) / 1000) * p.input;
      const outputCost = ((item.output || 0) / 1000) * p.output;
      
      return inputCost + outputCost;
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

  const estimatedSavings = totalCost * 0.25;

  const doughnutData = useMemo<ChartData<'doughnut'>>(() => ({
    labels: processedBreakdown?.byAccount.map(a => a.name || a.id) || [],
    datasets: [{
      data: processedBreakdown?.byAccount.map(a => a.cost) || [],
      backgroundColor: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      borderRadius: 4
    }]
  }), [processedBreakdown]);

  const barData = useMemo<ChartData<'bar'>>(() => ({
    labels: processedBreakdown?.byModel.slice(0, 5).map(m => m.model) || [],
    datasets: [{
      label: t('usage.avgLatencyLabel'),
      data: processedBreakdown?.byModel.slice(0, 5).map(m => m.avgLatency) || [],
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: '#6366f1',
      borderWidth: 2,
      borderRadius: 6,
    }]
  }), [processedBreakdown, t]);

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
    (m.model || '').toLowerCase().includes(searchQuery.toLowerCase())
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
            {['1h', '24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r as TimeRange)}
                className={cn(
                  "px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider",
                  timeRange === r ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="p-2.5 bg-muted/50 hover:bg-muted border border-border/50 rounded-xl transition-all">
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

      <UsageStats 
        t={t} 
        totalCost={totalCost} 
        estimatedSavings={estimatedSavings} 
        summary={summary} 
        formatTokens={formatTokens} 
      />

      <UsageCharts 
        t={t} 
        doughnutData={doughnutData} 
        barData={barData} 
        activeAccountsCount={processedBreakdown?.byAccount.length || 0} 
      />

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
                   activeView === v.id ? "bg-background text-primary shadow-sm border border-border/20" : "text-muted-foreground hover:text-foreground"
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

        {activeView === 'breakdown' ? (
          <UsageTable t={t} data={filteredModelBreakdown || []} formatTokens={formatTokens} />
        ) : (
          <UsageLogs t={t} logs={logs} page={page} setPage={setPage} />
        )}

        {(!logs.length && !processedBreakdown?.byModel.length && !isLoading) && (
          <div className="py-32 flex flex-col items-center justify-center text-muted-foreground/30">
             <Activity size={48} className="opacity-10 mb-6" />
             <div className="text-sm font-black uppercase tracking-widest">{t('usage.noData')}</div>
             <p className="text-xs mt-2 font-medium">{t('usage.captureTraffic')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
