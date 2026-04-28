import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settings';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Terminal, 
  Monitor,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { ConfirmDialog } from '../components/Modal';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const SettingGroup = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
      <Icon size={14} />
      <span>{title}</span>
    </div>
    <div className="p-1 border border-border rounded-xl bg-card">
      <div className="divide-y divide-border/40">
        {children}
      </div>
    </div>
  </div>
);

const SettingItem = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
    <div className="space-y-0.5">
      <div className="text-sm font-bold">{label}</div>
      {description && <div className="text-[11px] text-muted-foreground font-medium">{description}</div>}
    </div>
    <div className="flex items-center">
      {children}
    </div>
  </div>
);

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config, isLoading, fetchSettings, updateSettings } = useSettingsStore();
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
  const [showSaved, setShowSaved] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    await updateSettings(localConfig);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handlePurge = async () => {
    setIsConfirmOpen(false);
    setIsPurging(true);
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/'; 
      } else {
        alert('Reset failed');
      }
    } catch (err) {
      console.error('Purge failed:', err);
      alert('Network error');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('common.settings')}</h1>
            <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleSave}
             disabled={isLoading}
             className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
           >
             {isLoading ? <Loader2 size={14} className="animate-spin" /> : showSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
             {showSaved ? t('common.saved') : t('settings.saveChanges')}
           </button>
        </div>
      </div>

      <div className="space-y-8">
        <SettingGroup title={t('settings.infra')} icon={Terminal}>
           <SettingItem label={t('settings.port')} description={t('settings.portDesc')}>
             <input 
              type="text" 
              value={localConfig.port || '25975'} 
              onChange={e => setLocalConfig({...localConfig, port: e.target.value})}
              className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs font-bold w-24 text-center outline-none focus:ring-1 focus:ring-primary/20"
             />
           </SettingItem>
           <SettingItem label={t('settings.autoUpdate')} description={t('settings.autoUpdateDesc')}>
             <div 
                onClick={() => setLocalConfig({...localConfig, autoUpdate: !localConfig.autoUpdate})}
                className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors px-1 flex items-center", localConfig.autoUpdate ? 'bg-primary' : 'bg-muted')}
              >
                <div className={cn("w-3 h-3 bg-white rounded-full transition-all", localConfig.autoUpdate ? 'translate-x-5' : 'translate-x-0')} />
             </div>
           </SettingItem>
        </SettingGroup>

        <SettingGroup title={t('settings.ui')} icon={Monitor}>
           <SettingItem label={t('settings.theme')} description={t('settings.themeDesc')}>
             <div className="flex border border-border rounded-lg overflow-hidden text-[10px] font-bold">
                <button 
                  onClick={() => setLocalConfig({...localConfig, theme: 'dark'})}
                  className={cn("px-4 py-1.5 transition-colors", localConfig.theme !== 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  {t('settings.themeDark')}
                </button>
                <button 
                  onClick={() => setLocalConfig({...localConfig, theme: 'light'})}
                  className={cn("px-4 py-1.5 transition-colors", localConfig.theme === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  {t('settings.themeLight')}
                </button>
             </div>
           </SettingItem>
        </SettingGroup>

        <SettingGroup title={t('settings.security')} icon={Shield}>
           <SettingItem label={t('settings.purge')} description={t('settings.purgeDesc')}>
             <button 
                onClick={() => setIsConfirmOpen(true)}
                disabled={isPurging}
                className="px-3 py-1.5 text-[10px] font-bold text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
              >
                {isPurging ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                {t('settings.purgeBtn')}
             </button>
           </SettingItem>
        </SettingGroup>
      </div>

      <ConfirmDialog 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handlePurge}
        title={t('common.delete')}
        description={t('settings.purgeConfirm')}
        confirmText={t('settings.purgeBtn')}
        cancelText={t('common.cancel')}
        variant="danger"
        size="md"
        isLoading={isPurging}
      />
    </div>
  );
}
