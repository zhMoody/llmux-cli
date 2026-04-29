import React from 'react';
import { Coins, TrendingUp } from 'lucide-react';

interface UsageStatsProps {
  t: (key: string, options?: any) => string;
  totalCost: number;
  estimatedSavings: number;
  summary: any;
  formatTokens: (n: number) => string;
}

export const UsageStats = ({ t, totalCost, estimatedSavings, summary, formatTokens }: UsageStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Estimated Cost Card */}
      <div className="premium-card bg-gradient-to-br from-indigo-600 to-indigo-500 text-white border-0 shadow-xl shadow-indigo-500/20 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
          <Coins size={80} />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="text-xs font-black uppercase tracking-[0.2em] opacity-90">{t('usage.estimatedModelCost')}</div>
          <div className="text-4xl font-black tracking-tighter tabular-nums">${totalCost.toFixed(2)}</div>
          <div className="flex items-center gap-1.5 pt-2">
            <div className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold backdrop-blur-sm">{t('usage.processed')}</div>
          </div>
        </div>
      </div>

      {/* Savings Card */}
      <div className="premium-card border-emerald-500/20 bg-emerald-500/[0.02] overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-600">
          <TrendingUp size={80} />
        </div>
        <div className="space-y-4">
          <div className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">{t('usage.estimatedSavings')}</div>
          <div className="text-4xl font-black tracking-tighter tabular-nums text-emerald-600">${estimatedSavings.toFixed(2)}</div>
          <div className="text-xs font-bold text-emerald-600/80 uppercase">{t('usage.optimizationValue')}</div>
        </div>
      </div>

      {/* Tokens Card */}
      <div className="premium-card">
        <div className="space-y-4">
          <div className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{t('usage.totalTokens')}</div>
          <div className="text-4xl font-black tracking-tighter tabular-nums">
            {formatTokens((summary?.totalInput || 0) + (summary?.totalOutput || 0))}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40" /> 
              {formatTokens(summary?.totalInput || 0)} <span className="opacity-70">In</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" /> 
              {formatTokens(summary?.totalOutput || 0)} <span className="opacity-70">Out</span>
            </div>
          </div>
        </div>
      </div>

      {/* Latency Card */}
      <div className="premium-card">
        <div className="space-y-4">
          <div className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{t('dashboard.stats.latency')}</div>
          <div className="flex items-end gap-2">
            <div className="text-4xl font-black tracking-tighter tabular-nums">{Math.round(summary?.avgLatency || 0)}</div>
            <div className="text-sm font-bold text-muted-foreground mb-1.5">ms</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-muted-foreground uppercase">{t('dashboard.stats.health')}</div>
            <div className="text-xs font-black text-green-500">
              {summary?.totalRequests ? ((summary.successRequests / summary.totalRequests) * 100).toFixed(1) : '0.0'}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
