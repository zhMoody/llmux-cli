import React, { useEffect, useState } from 'react';
import { useAccountsStore } from '../stores/accounts';
import { 
  Users, 
  Trash2, 
  Plus, 
  Settings2, 
  Key, 
  Globe,
  Loader2,
  AlertCircle,
  Save,
  Monitor,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Accounts() {
  const { t } = useTranslation();
  const { accounts, isLoading, fetchAccounts, addAccount, deleteAccount, toggleActive } = useAccountsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'web'>('api');
  const [formData, setFormData] = useState({ alias: '', provider_id: 'openai', api_key: '', base_url: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAccount(formData);
      setIsModalOpen(false);
      setFormData({ alias: '', provider_id: 'openai', api_key: '', base_url: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const copyScript = () => {
    const script = `(async()=>{const p="${formData.provider_id}";console.log("🚀 LLMux Syncing...");const t=localStorage.getItem("token")||document.cookie;fetch("http://localhost:25975/api/auth/sync",{method:"POST",body:JSON.stringify({provider:p,token:t})})})();`;
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('common.accounts')}</h1>
            <p className="text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={16} />
          {t('accounts.addAccount')}
        </button>
      </div>

      {isLoading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-primary/50" />
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((acc) => (
          <div key={acc.id} className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold text-xs uppercase border border-border">
                {acc.provider_id.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                   <h3 className="font-bold text-sm">{acc.alias}</h3>
                   <span className={cn(
                     "text-[10px] font-bold px-2 py-0.5 rounded-full",
                     acc.is_active === 1 ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                   )}>
                     {acc.is_active === 1 ? t('common.online') : 'Offline'}
                   </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 uppercase tracking-tight">
                  <Globe size={10} /> {acc.provider_id}
                  <span className="opacity-20">|</span>
                  <Key size={10} /> {t('accounts.apiKey')}: ****
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => toggleActive(acc.id, acc.is_active)}
                 className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
               >
                 <Settings2 size={16} />
               </button>
               <button 
                 onClick={() => { if(confirm(t('accounts.deleteConfirm', { name: acc.alias }))) deleteAccount(acc.id); }}
                 className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-muted-foreground transition-colors"
               >
                 <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}

        {!isLoading && accounts.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
             <AlertCircle className="mx-auto mb-2 text-muted-foreground/30" />
             <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('accounts.registerTitle')}>
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1">
             <button 
               onClick={() => setActiveTab('api')}
               className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeTab === 'api' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
             >
                API Key
             </button>
             <button 
               onClick={() => setActiveTab('web')}
               className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeTab === 'web' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
             >
                {t('auth.webLogin')}
             </button>
          </div>

          {activeTab === 'api' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.alias')}</label>
                <input 
                  type="text" required value={formData.alias}
                  onChange={e => setFormData({...formData, alias: e.target.value})}
                  placeholder={t('accounts.aliasPlaceholder')}
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.provider')}</label>
                <select 
                  value={formData.provider_id}
                  onChange={e => {
                    const pid = e.target.value;
                    let burl = formData.base_url;
                    if (pid === 'qwen') burl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
                    setFormData({...formData, provider_id: pid, base_url: burl});
                  }}
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="qwen">Aliyun Qwen (DashScope)</option>
                  <option value="custom">Custom (OpenAI Compatible)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.apiKey')}</label>
                <input 
                  type="password" required value={formData.api_key}
                  onChange={e => setFormData({...formData, api_key: e.target.value})}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>
              {/* Base URL 始终显示，支持所有厂商的中转/代理 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.baseUrl')}</label>
                  <span className="text-[10px] text-muted-foreground opacity-50 font-medium italic">Optional</span>
                </div>
                <input 
                  type="text" value={formData.base_url}
                  onChange={e => setFormData({...formData, base_url: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="pt-4 flex gap-3">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted transition-all">{t('common.cancel')}</button>
                 <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
                   <Save size={16} /> {t('common.save')}
                 </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">{t('accounts.provider')}</div>
                  <select 
                    value={formData.provider_id}
                    onChange={e => setFormData({...formData, provider_id: e.target.value})}
                    className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                  >
                    <option value="poe">Poe</option>
                    <option value="claude">Claude Web</option>
                  </select>
               </div>
               
               <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-4">
                  <div className="flex items-start gap-3">
                     <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">1</div>
                     <p className="text-xs font-medium leading-relaxed">{t('auth.step1')}</p>
                  </div>
                  <div className="flex items-start gap-3">
                     <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">2</div>
                     <p className="text-xs font-medium leading-relaxed">{t('auth.step3')}</p>
                  </div>
                  
                  <div className="pt-2">
                     <button 
                       onClick={copyScript}
                       className="w-full flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-lg text-xs font-bold hover:bg-muted transition-all"
                     >
                       {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                       {copied ? "Copied!" : t('auth.copyScript')}
                     </button>
                  </div>
               </div>
               
               <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-600 rounded-lg text-[10px] font-bold">
                  <Monitor size={14} />
                  {t('auth.step3Hint')}
               </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
