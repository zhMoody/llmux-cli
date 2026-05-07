import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Zap, RotateCcw, Check, AlertCircle, History, ArchiveRestore, Info, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils';
import { KeySelector } from '../KeySelector';
import { ModelRoleSelect } from '../ModelRoleSelect';
import { SettingsPreview } from '../SettingsPreview';
import { CopyButton } from '../../CopyButton';
import { Dialog, ConfirmDialog } from '../../Modal';
import type { ApiKey } from '../../../stores/keys';
import type { ModelAlias } from '../../../stores/models';
import { parseAllowedModels } from '../utils';

interface BackupEntry {
  name: string;
  path: string;
  timestamp: string;
  size: number;
}

interface Props {
  keys: ApiKey[];
  aliases: ModelAlias[];
  gatewayUrl: string;
  currentSettings: Record<string, any> | null;
  settingsExists: boolean;
  settingsLoading: boolean;
  onRefreshSettings: () => void;
  onSettingsApplied: (settings: Record<string, any>) => void;
}

function withLongContext(alias: string, enabled: boolean) {
  return alias && enabled ? `${alias}[1m]` : alias;
}

function isDirty(
  currentSettings: Record<string, any> | null,
  opusModel: string, sonnetModel: string, haikuModel: string,
  opus1m: boolean, sonnet1m: boolean, haiku1m: boolean,
) {
  if (!currentSettings) return false;
  const env = currentSettings.env ?? {};
  if ((env.ANTHROPIC_DEFAULT_OPUS_MODEL   ?? '') !== withLongContext(opusModel, opus1m))   return true;
  if ((env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? '') !== withLongContext(sonnetModel, sonnet1m)) return true;
  if ((env.ANTHROPIC_DEFAULT_HAIKU_MODEL  ?? '') !== withLongContext(haikuModel, haiku1m))  return true;
  return false;
}

function parseModel(val?: string) {
  if (!val) return { alias: '', longContext: false };
  if (val.endsWith('[1m]')) return { alias: val.slice(0, -4), longContext: true };
  return { alias: val, longContext: false };
}

