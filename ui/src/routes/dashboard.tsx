import React, { useEffect, useState } from 'react';
import { useModelsStore } from '../stores/models';
import { useAccountsStore } from '../stores/accounts';
import { useUsageStore } from '../stores/usage';
import { 
  Activity, 
  Zap, 
  ShieldCheck, 
  Clock,
  LayoutGrid,
  History,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

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
  const { summary, recentLogs, isLoading, fetchSummary } = useUsageStore();
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
  }, []);

  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Status */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <LayoutGrid size={14} />
              {t('dashboard.providerStatus')}
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {healthStatus.map(v => (
                <div key={v.id} className="p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-all flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0",
                        v.status === 'healthy' && "bg-green-500/10 text-green-600",
                        v.status === 'degraded' && "bg-amber-500/10 text-amber-600",
                        v.status === 'down' && "bg-red-500/10 text-red-600",
                        v.status === 'unknown' && "bg-muted text-muted-foreground"
                      )}>
                         {(v.name || v.id).slice(0, 2)}
                      </div>
                      <div>
                         <div className="text-sm font-semibold capitalize truncate max-w-[120px]">{v.name || v.id}</div>
                         <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                           <div className={cn(
                             "w-1 h-1 rounded-full",
                             v.status === 'healthy' && "bg-green-500",
                             v.status === 'degraded' && "bg-amber-500",
                             v.status === 'down' && "bg-red-500",
                             v.status === 'unknown' && "bg-muted-foreground/30"
                           )} />
                           {v.status === 'unknown' ? t('dashboard.noTraffic') : t(`common.${v.status}`)}
                         </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-sm font-bold">{v.totalChecks}</div>
                      <div className="text-[9px] uppercase text-muted-foreground">{t('dashboard.calls')}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <History size={14} />
              {t('dashboard.recentLogs')}
           </div>
           
           <div className="bg-card border border-border/60 rounded-xl p-3">
              {recentLogs.length > 0 ? recentLogs.slice(0, 6).map((log) => (
                <ActivityItem 
                  key={log.id}
                  model={log.model}
                  time={new Date(log.timestamp).toLocaleTimeString()}
                  status={log.success === 1 ? 'success' : 'error'}
                  latency={`${log.latency_ms}ms`}
                />
              )) : (
                <div className="py-12 text-center text-muted-foreground/30 text-xs font-medium">
                   {t('dashboard.noActivity')}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
