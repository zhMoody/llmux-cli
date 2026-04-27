import React, { useEffect, useState, useMemo } from 'react';
import { useModelsStore } from '../stores/models';
import { 
  Trash2, Box, Link as LinkIcon, Loader2, Plus, Search, Filter, 
  ChevronRight, ChevronDown, Zap, ShieldCheck, Globe, Cpu, RefreshCw, BarChart3 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
  <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group border-border/50 relative overflow-hidden">
    <div className={cn("absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 rounded-full opacity-5 blur-2xl", color)} />
    <div className="flex items-center gap-4 relative z-10">
      <div className={cn("p-3 rounded-xl", color.replace('bg-', 'bg-').replace('-500', '-500/10'), color.replace('bg-', 'text-'))}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{label}</div>
      </div>
    </div>
  </div>
);

export default function Models() {
  const { t } = useTranslation();
  const { 
    availableModels, 
    aliases, 
    isLoading, 
    fetchModels, 
    fetchAliases, 
    addAlias, 
    deleteAlias 
  } = useModelsStore();

  const [aliasName, setAliasName] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [expandedVendors, setExpandedVendors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchModels();
    fetchAliases();
  }, [fetchModels, fetchAliases]);

  useEffect(() => {
    if (availableModels.length > 0 && !targetModel) {
      setTargetModel(availableModels[0].id);
    }
  }, [availableModels, targetModel]);

  // 处理分组与搜索
  const { groupedModels, vendors, totalStats } = useMemo(() => {
    const filtered = availableModels.filter(m => 
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.owned_by.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, typeof availableModels> = {};
    const vendorSet = new Set<string>();

    filtered.forEach(m => {
      const vendor = m.owned_by || 'other';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(m);
      vendorSet.add(vendor);
    });

    return { 
      groupedModels: groups, 
      vendors: Array.from(vendorSet).sort(),
      totalStats: {
        models: availableModels.length,
        vendors: new Set(availableModels.map(m => m.owned_by)).size,
        aliases: aliases.length
      }
    };
  }, [availableModels, searchQuery, aliases]);

  const toggleVendor = (vendor: string) => {
    setExpandedVendors(prev => ({ ...prev, [vendor]: !prev[vendor] }));
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasName || !targetModel) return;

    setIsSubmitting(true);
    try {
      const selectedModel = availableModels.find(m => m.id === targetModel);
      await addAlias(aliasName, targetModel, selectedModel?.owned_by);
      setAliasName('');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header & Main Search */}
      <div className="relative group">
         <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/10 blur-3xl opacity-30 pointer-events-none" />
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Box className="text-primary" size={28} />
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {t('models.title')}
                </h1>
              </div>
              <p className="text-muted-foreground font-medium ml-10">
                {t('models.subtitle')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-96">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('models.filter.searchPlaceholder')}
                  className="w-full bg-card/60 backdrop-blur-xl border rounded-2xl pl-11 pr-4 py-3 outline-none focus:ring-4 focus:ring-primary/10 border-border/50 transition-all shadow-inner"
                />
              </div>
              <button 
                onClick={() => fetchModels()}
                className="p-3 bg-secondary/50 hover:bg-secondary rounded-2xl transition-all active:rotate-180 duration-500"
                title="Refresh Models"
              >
                <RefreshCw size={20} className={isLoading ? "animate-spin text-primary" : ""} />
              </button>
            </div>
         </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Cpu} label={t('models.stats.totalModels')} value={totalStats.models} color="bg-blue-500" />
        <StatCard icon={Globe} label={t('models.stats.activeVendors')} value={totalStats.vendors} color="bg-purple-500" />
        <StatCard icon={Zap} label={t('models.stats.customAliases')} value={totalStats.aliases} color="bg-amber-500" />
        <StatCard icon={ShieldCheck} label={t('models.stats.identityVerified')} value="L-Secure" color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Col: Configuration & Management */}
        <div className="xl:col-span-4 space-y-8">
          <section className="bg-card border rounded-3xl p-8 shadow-sm border-border/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mt-16 -mr-16 group-hover:bg-primary/10 transition-all duration-700" />
            
            <div className="flex items-center gap-3 text-primary font-black mb-8">
              <div className="p-2 bg-primary/10 rounded-xl">
                <LinkIcon size={20} />
              </div>
              <h2 className="text-xl tracking-tight">{t('models.aliasSection')}</h2>
            </div>
            
            <form onSubmit={handleAddAlias} className="space-y-5 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('models.targetModel')}</label>
                <select 
                  className="w-full border border-border/50 rounded-2xl px-4 py-3 bg-secondary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer"
                  value={targetModel}
                  onChange={e => setTargetModel(e.target.value)}
                >
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id} className="bg-card py-2">{m.id} ({m.owned_by})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('models.aliasName')}</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-border/50 rounded-2xl px-4 py-3 bg-secondary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all" 
                  value={aliasName} 
                  onChange={e => setAliasName(e.target.value)} 
                  placeholder={t('models.aliasPlaceholder')} 
                />
              </div>
              <button 
                disabled={isSubmitting || availableModels.length === 0}
                type="submit" 
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-2xl shadow-primary/20 mt-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
                {t('models.createAlias')}
              </button>
            </form>

            <div className="mt-10">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('models.actions.activeLinks')}</h3>
                <div className="h-px flex-1 bg-border/40 mx-4" />
                <BarChart3 size={14} className="text-muted-foreground/40" />
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {aliases.map(a => (
                  <div key={a.id} className="group flex items-center justify-between p-4 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-all border border-transparent hover:border-primary/20">
                    <div className="overflow-hidden mr-3">
                       <div className="font-bold text-sm text-foreground truncate">{a.alias}</div>
                       <div className="text-[10px] text-muted-foreground/70 font-mono truncate py-0.5">↳ {a.target_model}</div>
                    </div>
                    <button 
                      onClick={() => { if(confirm(t('models.deleteConfirm', { name: a.alias }))) deleteAlias(a.id) }}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {aliases.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground/30 font-bold italic text-sm">
                    {t('models.actions.noAliases')}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Col: Library */}
        <div className="xl:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex flex-wrap gap-2">
                <button 
                    onClick={() => setActiveVendor(null)}
                    className={cn(
                      "px-5 py-2 rounded-xl text-xs font-black transition-all border shadow-sm",
                      activeVendor === null ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary border-border/50 text-muted-foreground"
                    )}
                >
                   {t('models.filter.all')}
                </button>
                {vendors.map(v => (
                  <button 
                   key={v}
                   onClick={() => {
                     setActiveVendor(v);
                     setExpandedVendors(prev => ({ ...prev, [v]: true }));
                   }}
                   className={cn(
                     "px-5 py-2 rounded-xl text-xs font-black transition-all border shadow-sm capitalize",
                     activeVendor === v ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary border-border/50 text-muted-foreground"
                   )}
                  >
                   {v}
                  </button>
                ))}
             </div>
          </div>

          <div className={cn("grid gap-6", activeVendor ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
             {vendors.filter(v => activeVendor === null || activeVendor === v).map(vendor => (
                <div key={vendor} className="bg-card border border-border/40 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:border-primary/20 flex flex-col h-full">
                   <button 
                    onClick={() => toggleVendor(vendor)}
                    className="w-full px-6 py-5 bg-gradient-to-br from-muted/20 to-transparent flex items-center justify-between border-b border-border/30 hover:bg-muted/40 transition-colors"
                   >
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-[10px]">
                            {vendor.slice(0, 2)}
                         </div>
                         <span className="capitalize font-black text-sm tracking-tighter">{vendor}</span>
                      </div>
                      <div className="flex items-center gap-6">
                         <div className="hidden lg:flex items-center gap-4 text-[10px] font-black uppercase tracking-tighter opacity-40">
                            <div className="flex flex-col items-end">
                               <span>Input / 1M</span>
                               <span>Output / 1M</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded-full font-black border border-primary/10">
                             {groupedModels[vendor].length}
                           </span>
                           {!(activeVendor === vendor || expandedVendors[vendor]) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                         </div>
                       </div>
                   </button>
                   
                   {(activeVendor === vendor || expandedVendors[vendor]) && (
                     <div className={cn(
                       "flex-1 overflow-y-auto scrollbar-thin animate-in slide-in-from-top-2 duration-300",
                       activeVendor ? "max-h-[calc(100vh-450px)] min-h-[500px]" : "max-h-[400px]"
                     )}>
                        <div className="divide-y divide-border/30">
                          {groupedModels[vendor].map(m => (
                            <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-primary/[0.02] transition-colors group">
                               <div className="flex items-center gap-6">
                                  <div className="flex flex-col">
                                     <div className="font-mono text-xs font-bold text-foreground/90">{m.id}</div>
                                     <div className="flex items-center gap-2 mt-1">
                                        <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter italic">Healthy Outlet</span>
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="flex items-center gap-10">
                                  <div className="flex gap-4 items-center">
                                     <div className="text-right">
                                        <div className="text-[10px] font-black tracking-tight text-primary">$3.00</div>
                                        <div className="text-[10px] font-black tracking-tight text-muted-foreground opacity-60">$15.00</div>
                                     </div>
                                  </div>
                                  <button 
                                   onClick={() => { setTargetModel(m.id); setAliasName(m.id.split('/').pop() || m.id); window.scrollTo({ top: 300, behavior: 'smooth' }); }}
                                   className="text-[10px] font-black text-primary px-4 py-2 bg-primary/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest shadow-sm ring-1 ring-primary/20"
                                  >
                                    {t('models.actions.assign')}
                                  </button>
                               </div>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}
                </div>
             ))}

             {isLoading && availableModels.length === 0 && (
               <div className="col-span-full py-32 text-center">
                 <Loader2 size={48} className="animate-spin mx-auto text-primary opacity-20 mb-4" />
                 <p className="text-muted-foreground font-black uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
               </div>
             )}

             {!isLoading && vendors.length === 0 && (
               <div className="col-span-full py-24 border-2 border-dashed border-border/50 rounded-[40px] text-center bg-muted/10">
                 <div className="bg-card w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                   <Search size={32} className="text-muted-foreground/30" />
                 </div>
                 <h4 className="text-xl font-black tracking-tight mb-2">No Matching Models</h4>
                 <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                   Try adjusting your filters or checking your connected accounts.
                 </p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
