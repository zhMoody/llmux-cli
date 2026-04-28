import React, { useEffect, useState, useMemo } from 'react';
import { useModelsStore } from '../stores/models';
import { 
  Box, 
  Search, 
  RefreshCcw, 
  ExternalLink,
  ChevronRight,
  Database,
  Plus,
  Save,
  Trash2,
  LayoutGrid,
  Zap,
  ArrowRight,
  Copy
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, ConfirmDialog } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Models() {
  const { t, i18n } = useTranslation();
  const { availableModels, aliases, isLoading, fetchModels, fetchAliases, addAlias, deleteAlias, testModel } = useModelsStore();
  const [search, setSearch] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aliasForm, setAliasForm] = useState({ alias: '', target: '', provider: '' });
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string; loading?: boolean; lastChecked?: string; limitsCache?: any }>>({});
  const [queueStatus, setQueueStatus] = useState<{ isRunning: boolean; current: number; total: number; progress: number }>({ isRunning: false, current: 0, total: 0, progress: 0 });
  const { startTestQueue, fetchTestQueueStatus } = useModelsStore();
  const [testAllConfirm, setTestAllConfirm] = useState(false);
  const [aliasToDelete, setAliasToDelete] = useState<{id: number, name: string} | null>(null);

  const handleTest = async (modelId: string, providerId: string) => {
    setTestResults(prev => ({ ...prev, [modelId]: { success: false, loading: true } }));
    const result = await testModel(modelId, providerId);
    // @ts-ignore
    setTestResults(prev => ({ ...prev, [modelId]: { ...result, loading: false } }));
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/models/health');
      if (res.ok) {
        const data = await res.json();
        setTestResults(prev => {
          const next = { ...prev };
          data.forEach((row: any) => {
            // Don't overwrite if it's currently loading
            if (!next[row.model]?.loading) {
              next[row.model] = {
                success: Boolean(row.success),
                latency: row.latency,
                error: row.error,
                lastChecked: row.last_checked,
                limitsCache: row.limits_cache
              };
            }
          });
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to fetch models health", e);
    }
  };

  // 1. 初始加载数据
  useEffect(() => {
    fetchModels();
    fetchAliases();
    fetchHealth();
    // 进入页面时仅检查一次队列状态
    fetchTestQueueStatus().then(setQueueStatus);
  }, []);

  // 2. 智能轮询：仅在队列运行时开启定时器
  useEffect(() => {
    if (!queueStatus.isRunning) return;

    const timer = setInterval(async () => {
      const status = await fetchTestQueueStatus();
      setQueueStatus(status);

      // 如果还在跑，顺便刷新健康状态
      if (status.isRunning) {
        fetchHealth();
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [queueStatus.isRunning]);

  const providers = useMemo(() => {
    const p = Array.from(new Set(availableModels.map(m => m.owned_by)));
    return p;
  }, [availableModels]);

  // 当模型列表加载完成后，如果还没选厂商，默认选第一个
  useEffect(() => {
    if (providers.length > 0 && !activeProvider) {
      setActiveProvider(providers[0]);
    }
  }, [providers, activeProvider]);

  const filteredModels = useMemo(() => {
    return (availableModels || []).filter(m => {
      const matchSearch = m.id.toLowerCase().includes(search.toLowerCase()) || 
                          m.owned_by.toLowerCase().includes(search.toLowerCase());
      const matchProvider = m.owned_by === activeProvider;
      return matchSearch && matchProvider;
    });
  }, [availableModels, search, activeProvider]);

  const handleTestAll = () => {
    if (queueStatus.isRunning) return;
    setTestAllConfirm(true);
  };

  const executeTestAll = async () => {
    const modelsToTest = filteredModels.map(m => ({ model: m.id, providerId: m.owned_by }));
    await startTestQueue(modelsToTest);

    // 立即刷新状态
    const status = await fetchTestQueueStatus();
    setQueueStatus(status);
    setTestAllConfirm(false);
  };
  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAlias(aliasForm.alias, aliasForm.target, aliasForm.provider);
      setIsModalOpen(false);
      setAliasForm({ alias: '', target: '', provider: '' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Box size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('common.models')}</h1>
            <p className="text-sm text-muted-foreground">{t('models.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleTestAll}
             disabled={queueStatus.isRunning || filteredModels.length === 0}
             className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-all shadow-sm disabled:opacity-50"
             title={t('models.testAllDesc')}
           >
             <Zap size={16} className={cn(queueStatus.isRunning && "animate-pulse")} />
             {queueStatus.isRunning ? t('models.testingQueue', { current: queueStatus.current, total: queueStatus.total }) : t('models.testAll')}
           </button>
           <button 
             onClick={() => { fetchModels(); fetchHealth(); }}
             className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
             title={t('models.actions.refresh')}
           >
             <RefreshCcw size={18} className={cn(isLoading && "animate-spin")} />
           </button>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
           >
             <Plus size={16} />
             {t('models.createAlias')}
           </button>
        </div>
      </div>

      {/* Aliases Section (Condensed) */}
      {aliases.length > 0 && (
        <div className="space-y-4">
           <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              {t('models.aliasSection')}
           </h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {aliases.map(a => (
                <div key={a.id} className="p-2.5 bg-card border border-border rounded-xl flex items-center justify-between group hover:border-primary/30 transition-all">
                   <div className="flex items-center gap-2 min-w-0">
                      <button 
                        onClick={() => navigator.clipboard.writeText(a.alias)} 
                        className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-black uppercase flex items-center gap-1 hover:bg-primary/20 transition-colors"
                        title={t('models.actions.copyAlias')}
                      >
                        {a.alias} <Copy size={8} />
                      </button>
                      <ArrowRight size={10} className="text-muted-foreground opacity-30 shrink-0" />
                      <div className="text-[11px] font-bold truncate text-muted-foreground">{a.target_model}</div>
                   </div>
                   <button 
                     onClick={() => setAliasToDelete({ id: a.id, name: a.alias })}
                     className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
           <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50 overflow-x-auto no-scrollbar">
              {providers.map(p => (
                <button
                  key={p}
                  onClick={() => setActiveProvider(p)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap capitalize",
                    activeProvider === p 
                      ? "bg-card text-primary shadow-sm border border-border/50" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              ))}
              {providers.length === 0 && <span className="px-4 py-1.5 text-xs text-muted-foreground italic">No providers</span>}
           </div>
           
           <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder={t('models.filter.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
           </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {filteredModels.map((model) => (
          <div key={model.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group flex flex-col justify-between min-h-[160px]">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">{model.owned_by}</span>
                <div className="flex items-center gap-1.5">
                   {testResults[model.id]?.loading ? (
                     <RefreshCcw size={10} className="animate-spin text-muted-foreground" />
                   ) : testResults[model.id] ? (
                     <div className={cn(
                       "w-1.5 h-1.5 rounded-full",
                       testResults[model.id]?.success ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                     )} title={testResults[model.id]?.error} />
                   ) : null}
                   <LayoutGrid size={12} className="text-muted-foreground/30" />
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm tracking-tight line-clamp-2 leading-snug">{model.id}</h3>
                <button 
                  onClick={() => navigator.clipboard.writeText(model.id)}
                  className="mt-0.5 text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                  title={t('models.actions.copyName')}
                >
                  <Copy size={12} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {testResults[model.id]?.latency && (
                  <span className="text-[10px] text-green-600 font-bold">{testResults[model.id]?.latency}ms</span>
                )}
                {testResults[model.id]?.lastChecked && (
                  <span className="text-[9px] text-muted-foreground/60 font-medium">
                    {new Date(testResults[model.id]!.lastChecked!).toLocaleString(i18n.language, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
              {testResults[model.id]?.error && (
                <p className="text-[9px] text-red-500 font-medium line-clamp-1 opacity-80" title={testResults[model.id]?.error}>{testResults[model.id]?.error}</p>
              )}
              {/* 限额进度条：只有厂商返回了 ratelimit 数据才显示 */}
              {(() => {
                const limits = testResults[model.id]?.limitsCache;
                if (!limits) return null;
                const remaining = parseInt(limits['x-ratelimit-remaining-tokens'] ?? limits['x-quota-remaining'] ?? -1);
                const total = parseInt(limits['x-ratelimit-limit-tokens'] ?? limits['x-quota-total'] ?? -1);
                if (remaining < 0 || total <= 0) return null;
                const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
                const color = pct > 50 ? 'bg-green-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Tokens</span>
                      <span>{remaining.toLocaleString()} / {total.toLocaleString()}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
               <button 
                 onClick={() => handleTest(model.id, model.owned_by)}
                 disabled={testResults[model.id]?.loading || queueStatus.isRunning}
                 className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
               >
                 <Zap size={12} className={cn(testResults[model.id]?.success && "text-amber-500")} />
                 {testResults[model.id]?.loading ? t('models.testing') : t('models.testBtn')}
               </button>
               <button 
                 onClick={() => {
                    setAliasForm({ alias: '', target: model.id, provider: model.owned_by });
                    setIsModalOpen(true);
                 }}
                 className="flex items-center gap-1 text-primary hover:opacity-80 transition-opacity"
               >
                 {t('models.actions.assign')}
                 <ChevronRight size={12} />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredModels.length === 0 && !isLoading && (
        <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
           <p className="text-sm text-muted-foreground font-medium italic">
             {providers.length === 0 ? t('models.noAccountsConnected') : t('models.noModelsFound')}
           </p>
        </div>
      )}

      {/* Add Alias Modal */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('models.createAlias')}>
        <form onSubmit={handleAddAlias} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">{t('models.aliasName')}</label>
            <input
              type="text" required value={aliasForm.alias}
              onChange={e => setAliasForm({...aliasForm, alias: e.target.value})}
              placeholder={t('models.aliasPlaceholder')}
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">{t('models.targetModel')}</label>
            <select
              value={aliasForm.target}
              onChange={e => {
                const m = availableModels.find(x => x.id === e.target.value);
                setAliasForm({...aliasForm, target: e.target.value, provider: m?.owned_by || ''});
              }}
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
            >
              <option value="">{t('common.default')}</option>
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>[{m.owned_by}] {m.id}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex gap-3">
             <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted transition-all">{t('common.cancel')}</button>
             <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
               <Save size={16} /> {t('common.save')}
             </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={testAllConfirm}
        onClose={() => setTestAllConfirm(false)}
        onConfirm={executeTestAll}
        title={t('models.testAllTitle')}
        description={t('models.testAllConfirm', '即将把当前筛选出的这批模型发送至后台队列顺序拨测。\n\n⚠️注意：测试将真实调用模型接口发出一句简单的问候，每次将消耗约 1 Token 左右的资源。\n如果在执行期间离开此页面，后台测试依然会继续直至完成。是否继续？')}
        confirmText={t('models.testAllStart')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!aliasToDelete}
        onClose={() => setAliasToDelete(null)}
        onConfirm={async () => {
          if (aliasToDelete) {
            await deleteAlias(aliasToDelete.id);
            setAliasToDelete(null);
          }
        }}
        title={t('common.delete')}
        description={t('models.deleteConfirm', { name: aliasToDelete?.name })}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}

