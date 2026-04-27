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
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Models() {
  const { t } = useTranslation();
  const { availableModels, aliases, isLoading, fetchModels, fetchAliases, addAlias, deleteAlias } = useModelsStore();
  const [search, setSearch] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aliasForm, setAliasForm] = useState({ alias: '', target: '', provider: '' });

  useEffect(() => {
    fetchModels();
    fetchAliases();
  }, []);

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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
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
             onClick={() => fetchModels()}
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
                      <div className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-black uppercase">{a.alias}</div>
                      <ArrowRight size={10} className="text-muted-foreground opacity-30 shrink-0" />
                      <div className="text-[11px] font-bold truncate text-muted-foreground">{a.target_model}</div>
                   </div>
                   <button 
                     onClick={() => deleteAlias(a.id)}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredModels.map((model) => (
          <div key={model.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group flex flex-col justify-between h-36">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">{model.owned_by}</span>
                <LayoutGrid size={12} className="text-muted-foreground/30" />
              </div>
              <h3 className="font-bold text-sm tracking-tight line-clamp-2 leading-snug">{model.id}</h3>
            </div>
            
            <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
               <div className="flex items-center gap-1.5 opacity-60">
                  <Database size={12} />
                  Context: 128k
               </div>
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
             {providers.length === 0 ? "No accounts connected" : "No models found in this provider"}
           </p>
        </div>
      )}

      {/* Add Alias Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('models.createAlias')}>
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
      </Modal>
    </div>
  );
}

