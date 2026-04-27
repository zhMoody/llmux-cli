import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const SettingGroup = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="premium-card">
    <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
      <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
        <Icon size={20} />
      </div>
      <h2 className="text-xl font-black tracking-tight italic">{title}</h2>
    </div>
    <div className="space-y-6">
      {children}
    </div>
  </div>
);

const SettingItem = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
    <div className="space-y-1">
      <div className="font-bold text-sm">{label}</div>
      {description && <div className="text-xs text-muted-foreground opacity-60 font-medium">{description}</div>}
    </div>
    <div className="flex items-center">
      {children}
    </div>
  </div>
);

export default function Settings() {
  const { t } = useTranslation();
  const { config, isLoading, fetchSettings, updateSettings } = useSettingsStore();
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
  const [showSaved, setShowSaved] = useState(false);

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

  const updateField = (key: string, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary/50 rounded-2xl">
            <SettingsIcon size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic">{t('common.settings')}</h1>
            <p className="text-muted-foreground font-medium opacity-60">{t('settings.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => setLocalConfig(config)}
             className="flex items-center gap-2 px-6 py-3 bg-secondary/30 hover:bg-secondary/50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
           >
             <RotateCcw size={14} /> {t('settings.reset')}
           </button>
           <button 
             onClick={handleSave}
             disabled={isLoading}
             className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
           >
             {isLoading ? <Loader2 size={14} className="animate-spin" /> : showSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
             {showSaved ? "Saved!" : t('settings.saveChanges')}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Gateway Group */}
        <SettingGroup title={t('settings.infra')} icon={Terminal}>
           <SettingItem 
            label={t('settings.port')} 
            description={t('settings.portDesc')}
           >
             <input 
              type="text" 
              value={localConfig.port || '25975'} 
              onChange={e => updateField('port', e.target.value)}
              className="bg-secondary/50 border border-white/5 rounded-xl px-4 py-2 text-sm font-bold w-32 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-center"
             />
           </SettingItem>
           <SettingItem 
            label={t('settings.autoUpdate')} 
            description={t('settings.autoUpdateDesc')}
           >
             <div 
               onClick={() => updateField('autoUpdate', !localConfig.autoUpdate)}
               className={`w-12 h-6 ${localConfig.autoUpdate ? 'bg-primary' : 'bg-secondary'} rounded-full relative flex items-center px-1 cursor-pointer transition-colors`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-all ${localConfig.autoUpdate ? 'translate-x-6' : 'translate-x-0'}`} />
             </div>
           </SettingItem>
        </SettingGroup>

        {/* Interface Group */}
        <SettingGroup title={t('settings.ui')} icon={Monitor}>
           <SettingItem 
            label={t('settings.theme')} 
            description={t('settings.themeDesc')}
           >
             <div className="flex bg-secondary/50 rounded-xl p-1 border border-white/5">
                <button 
                  onClick={() => updateField('theme', 'dark')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${localConfig.theme !== 'light' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t('settings.themeDark')}
                </button>
                <button 
                  onClick={() => updateField('theme', 'light')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${localConfig.theme === 'light' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t('settings.themeLight')}
                </button>
             </div>
           </SettingItem>
           <SettingItem 
            label={t('settings.frequency')} 
            description={t('settings.frequencyDesc')}
           >
             <select 
               value={localConfig.frequency || 'balanced'}
               onChange={e => updateField('frequency', e.target.value)}
               className="bg-secondary/50 border border-white/5 rounded-xl px-4 py-2 text-sm font-bold outline-none cursor-pointer"
             >
                <option value="fast">{t('settings.freqFast')}</option>
                <option value="balanced">{t('settings.freqBalanced')}</option>
                <option value="eco">{t('settings.freqEco')}</option>
             </select>
           </SettingItem>
        </SettingGroup>

        {/* Security Group */}
        <SettingGroup title={t('settings.security')} icon={Shield}>
           <SettingItem 
            label={t('settings.purge')} 
            description={t('settings.purgeDesc')}
           >
             <button className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-destructive hover:text-white transition-all">
               {t('settings.purgeBtn') || "Purge Database"}
             </button>
           </SettingItem>
        </SettingGroup>
      </div>

      <div className="text-center py-10 opacity-20 hover:opacity-100 transition-opacity">
         <div className="text-[10px] font-black uppercase tracking-[0.5em]">LLMux Engine v0.1.0-alpha</div>
      </div>
    </div>
  );
}
