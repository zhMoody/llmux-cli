import React, { useEffect, useState } from 'react';
import { useAccountsStore } from '../stores/accounts';
import { 
  Plus, 
  Trash2, 
  Power, 
  PowerOff, 
  Loader2, 
  Users as UsersIcon, 
  Globe, 
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WebLoginWizard from '../components/WebLoginWizard';

const AccountCard = ({ acc, onToggle, onDelete }: { acc: any, onToggle: any, onDelete: any }) => {
  const { t } = useTranslation();
  return (
    <div className={`premium-card group overflow-hidden ${acc.is_active ? 'border-primary/20' : 'opacity-60 grayscale'}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center font-black ring-1 ring-white/5 shadow-inner">
             {acc.provider_id.slice(0, 2).toUpperCase()}
           </div>
           <div>
              <h3 className="font-black text-lg tracking-tight group-hover:text-primary transition-colors">{acc.alias}</h3>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60 tracking-widest">{acc.provider_id}</span>
                 {acc.is_active === 1 && <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />}
              </div>
           </div>
        </div>
        <div className="flex gap-1">
           <button 
             onClick={() => onToggle(acc.id, acc.is_active)}
             className={`p-2.5 rounded-xl transition-all active:scale-90 ${acc.is_active ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary'}`}
           >
             {acc.is_active ? <Power size={18} /> : <PowerOff size={18} />}
           </button>
           <button 
             onClick={() => { if(confirm(t('accounts.deleteConfirm', { name: acc.alias }))) onDelete(acc.id) }}
             className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
           >
             <Trash2 size={18} />
           </button>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/5">
         <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-muted-foreground opacity-40">{t('common.status')}</span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${acc.is_active ? 'bg-green-500/10 text-green-500' : 'bg-secondary text-muted-foreground'}`}>
               {acc.is_active ? t('common.active') : t('common.disabled')}
            </span>
         </div>
         <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-muted-foreground opacity-40 italic">{t('accounts.endpoints')}</span>
            <span className="text-[10px] font-mono text-muted-foreground opacity-60 truncate max-w-[150px]">{acc.base_url || t('common.default')}</span>
         </div>
      </div>
      
      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-700" />
    </div>
  );
};

export default function Accounts() {
  const { t } = useTranslation();
  const { accounts, isLoading, fetchAccounts, deleteAccount, toggleActive, addAccount } = useAccountsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAcc, setNewAcc] = useState({ alias: '', provider_id: 'openai', api_key: '', base_url: '' });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<'openai' | 'claude'>('openai');

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addAccount(newAcc);
      setShowAdd(false);
      setNewAcc({ alias: '', provider_id: 'openai', api_key: '', base_url: '' });
    } catch (err: any) {
      alert(t('accounts.addFailed') || 'Failed to add account: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWizard = (provider: 'openai' | 'claude') => {
    setWizardProvider(provider);
    setWizardOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="h-1 w-12 bg-primary rounded-full" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('accounts.identity')}</span>
           </div>
           <h1 className="text-5xl font-black tracking-tighter italic">{t('accounts.title')}</h1>
           <p className="text-muted-foreground font-medium mt-2 max-w-md opacity-80">{t('accounts.subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
           <div className="flex bg-secondary/30 p-1 rounded-2xl border border-white/5">
              <button onClick={() => openWizard('openai')} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 rounded-xl transition-all flex items-center gap-2">
                <Globe size={14} /> OpenAI Sync
              </button>
              <div className="w-px h-4 bg-white/5 self-center" />
              <button onClick={() => openWizard('claude')} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 rounded-xl transition-all flex items-center gap-2">
                <Globe size={14} /> Claude Sync
              </button>
           </div>
           <button 
             onClick={() => setShowAdd(!showAdd)}
             className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
           >
             {showAdd ? t('common.cancel') : <><Plus size={16} /> {t('accounts.addAccount')}</>}
           </button>
        </div>
      </div>

      <WebLoginWizard 
        isOpen={wizardOpen} 
        onClose={() => { setWizardOpen(false); fetchAccounts(); }} 
        provider={wizardProvider} 
      />

      {showAdd && (
        <div className="premium-card bg-secondary/10 border-dashed border-primary/20 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 mb-8">
             <ShieldCheck className="text-primary" />
             <h2 className="text-xl font-black tracking-tight uppercase italic">{t('accounts.registerTitle')}</h2>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('accounts.alias')}</label>
              <input required type="text" className="w-full bg-background/50 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all" value={newAcc.alias} onChange={e => setNewAcc({...newAcc, alias: e.target.value})} placeholder={t('accounts.aliasPlaceholder')} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('accounts.provider')}</label>
              <select className="w-full bg-background/50 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer appearance-none" value={newAcc.provider_id} onChange={e => setNewAcc({...newAcc, provider_id: e.target.value})}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="custom">Custom (Compatible)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('accounts.apiKey')}</label>
              <input required type="password" className="w-full bg-background/50 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all" value={newAcc.api_key} onChange={e => setNewAcc({...newAcc, api_key: e.target.value})} placeholder="sk-..." />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t('accounts.baseUrl')}</label>
              <input type="text" className="w-full bg-background/50 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all" value={newAcc.base_url} onChange={e => setNewAcc({...newAcc, base_url: e.target.value})} placeholder="https://api..." />
            </div>
            <div className="lg:col-span-4 flex justify-end gap-3 pt-4">
               <button 
                disabled={isSubmitting}
                type="submit" 
                className="bg-primary text-primary-foreground px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-primary/20"
               >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon size={16} />}
                {t('common.save')}
               </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <AccountCard key={acc.id} acc={acc} onToggle={toggleActive} onDelete={deleteAccount} />
        ))}
        
        {accounts.length === 0 && !isLoading && (
          <div className="col-span-full py-32 border-2 border-dashed border-border/50 rounded-[3rem] bg-secondary/5 flex flex-col items-center justify-center group pointer-events-none">
            <UsersIcon className="text-primary/20 group-hover:scale-110 transition-transform duration-500" size={64} />
            <h3 className="text-xl font-black tracking-tight mt-6 opacity-40">{t('accounts.noAccounts')}</h3>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-20 mt-2">{t('accounts.addFirst')}</p>
          </div>
        )}

        {isLoading && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center">
             <RefreshCw className="animate-spin text-primary/40 mb-4" size={48} />
          </div>
        )}
      </div>
    </div>
  );
}

const SaveIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
