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

const fmt = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

interface StatGridProps {
  summary: any;
  t: (key: string) => string;
}

export const StatGrid = ({ summary, t }: StatGridProps) => {
  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0) + (summary?.totalCacheRead || 0);
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
        <div className="premium-card p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2 rounded-xl bg-background border border-border shadow-sm text-amber-500">
                <Zap size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('usage.tokens')}</div>
                <div className="text-xl font-bold mt-0.5 tracking-tight">{fmt(totalTokens)}</div>
              </div>
            </div>
            <div className="space-y-1">
              {[
                { color: 'bg-blue-500',  label: t('usage.input'),    value: summary?.totalInput || 0 },
                { color: 'bg-amber-500', label: t('usage.output'),   value: summary?.totalOutput || 0 },
                { color: 'bg-cyan-400',  label: t('usage.cacheHit'), value: summary?.totalCacheRead || 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`w-0.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                  <span className="text-[9px] text-muted-foreground w-16 shrink-0">{item.label}</span>
                  <span className="text-[9px] font-mono font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