export function ClaudeCodePanel({
  keys,
  aliases,
  gatewayUrl,
  currentSettings,
  settingsExists,
  settingsLoading,
  onRefreshSettings,
  onSettingsApplied,
}: Props) {
  const { t } = useTranslation();
  const [selectedKeyId, setSelectedKeyId] = useState<number | ''>('');
  const initializedFromSettings = useRef(false);
  const restoringRef = useRef(false);

  const [opusModel, setOpusModel]     = useState('');
  const [sonnetModel, setSonnetModel] = useState('');
  const [haikuModel, setHaikuModel]   = useState('');
  const [opus1m, setOpus1m]     = useState(false);
  const [sonnet1m, setSonnet1m] = useState(false);
  const [haiku1m, setHaiku1m]   = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; backupPath?: string; error?: string } | null>(null);
  const [keyReplacedNotice, setKeyReplacedNotice] = useState<string | null>(null);

  // 备份相关
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [expandedBackup, setExpandedBackup] = useState<string | null>(null);
  const [backupContents, setBackupContents] = useState<Record<string, Record<string, any>>>({});
  // 待填入的备份内容，用 effect 消费以确保 closure 是最新的
  const [pendingFillContent, setPendingFillContent] = useState<Record<string, any> | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Modal 状态
  const [dirtyModalOpen, setDirtyModalOpen] = useState(false);
  const [pendingRestoreName, setPendingRestoreName] = useState<string | null>(null);
  const [deleteModalName, setDeleteModalName] = useState<string | null>(null);

  // 初始化：从 currentSettings 回填
  useEffect(() => {
    if (!currentSettings || initializedFromSettings.current || keys.length === 0) return;
    initializedFromSettings.current = true;

    const env = currentSettings.env ?? {};
    const backupApiKey = env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_AUTH_TOKEN ?? '';
    const matchedKey = keys.find(k => k.key === backupApiKey);

    // 设置 key 前先标记，防止 key 切换 effect 把模型清掉
    restoringRef.current = true;
    if (matchedKey) setSelectedKeyId(matchedKey.id);
    else if (selectedKeyId === '') setSelectedKeyId(keys[0].id);

    const opus   = parseModel(env.ANTHROPIC_DEFAULT_OPUS_MODEL);
    const sonnet = parseModel(env.ANTHROPIC_DEFAULT_SONNET_MODEL);
    const haiku  = parseModel(env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
    setOpusModel(opus.alias);     setOpus1m(opus.longContext);
    setSonnetModel(sonnet.alias); setSonnet1m(sonnet.longContext);
    setHaikuModel(haiku.alias);   setHaiku1m(haiku.longContext);
  }, [currentSettings, keys]);

  // key 切换时清空模型（跳过初始化和还原）
  useEffect(() => {
    if (!initializedFromSettings.current) return;
    if (restoringRef.current) { restoringRef.current = false; return; }
    setOpusModel(''); setSonnetModel(''); setHaikuModel('');
    setOpus1m(false); setSonnet1m(false); setHaiku1m(false);
    setApplyResult(null);
    setKeyReplacedNotice(null);
  }, [selectedKeyId]);

  // 首次 keys 加载且没有 settings 时，选第一个
  useEffect(() => {
    if (keys.length > 0 && selectedKeyId === '' && !currentSettings) {
      setSelectedKeyId(keys[0].id);
    }
  }, [keys]);

  const fetchBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch('/api/system/claude-backups');
      setBackups(await res.json());
    } finally {
      setBackupsLoading(false);
    }
  };

  // 挂载时立即拉取备份列表
  useEffect(() => { fetchBackups(); }, []);

  const toggleExpand = async (name: string) => {
    if (expandedBackup === name) { setExpandedBackup(null); return; }
    setExpandedBackup(name);
    if (!backupContents[name]) {
      const res = await fetch(`/api/system/claude-backups?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.settings) setBackupContents(prev => ({ ...prev, [name]: data.settings }));
    }
  };

  const selectedKey = keys.find(k => k.id === selectedKeyId);

  const allowedModelsList = selectedKey
    ? selectedKey.allowed_models === '*'
      ? aliases.map(a => a.alias)
      : parseAllowedModels(selectedKey.allowed_models)
    : [];

  const previewSettings = useMemo(() => {
    if (!selectedKey) return null;
    const existing = currentSettings ?? {};
    const baseEnv = { ...(existing.env ?? {}) };
    delete baseEnv.ANTHROPIC_AUTH_TOKEN;
    const newEnv: Record<string, string> = {
      ...baseEnv,
      ANTHROPIC_BASE_URL: `${gatewayUrl}/v1`,
      ANTHROPIC_API_KEY: selectedKey.key,
    };
    const opusVal   = withLongContext(opusModel, opus1m);
    const sonnetVal = withLongContext(sonnetModel, sonnet1m);
    const haikuVal  = withLongContext(haikuModel, haiku1m);
    if (opusVal)   newEnv.ANTHROPIC_DEFAULT_OPUS_MODEL   = opusVal;
    else           delete newEnv.ANTHROPIC_DEFAULT_OPUS_MODEL;
    if (sonnetVal) newEnv.ANTHROPIC_DEFAULT_SONNET_MODEL = sonnetVal;
    else           delete newEnv.ANTHROPIC_DEFAULT_SONNET_MODEL;
    if (haikuVal)  newEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL  = haikuVal;
    else           delete newEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    return { ...existing, env: newEnv };
  }, [selectedKey, currentSettings, gatewayUrl, opusModel, sonnetModel, haikuModel, opus1m, sonnet1m, haiku1m]);

  const handleApply = async () => {
    if (!selectedKey) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/system/claude-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiBaseUrl: `${gatewayUrl}/v1`,
          apiKey: selectedKey.key,
          opusModel:   withLongContext(opusModel, opus1m)     || undefined,
          sonnetModel: withLongContext(sonnetModel, sonnet1m) || undefined,
          haikuModel:  withLongContext(haikuModel, haiku1m)   || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyResult({ success: true, backupPath: data.backupPath });
        onSettingsApplied(data.settings);
        setKeyReplacedNotice(null);
        fetchBackups();
      } else {
        setApplyResult({ success: false, error: data.error });
      }
    } catch (err: any) {
      setApplyResult({ success: false, error: err.message });
    } finally {
      setApplying(false);
    }
  };

  // 消费 pendingFillContent，确保每次用最新的 keys/setters
  useEffect(() => {
    if (!pendingFillContent || keys.length === 0) return;
    const content = pendingFillContent;
    setPendingFillContent(null);
    setIsRestoring(false);

    const env = content.env ?? {};
    const backupApiKey = env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_AUTH_TOKEN ?? '';
    const matchedKey = keys.find(k => k.key === backupApiKey);
    restoringRef.current = true;
    let notice: string | null = null;
    if (matchedKey) {
      setSelectedKeyId(matchedKey.id);
    } else {
      const fallback = keys.find(k => k.id === selectedKeyId) ?? keys[0];
      if (fallback) {
        setSelectedKeyId(fallback.id);
        notice = `备份中的 API Key (${backupApiKey.slice(0, 12)}••••) 不在当前密钥列表，已自动替换为「${fallback.name}」。`;
      }
    }
    const opus   = parseModel(env.ANTHROPIC_DEFAULT_OPUS_MODEL);
    const sonnet = parseModel(env.ANTHROPIC_DEFAULT_SONNET_MODEL);
    const haiku  = parseModel(env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
    setOpusModel(opus.alias);     setOpus1m(opus.longContext);
    setSonnetModel(sonnet.alias); setSonnet1m(sonnet.longContext);
    setHaikuModel(haiku.alias);   setHaiku1m(haiku.longContext);
    setKeyReplacedNotice(notice);
    setApplyResult(null);
  }, [pendingFillContent, keys]);

  const loadBackupIntoForm = (content: Record<string, any>) => {
    setPendingFillContent(content);
  };

  const handleRestoreClick = async (name: string) => {
    if (isRestoring) return;
    setIsRestoring(true);
    // 确保内容已加载，直接拿到再用，不依赖 state
    let content = backupContents[name];
    if (!content) {
      const res = await fetch(`/api/system/claude-backups?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!data.settings) { setIsRestoring(false); return; }
      content = data.settings;
      setBackupContents(prev => ({ ...prev, [name]: content }));
    }
    const dirty = isDirty(currentSettings, opusModel, sonnetModel, haikuModel, opus1m, sonnet1m, haiku1m);
    if (dirty) {
      setPendingRestoreName(name);
      setDirtyModalOpen(true);
      setIsRestoring(false); // 弹 Modal 期间解锁，让用户可以取消
    } else {
      loadBackupIntoForm(content);
    }
  };

  const handleDeleteClick = (name: string) => {
    setDeleteModalName(name);
  };

  const confirmDelete = async () => {
    if (!deleteModalName) return;
    await fetch('/api/system/claude-backups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: deleteModalName }),
    });
    setDeleteModalName(null);
    if (expandedBackup === deleteModalName) setExpandedBackup(null);
    fetchBackups();
  };

  return (
    <div className="space-y-5">
      {/* key 被替换通知 */}
      {keyReplacedNotice && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-600 dark:text-blue-400">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1">{keyReplacedNotice}</span>
          <button onClick={() => setKeyReplacedNotice(null)} className="shrink-0 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 左列 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('setup.step1')}</div>
            <KeySelector keys={keys} selectedKeyId={selectedKeyId} onSelect={setSelectedKeyId} />
          </div>

          {allowedModelsList.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('setup.modelRoles')}</div>
              <ModelRoleSelect label="Opus"   envKey="ANTHROPIC_DEFAULT_OPUS_MODEL"   models={allowedModelsList} value={opusModel}   longContext={opus1m}   onChange={setOpusModel}   onLongContextChange={setOpus1m} />
              <ModelRoleSelect label="Sonnet" envKey="ANTHROPIC_DEFAULT_SONNET_MODEL" models={allowedModelsList} value={sonnetModel} longContext={sonnet1m} onChange={setSonnetModel} onLongContextChange={setSonnet1m} />
              <ModelRoleSelect label="Haiku"  envKey="ANTHROPIC_DEFAULT_HAIKU_MODEL"  models={allowedModelsList} value={haikuModel}  longContext={haiku1m}  onChange={setHaikuModel}  onLongContextChange={setHaiku1m} />
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t('setup.modelRolesHint')}</p>
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={!selectedKey || applying}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
              selectedKey && !applying ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {applying
              ? <><RotateCcw size={14} className="animate-spin" />{t('setup.applying')}</>
              : <><Zap size={14} />{settingsExists ? t('setup.applyBtn') : t('setup.initBtn')}</>
            }
          </button>

          {applyResult && (
            <div className={cn('p-3 rounded-xl text-xs space-y-1', applyResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-500')}>
              {applyResult.success ? (
                <>
                  <div className="flex items-center gap-1.5 font-bold"><Check size={12} />{t('setup.applySuccess')}</div>
                  {applyResult.backupPath && <div className="text-muted-foreground font-mono break-all text-[10px]">{t('setup.backupAt')}{applyResult.backupPath}</div>}
                </>
              ) : (
                <div className="flex items-center gap-1.5"><AlertCircle size={12} />{applyResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* 右列 */}
        <div className="space-y-3">
          <SettingsPreview settings={currentSettings} preview={previewSettings} exists={settingsExists} loading={settingsLoading} onRefresh={onRefreshSettings} />
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card text-xs text-muted-foreground">
            <Globe size={13} className="shrink-0 text-primary" />
            <span>{t('setup.gatewayUrl')} <span className="font-mono text-foreground">{gatewayUrl}/v1</span></span>
            <CopyButton value={`${gatewayUrl}/v1`} size={12} className="ml-auto" />
          </div>
        </div>
      </div>

      {/* 备份历史 */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
          <History size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs font-bold flex-1">{t('setup.backupHistory')}</span>
          {backupsLoading && <RotateCcw size={11} className="animate-spin text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground">{t('setup.backupMax')}</span>
        </div>

        <div className="max-h-[480px] overflow-y-auto divide-y divide-border">
          {backups.length === 0 ? (
            <div className="px-4 py-4 text-xs text-muted-foreground">{t('setup.noBackups')}</div>
          ) : (
            backups.map(b => {
              const isExpanded = expandedBackup === b.name;
              const content = backupContents[b.name];
              return (
                <div key={b.name}>
                  {/* 条目头 */}
                  <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <button
                      onClick={() => toggleExpand(b.name)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      {isExpanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-foreground/80">{b.timestamp}</div>
                        <div className="text-[10px] text-muted-foreground">{(b.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRestoreClick(b.name)}
                      disabled={isRestoring}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-semibold transition-colors shrink-0',
                        isRestoring ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50'
                      )}
                    >
                      {isRestoring && pendingRestoreName === b.name
                        ? <RotateCcw size={11} className="animate-spin" />
                        : <ArchiveRestore size={11} />
                      }
                      {t('setup.restore')}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(b.name)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                      title={t('setup.deleteBackup')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 展开内容：完整 JSON */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/10">
                      {!content ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">{t('setup.loading')}</div>
                      ) : (
                        <div className="relative">
                          <div className="absolute top-2 right-2 z-10">
                            <CopyButton value={JSON.stringify(content, null, 2)} size={12} />
                          </div>
                          <pre className="px-4 py-3 text-[11px] font-mono text-foreground/80 whitespace-pre overflow-x-auto">
                            {JSON.stringify(content, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 脏数据确认 Modal */}
      <ConfirmDialog
        isOpen={dirtyModalOpen}
        onClose={() => { setDirtyModalOpen(false); setPendingRestoreName(null); }}
        onConfirm={() => {
          setDirtyModalOpen(false);
          if (pendingRestoreName && backupContents[pendingRestoreName]) {
            loadBackupIntoForm(backupContents[pendingRestoreName]);
          }
          setPendingRestoreName(null);
        }}
        title={t('setup.dirtyConfirmTitle')}
        description={t('setup.dirtyConfirm')}
        confirmText={t('setup.discardAndRestore')}
        variant="warning"
      />

      {/* 删除确认 Modal */}
      <ConfirmDialog
        isOpen={!!deleteModalName}
        onClose={() => setDeleteModalName(null)}
        onConfirm={confirmDelete}
        title={t('setup.deleteBackupTitle')}
        description={t('setup.deleteBackupConfirm', { name: deleteModalName?.replace('settings.json.', '') ?? '' })}
        confirmText={t('setup.delete')}
        variant="danger"
      />
    </div>
  );
}
