import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageStore } from '../stores/usage';
import { 
  BarChart3, 
  Coins, 
  TrendingUp, 
  Layers,
  Loader2
} from 'lucide-react';

const UsageBar = ({ label, percentage, color, value }: { label: string, percentage: number, color: string, value: string }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs font-medium">
      <span className="capitalize">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} 
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <BarChart3 size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('common.usage')}</h1>
        </div>
        {isLoading && <Loader2 className="animate-spin text-primary/50" size={18} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Summary */}
        <div className="space-y-6">
           <div className="p-6 rounded-xl border border-blue-500/10 bg-blue-500/[0.02]">
              <div className="flex items-center gap-2 mb-4 text-blue-600">
                 <Coins size={16} />
                 <span className="text-xs font-bold uppercase tracking-wider">{t('usage.cost')}</span>
              </div>
              <div className="text-3xl font-bold tracking-tighter">
                 ${(totalTokens * 0.000002).toFixed(2)}
              </div>
           </div>

           <div className="premium-card space-y-6">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                 <TrendingUp size={14} />
                 {t('usage.quota')}
              </div>
              
              <div className="space-y-6">
                {breakdown?.byProvider?.map((p, idx) => (
                  <UsageBar 
                    key={p.id}
                    label={p.id} 
                    percentage={(p.totalTokens / (totalTokens || 1)) * 100} 
                    color={idx % 2 === 0 ? "bg-primary" : "bg-primary/60"} 
                    value={`${formatTokens(p.totalTokens)}`} 
                  />
                ))}
              </div>
           </div>
        </div>

        {/* Right Column: Detailed Breakdown */}
        <div className="lg:col-span-3">
           <div className="premium-card">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Layers size={14} />
                    {t('usage.breakdown')}
                 </div>
                 <div className="flex border border-border rounded-lg p-1 text-[10px] font-bold">
                    <button className="px-3 py-1 bg-muted rounded-md tracking-tighter">Day</button>
                    <button className="px-3 py-1 bg-background text-muted-foreground hover:bg-muted rounded-md transition-colors tracking-tighter">Month</button>
                 </div>
              </div>

              <div className="space-y-1">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="text-[10px] uppercase text-muted-foreground border-b border-border/40">
                       <th className="pb-3 font-semibold px-2">{t('common.models')}</th>
                       <th className="pb-3 font-semibold text-right">Input</th>
                       <th className="pb-3 font-semibold text-right">Output</th>
                       <th className="pb-3 font-semibold text-right">Requests</th>
                     </tr>
                   </thead>
                   <tbody className="text-sm">
                     {breakdown?.byModel?.map((item) => (
                       <tr key={item.model} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors group">
                         <td className="py-3 px-2 font-medium">{item.model}</td>
                         <td className="py-3 text-right text-muted-foreground tabular-nums">{formatTokens(item.input)}</td>
                         <td className="py-3 text-right text-muted-foreground tabular-nums">{formatTokens(item.output)}</td>
                         <td className="py-3 text-right font-semibold tabular-nums">{item.requests}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {!breakdown?.byModel?.length && (
                   <div className="py-20 text-center text-muted-foreground/30 text-sm italic">
                      No usage data found
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
