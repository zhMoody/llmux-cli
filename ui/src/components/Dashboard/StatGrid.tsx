import React from 'react';
import { LucideIcon, Activity, Zap, ShieldCheck, Clock } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}

const StatCard = ({ icon: Icon, label, value, color }: StatCardProps) => (
  <div className="premium-card p-4 transition-all hover:scale-[1.02]">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-xl bg-background border border-border shadow-sm ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
        <div className="text-xl font-bold mt-0.5 tracking-tight">{value}</div>
      </div>
    </div>
  </div>
);

interface StatGridProps {
  summary: any;
  t: (key: string) => string;
}

export const StatGrid = ({ summary, t }: StatGridProps) => {
  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0);
  const healthRate = summary?.totalRequests 
    ? Math.round((summary.successRequests / summary.totalRequests) * 100) 
    : 100;
  
  return (
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
        value={totalTokens >= 1000000 ? `${(totalTokens/1000000).toFixed(1)}M` : `${(totalTokens/1000).toFixed(1)}K`} 
        color="text-amber-500" 
      />
      <StatCard 
        icon={ShieldCheck} 
        label={t('dashboard.stats.health')} 
        value={`${healthRate}%`} 
        color="text-green-500" 
      />
      <StatCard 
        icon={Clock} 
        label={t('dashboard.stats.latency')} 
        value={`${((summary?.avgLatency || 0) / 1000).toFixed(1)}s`}
        color="text-purple-500" 
      />
    </div>
  );
};
