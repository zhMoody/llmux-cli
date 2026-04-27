import React, { useEffect, useState } from 'react';
import { useModelsStore } from '../stores/models';
import { useAccountsStore } from '../stores/accounts';
import { useUsageStore } from '../stores/usage';
import { 
  Activity, 
  Zap, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  LayoutGrid,
  History,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const StatCard = ({ icon: Icon, label, value, trend, trendValue, color }: { 
  icon: any, label: string, value: string, trend: 'up' | 'down', trendValue: string, color: string 
}) => (
  <div className="premium-card group">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-4 rounded-[1.25rem] ${color} bg-opacity-10 text-opacity-100 flex items-center justify-center`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      <div className={`flex items-center gap-1 text-xs font-black ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
        {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {trendValue}
      </div>
    </div>
    <div className="space-y-1">
      <h3 className="text-3xl font-black tracking-tighter">{value}</h3>
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">{label}</p>
    </div>
    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
  </div>
);

const ActivityItem = ({ model, time, status, latency }: { model: string, time: string, status: 'success' | 'error', latency: string }) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-transparent hover:border-white/5 transition-all group">
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shadow-inner ring-1",
        status === 'success' ? "bg-green-500/10 text-green-500 ring-green-500/20" : "bg-red-500/10 text-red-500 ring-red-500/20"
      )}>
        {status === 'success' ? 'OK' : 'ERR'}
      </div>
      <div className="overflow-hidden">
        <div className="text-sm font-bold group-hover:text-primary transition-colors truncate max-w-[150px]">{model}</div>
        <div className="text-[10px] uppercase font-black text-muted-foreground opacity-40 tracking-tighter">{time}</div>
      </div>
    </div>
    <div className="text-[10px] font-black uppercase px-2 py-1 bg-white/5 rounded-lg opacity-40">{latency}</div>
  </div>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const { fetchModels } = useModelsStore();
  const { fetchAccounts } = useAccountsStore();
  const { summary, recentLogs, isLoading, fetchSummary } = useUsageStore();
  const [healthStatus, setHealthStatus] = useState<any[]>([]);

  useEffect(() => {
    fetchModels();
    fetchAccounts();
    fetchSummary();
    
    const fetchHealth = async () => {
      try {
        const r = await fetch('/api/health');
        const data = await r.json();
        setHealthStatus(data);
      } catch (err) {
        console.error('Health check failed:', err);
      }
    };
    
    fetchHealth();
    const timer = setInterval(fetchHealth, 30000); // 30秒更新一次健康度
    return () => clearInterval(timer);
  }, []);

  const totalTokens = (summary?.totalInput || 0) + (summary?.totalOutput || 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="h-1 w-12 bg-primary rounded-full" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('dashboard.overview')}</span>
           </div>
           <h1 className="text-5xl font-black tracking-tighter italic flex items-center gap-4">
             <LayoutDashboard size={40} className="text-primary/20" />
             {t('common.dashboard')}
           </h1>
           <p className="text-muted-foreground font-medium mt-2 max-w-md opacity-80">
             {t('dashboard.subtitle')}
           </p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={() => fetchSummary()}
             className="px-6 py-3 bg-secondary/50 hover:bg-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 group"
           >
             <RefreshCw size={14} className={cn("transition-transform duration-500", isLoading ? "animate-spin text-primary" : "group-active:rotate-180")} />
             {t('models.actions.refresh')}
           </button>
           <button className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20">
             {t('dashboard.connectNew')}
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Activity} 
          label={t('dashboard.stats.requests')} 
          value={summary?.totalRequests?.toLocaleString() || "0"} 
          trend="up" 
          trendValue="+12.5%" 
          color="bg-blue-500" 
        />
        <StatCard 
          icon={Zap} 
          label="Total Tokens" 
          value={totalTokens > 1000000 ? `${(totalTokens/1000000).toFixed(1)}M` : `${(totalTokens/1000).toFixed(1)}K`} 
          trend="up" 
          trendValue="+22%" 
          color="bg-amber-500" 
        />
        <StatCard 
          icon={ShieldCheck} 
          label={t('dashboard.stats.health')} 
          value={summary?.totalRequests ? `${Math.round((summary.successRequests / summary.totalRequests) * 100)}%` : "100%"} 
          trend="up" 
          trendValue="Stable" 
          color="bg-emerald-500" 
        />
        <StatCard 
          icon={Clock} 
          label={t('dashboard.stats.latency')} 
          value={`${Math.round(summary?.avgLatency || 0)}ms`} 
          trend="down" 
          trendValue="-8.2%" 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Main Feed */}
        <div className="xl:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3 font-black uppercase text-[10px] tracking-widest opacity-60">
                <LayoutGrid size={14} />
                {t('dashboard.providerStatus')}
              </div>
              <div className="h-px flex-1 bg-border/40 mx-6" />
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {healthStatus.length > 0 ? healthStatus.map(v => (
                <div key={v.id} className="p-6 rounded-[2rem] bg-card border border-border/40 hover:border-primary/20 transition-all group cursor-pointer relative overflow-hidden">
                   <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                         <div className={cn(
                           "w-12 h-12 rounded-2xl flex items-center justify-center font-black uppercase shadow-inner",
                           v.status === 'healthy' ? "bg-green-500/10 text-green-500" : v.status === 'degraded' ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                         )}>
                            {v.id.slice(0, 2)}
                         </div>
                         <div>
                            <div className="font-black tracking-tight capitalize">{v.id}</div>
                            <div className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1.5",
                              v.status === 'healthy' ? "text-green-500" : v.status === 'degraded' ? "text-amber-500" : "text-red-500"
                            )}>
                              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", v.status === 'healthy' ? "bg-green-500" : "bg-red-500")} />
                              {v.status}
                            </div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <div className="text-lg font-black tracking-tighter">{v.totalChecks}</div>
                         <div className="text-[9px] uppercase font-black opacity-30 tracking-tighter">Calls</div>
                      </div>
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )) : (
                ['openai', 'anthropic', 'gemini'].map(id => (
                   <div key={id} className="p-6 rounded-[2rem] bg-card border border-border/40 opacity-40 animate-pulse">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-secondary" />
                         <div className="h-4 w-24 bg-secondary rounded" />
                      </div>
                   </div>
                ))
              )}
           </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3 font-black uppercase text-[10px] tracking-widest opacity-60">
                <History size={14} />
                {t('dashboard.recentLogs')}
              </div>
           </div>
           
           <div className="premium-card bg-secondary/10 border-none p-2 space-y-1">
              {recentLogs.length > 0 ? recentLogs.slice(0, 8).map((log) => (
                <ActivityItem 
                  key={log.id}
                  model={log.model}
                  time={new Date(log.timestamp).toLocaleTimeString()}
                  status={log.success === 1 ? 'success' : 'error'}
                  latency={`${log.latency_ms}ms`}
                />
              )) : (
                <div className="py-20 text-center text-muted-foreground/20 font-black italic uppercase tracking-tighter">
                   No Pulse Recorded
                </div>
              )}
              
              <button className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 hover:text-primary transition-all mt-2">
                {t('dashboard.viewReports')}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
