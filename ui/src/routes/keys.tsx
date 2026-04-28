import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeysStore, ApiKey } from '../stores/keys';
import { useModelsStore } from '../stores/models';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  ShieldCheck, 
  Check,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  BookOpen
} from 'lucide-react';
import { Dialog, ConfirmDialog } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function KeysPage() {
  const { t } = useTranslation();
  const { keys, isLoading, fetchKeys, createKey, deleteKey } = useKeysStore();
  const { availableModels, aliases, fetchModels, fetchAliases } = useModelsStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [newKeyData, setNewKeyData] = useState({ name: '', allowedModels: '*' as '*' | string[] });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});

  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}/v1` : 'http://localhost:25975/v1';

  useEffect(() => {
    fetchKeys();
    fetchModels();
    fetchAliases();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const key = await createKey(newKeyData.name, newKeyData.allowedModels);
      setGeneratedKey(key); // 必须在 catch 之外，确保成功拿回 Key 就显示
    } catch (err) {
      // 即使列表刷新失败了（401），如果 createKey 成功拿回了 key 数据，也可以尝试从 store 的逻辑里补救
      console.error("Create key error:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here
  };

  const toggleVisibility = (id: number) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sortedModels = [
    ...aliases.map(a => ({ id: a.alias, isAlias: true, provider: a.provider_id })),
    ...availableModels.filter(m => !aliases.some(a => a.alias === m.id)).map(m => ({ id: m.id, isAlias: false, provider: m.owned_by }))
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Key size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('keys.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('keys.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setGeneratedKey(null);
            setNewKeyData({ name: '', allowedModels: '*' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={16} />
          {t('keys.createKey')}
        </button>
      </div>

      {/* Usage Documentation */}
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="space-y-1.5 relative">
          <div className="font-bold flex items-center gap-2 text-sm">
            <Terminal size={16} className="text-primary" />
            {t('keys.apiUsage')}
          </div>
          <div className="text-xs text-muted-foreground font-medium max-w-xl leading-relaxed">
            {t('keys.apiDesc')}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl border border-border/50 relative">
          <span className="text-[10px] font-black uppercase text-muted-foreground/60 border-r border-border/50 pr-2 mr-1 ml-1">{t('keys.endpoint')}</span>
          <code className="text-sm font-mono font-bold select-all text-primary">{baseUrl}</code>
          <button 
            onClick={() => copyToClipboard(baseUrl)} 
            className="p-1.5 hover:bg-background text-muted-foreground hover:text-foreground rounded transition-colors ml-1 shadow-sm border border-transparent hover:border-border"
            title={t('keys.copyBase')}
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {keys.map((k) => (
          <div key={k.id} className="p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all group relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{k.name}</h3>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(k.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-sm bg-muted/30 p-2 rounded-lg border border-border/50 group/key">
                  <span className="text-muted-foreground">
                    {visibleKeys[k.id] ? k.key : '••••••••••••••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button 
                      onClick={() => toggleVisibility(k.id)}
                      className="p-1 hover:bg-background rounded transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {visibleKeys[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(k.key)}
                      className="p-1 hover:bg-background rounded transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t('keys.permissions')}</div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <ShieldCheck size={14} className={k.allowed_models === '*' ? 'text-green-500' : 'text-blue-500'} />
                    <span className="text-xs font-bold capitalize">
                      {k.allowed_models === '*' ? t('keys.allModels') : t('keys.specificModels', { count: JSON.parse(k.allowed_models).length })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setKeyToDelete(k)}
                  className="p-2.5 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-muted-foreground transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && keys.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-border rounded-3xl">
             <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground/30">
                <Lock size={24} />
             </div>
             <p className="text-sm text-muted-foreground font-medium">{t('keys.noKeysYet')}</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={generatedKey ? t('keys.keyCreated') : t('keys.createKey')}
      >
        {generatedKey ? (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">{t('keys.secretKey')}</span>
                <span className="text-[10px] text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded">{t('keys.saveThisNow')}</span>
              </div>
              <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
                <code className="text-sm font-mono flex-1 truncate">{generatedKey}</code>
                <button 
                  onClick={() => copyToClipboard(generatedKey)}
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full py-3 bg-muted hover:bg-muted/80 rounded-xl font-bold transition-all"
            >
              {t('common.done')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase px-1">{t('keys.keyName')}</label>
              <input 
                type="text" 
                required
                value={newKeyData.name}
                onChange={e => setNewKeyData({...newKeyData, name: e.target.value})}
                placeholder={t('keys.keyPlaceholder')}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground uppercase px-1">{t('keys.permissions')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewKeyData({...newKeyData, allowedModels: '*'})}
                  className={cn(
                    "p-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                    newKeyData.allowedModels === '*' 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <ShieldCheck size={16} />
                  {t('keys.allModels')}
                </button>
                <button
                  type="button"
                  onClick={() => setNewKeyData({...newKeyData, allowedModels: []})}
                  className={cn(
                    "p-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                    newKeyData.allowedModels !== '*' 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <Plus size={16} />
                  {t('keys.selectedModels')}
                </button>
              </div>
            </div>

            {newKeyData.allowedModels !== '*' && (
              <div className="max-h-48 overflow-y-auto p-2 border border-border rounded-xl space-y-1 bg-muted/20">
                {sortedModels.map(item => (
                  <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors group">
                    <input 
                      type="checkbox"
                      checked={Array.isArray(newKeyData.allowedModels) && newKeyData.allowedModels.includes(item.id)}
                      onChange={(e) => {
                        const current = Array.isArray(newKeyData.allowedModels) ? newKeyData.allowedModels : [];
                        if (e.target.checked) {
                          setNewKeyData({...newKeyData, allowedModels: [...current, item.id]});
                        } else {
                          setNewKeyData({...newKeyData, allowedModels: current.filter(x => x !== item.id)});
                        }
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="text-xs font-medium truncate">{item.id}</span>
                      {item.isAlias ? (
                        <span className="shrink-0 text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">Alias</span>
                      ) : (
                        <span className="shrink-0 text-[8px] font-bold text-muted-foreground/40 uppercase">{item.provider}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 border border-border rounded-xl font-bold hover:bg-muted transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                type="submit"
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        isOpen={!!keyToDelete}
        onClose={() => setKeyToDelete(null)}
        onConfirm={async () => {
          if (keyToDelete) {
            await deleteKey(keyToDelete.id);
            setKeyToDelete(null);
          }
        }}
        title={t('keys.revokeKey')}
        description={t('keys.deleteConfirm', { name: keyToDelete?.name })}
        confirmText={t('keys.revoke')}
        variant="danger"
      />
    </div>
  );
}
