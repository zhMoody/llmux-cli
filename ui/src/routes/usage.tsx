import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageStore } from '../stores/usage';
import { 
  BarChart3, 
  Coins, 
  TrendingUp, 
  Layers,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';

const UsageBar = ({ label, percentage, color, value }: { label: string, percentage: number, color: string, value: string }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between px-1">
      <span className="text-sm font-bold tracking-tight capitalize">{label}</span>
      <span className="text-xs font-black text-muted-foreground">{value}</span>
    </div>
    <div className="h-2.5 w-full bg-secondary/30 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} 
        style={{ width: `${Math.min(percentage, 100)}%` }} 
      />
    </div>
  </div>
);

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function Usage() {
  const { t } = useTranslation();
  const { summary, breakdown, isLoading, fetchSummary, fetchDetails } = useUsageStore();

  useEffect(() => {
    fetchSummary();
    fetchDetails();
  }, []);

  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0);

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/20">
            <BarChart3 size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic">{t('common.usage')}</h1>
            <p className="text-muted-foreground font-medium opacity-60">{t('usage.subtitle')}</p>
          </div>
        </div>
        {isLoading && <Loader2 className="animate-spin text-primary" size={20} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary Cards */}
        <div className="lg:col-span-1 space-y-6">
           <div className="premium-card bg-gradient-to-br from-blue-600/20 to-transparent border-blue-500/20">
              <div className="flex items-center gap-4 mb-6">
                 <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Coins size={24} />
                 </div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-blue-500/80">{t('usage.cost')} (Est.)</div>
              </div>
              <div className="space-y-1">
                 <div className="text-5xl font-black tracking-tighter leading-none">
                    ${(totalTokens * 0.000002).toFixed(2)}
                 </div>
                 <div className="flex items-center gap-2 text-xs font-black text-green-500/60 uppercase tracking-tighter">
                   Based on tokens consumption
                 </div>
              </div>
           </div>

           <div className="premium-card space-y-8">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest opacity-60">{t('usage.quota')}</span>
                 </div>
              </div>
              
              <div className="space-y-8">
                {breakdown?.byProvider && breakdown.byProvider.length > 0 ? breakdown.byProvider.map((p, idx) => (
                  <UsageBar 
                    key={p.id}
                    label={p.id} 
                    percentage={(p.totalTokens / (totalTokens || 1)) * 100} 
                    color={idx % 2 === 0 ? "bg-blue-500" : "bg-purple-500"} 
                    value={`${formatTokens(p.totalTokens)} Tokens`} 
                  />
                )) : (
                  <div className="text-center py-6 text-muted-foreground/30 font-black italic">No data</div>
                )}
              </div>
           </div>
        </div>

        {/* Right: Detailed Table View */}
        <div className="lg:col-span-2">
           <div className="premium-card h-full flex flex-col min-h-[600px]">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <Layers size={20} className="text-primary" />
                    <h3 className="text-xl font-black tracking-tight italic">{t('usage.breakdown')}</h3>
                 </div>
                 <div className="flex gap-2">
                    <button className="px-5 py-2 bg-secondary/50 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-secondary transition-all">Day</button>
                    <button className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-primary/10">Month</button>
                 </div>
              </div>

              <div className="flex-1 space-y-4">
                 {breakdown?.byModel && breakdown.byModel.length > 0 ? breakdown.byModel.map((item) => (
                   <div key={item.model} className="flex items-center justify-between p-5 rounded-2xl bg-secondary/10 hover:bg-secondary/30 transition-all border border-transparent hover:border-white/5 group">
                      <div className="flex items-center gap-4">
                         <div className="w-1.5 h-10 rounded-full bg-primary/20 group-hover:bg-primary transition-all" />
                        <div>
                           <div className="text-sm font-bold truncate max-w-[200px]">{item.model}</div>
                           <div className="flex gap-4 mt-0.5">
                              <span className="text-[9px] font-black uppercase text-blue-500 opacity-60">In: {formatTokens(item.input)}</span>
                              <span className="text-[9px] font-black uppercase text-purple-500 opacity-60">Out: {formatTokens(item.output)}</span>
                           </div>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black tracking-tight">${((item.input + item.output) * 0.000002).toFixed(4)}</div>
                         <div className="text-[10px] font-black text-muted-foreground opacity-40 uppercase">
                           {item.requests} Req
                         </div>
                      </div>
                   </div>
                 )) : (
                   <div className="h-full flex items-center justify-center text-muted-foreground/20 font-black italic uppercase tracking-widest">
                     No Records Found
                   </div>
                 )}
              </div>

              <button className="w-full mt-8 py-4 bg-secondary/30 hover:bg-secondary/50 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                {t('usage.downloadCsv')}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
