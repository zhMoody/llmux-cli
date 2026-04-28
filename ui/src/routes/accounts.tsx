import React, { useEffect, useState } from 'react';
import { useAccountsStore } from '../stores/accounts';
import { useModelsStore } from '../stores/models';
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
  CheckCircle2,
  Pencil,
  Download,
  ShieldAlert,
  Power
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, ConfirmDialog } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Accounts() {
  const { t } = useTranslation();
  const { accounts, isLoading, fetchAccounts, addAccount, updateAccount, deleteAccount, toggleActive } = useAccountsStore();
  const { fetchModels, startTestQueue, availableModels } = useModelsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'web'>('api');
  const [formData, setFormData] = useState({ alias: '', provider_id: 'custom', api_key: '', base_url: '' });
  const [editData, setEditData] = useState({ alias: '', provider_id: '', api_key: '', base_url: '', notes: '' });
  const [copied, setCopied] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{id: number, name: string} | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAccount(formData);
      setIsModalOpen(false);
      setFormData({ alias: '', provider_id: 'custom', api_key: '', base_url: '' });
      // 新增账户后，自动触发一次全局背景测试
      triggerAutoTest();
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAutoTest = async () => {
    // 1. 先拉取最新的模型列表（因为新增了账户，模型可能变动）
    await fetchModels();
    // 2. 获取当前最新的模型状态
    const latestModels = useModelsStore.getState().availableModels;
    if (latestModels.length > 0) {
      const modelsToTest = latestModels.map(m => ({ model: m.id, providerId: m.owned_by }));
      await startTestQueue(modelsToTest);
    }
  };

  const openEdit = (acc: any) => {
    setEditingAccount(acc);
    setEditData({ alias: acc.alias, provider_id: acc.provider_id, api_key: '', base_url: acc.base_url || '', notes: acc.notes || '' });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await updateAccount(editingAccount.id, editData);
      setIsEditOpen(false);
      setEditingAccount(null);
      // 修改账户后也触发一次（比如修改了 Key 或 BaseURL）
      triggerAutoTest();
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

  const handleExport = async (id?: number, alias?: string) => {
    const targetId = id || accountToDelete?.id;
    const targetName = alias || accountToDelete?.name;
    if (!targetId) return;
    
    try {
      const res = await fetch(`/api/accounts/${targetId}/export`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `usage_history_${targetName || targetId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
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
                     {acc.is_active === 1 ? t('common.online') : t('accounts.offline')}
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
                    onClick={() => handleExport(acc.id, acc.alias)}
                    className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-all"
                    title={t('accounts.exportData')}
                  >
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={() => openEdit(acc)}
                    className="p-2 hover:bg-amber-500/10 text-amber-500 rounded-lg transition-all"
                    title="Edit account"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => toggleActive(acc.id, acc.is_active)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      acc.is_active === 1 
                        ? "hover:bg-green-500/10 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.1)]" 
                        : "hover:bg-muted text-muted-foreground/40"
                    )}
                    title={acc.is_active === 1 ? t('common.online') : t('accounts.offline')}
                  >
                    <Power size={16} />
                  </button>
                  <button
                    onClick={() => setAccountToDelete({ id: acc.id, name: acc.alias })}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>              </div>
          </div>
        ))}

        {!isLoading && accounts.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
             <AlertCircle className="mx-auto mb-2 text-muted-foreground/30" />
             <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
          </div>
        )}
      </div>

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('accounts.registerTitle')}>
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
                    let burl = '';
                    if (pid === 'qwen') burl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
                    else if (pid === 'openai') burl = '';
                    else if (pid === 'anthropic') burl = '';
                    else if (pid === 'gemini') burl = '';
                    setFormData({...formData, provider_id: pid, base_url: burl});
                  }}
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                >
                  <option value="custom">{t('accounts.custom')}</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="qwen">Aliyun Qwen (DashScope)</option>
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
                  <span className="text-[10px] text-muted-foreground opacity-50 font-medium italic">{t('accounts.optional')}</span>
                </div>
                <input
                  type="text" value={formData.base_url}
                  onChange={e => setFormData({...formData, base_url: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
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
                       {copied ? t('accounts.copied') : t('auth.copyScript')}
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
      </Dialog>

      {/* 编辑账户 Modal */}
      <Dialog isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditingAccount(null); }} title={t('accounts.editAccount')}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.alias')}</label>
            <input
              type="text" required value={editData.alias}
              onChange={e => setEditData({...editData, alias: e.target.value})}
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">{t('accounts.provider')}</label>
            <select
              value={editData.provider_id}
              onChange={e => setEditData({...editData, provider_id: e.target.value})}
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
            >
              <option value="custom">{t('accounts.custom')}</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
              <option value="qwen">Aliyun Qwen (DashScope)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase">API Key</label>
              <span className="text-[10px] text-muted-foreground italic">{t('accounts.leaveBlank')}</span>
            </div>
            <input
              type="password" value={editData.api_key}
              onChange={e => setEditData({...editData, api_key: e.target.value})}
              placeholder={t('accounts.leaveBlank')}
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase">Base URL</label>
              <span className="text-[10px] text-muted-foreground opacity-50 italic">{t('accounts.optional')}</span>
            </div>
            <input
              type="text" value={editData.base_url}
              onChange={e => setEditData({...editData, base_url: e.target.value})}
              placeholder="https://api.openai.com/v1"
              className="w-full px-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="pt-4 flex gap-3">
             <button type="button" onClick={() => { setIsEditOpen(false); setEditingAccount(null); }} className="flex-1 px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted transition-all">{t('common.cancel')}</button>
             <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
               <Save size={16} /> {t('common.save')}
             </button>
          </div>
        </form>
      </Dialog>

      {/* 增强型删除确认弹窗 */}
      <Dialog 
        isOpen={!!accountToDelete} 
        onClose={() => setAccountToDelete(null)} 
        title={t('common.delete')}
        variant="danger"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
               onClick={() => handleExport()}
               className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-all"
            >
               <Download size={14} />
               {t('accounts.exportData')}
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => setAccountToDelete(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted transition-all">
                {t('common.cancel')}
              </button>
              <button 
                onClick={async () => {
                  if (accountToDelete) {
                    await deleteAccount(accountToDelete.id);
                    setAccountToDelete(null);
                  }
                }}
                className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all flex items-center gap-2"
              >
                <Trash2 size={16} />
                {t('common.delete')}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
           <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-4">
              <ShieldAlert size={24} className="text-red-500 shrink-0" />
              <div className="space-y-1">
                 <p className="text-sm font-bold text-red-600">{t('accounts.deleteWarning')}</p>
                 <p className="text-xs text-red-500/80 leading-relaxed">
                   {t('accounts.deleteConfirm', { name: accountToDelete?.name })}
                 </p>
              </div>
           </div>
           <p className="text-[11px] text-muted-foreground px-1 italic">
             {t('accounts.deleteWarningDetail')}
           </p>
        </div>
      </Dialog>
    </div>
  );
}
