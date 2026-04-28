import React from 'react';
import { History } from 'lucide-react';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface ActivityItemProps {
  model: string;
  time: string;
  status: 'success' | 'error';
  latency: string;
}

const ActivityItem = ({ model, time, status, latency }: ActivityItemProps) => (
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

interface RecentActivityListProps {
  recentLogs: any[];
  t: (key: string) => string;
  onViewReports: () => void;
}

export const RecentActivityList = ({ recentLogs, t, onViewReports }: RecentActivityListProps) => {
  return (
    <div className="premium-card h-full bg-card/50 backdrop-blur-sm sticky top-24">
      <div className="flex items-center justify-between mb-8 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          <History size={16} className="text-primary" />
          {t('dashboard.recentLogs')}
        </div>
        <button 
          onClick={onViewReports}
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
  );
};
