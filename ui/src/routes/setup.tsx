import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Terminal,
  Key,
  ChevronRight,
  AlertCircle,
  Check,
  Box,
  Globe,
} from 'lucide-react';
import { useKeysStore } from '../stores/keys';
import { useModelsStore } from '../stores/models';
import { CopyButton } from '../components/CopyButton';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function parseAllowedModels(raw: string): string[] {
  if (!raw || raw === '*') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ToolDef {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  lang: string;
  generate: (url: string, key: string, models: string[]) => string;
}

const TOOLS: ToolDef[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic 官方 CLI',
    icon: Terminal,
    lang: 'bash',
    generate: (url, key, models) => {
      const base = `claude config set apiBaseUrl ${url}/v1\nclaude config set apiKey ${key}`;
      if (models.length === 0) return base;
      const modelList = models.map(m => `  - ${m}`).join('\n');
      return `${base}\n\n# 可用模型（使用 ccswitch 或 --model 切换）：\n${modelList}\n\n# 设置默认模型\nclaude config set model ${models[0]}`;
    },
  },
];

export default function Setup() {
  const { t } = useTranslation();
  const { keys, fetchKeys } = useKeysStore();
  const { aliases, fetchAliases } = useModelsStore();
  const [selectedTool, setSelectedTool] = useState<string>('claude-code');
  const [selectedKeyId, setSelectedKeyId] = useState<number | ''>('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    fetchKeys();
    fetchAliases();
  }, []);

  useEffect(() => {
    if (keys.length > 0 && selectedKeyId === '') {
      setSelectedKeyId(keys[0].id);
    }
  }, [keys]);

  useEffect(() => {
    setSelectedModels([]);
  }, [selectedKeyId]);

  const gatewayUrl = window.location.origin;
  const selectedKey = keys.find(k => k.id === selectedKeyId);
  const tool = TOOLS.find(t => t.id === selectedTool)!;

  const allowedModelsList = selectedKey
    ? selectedKey.allowed_models === '*'
      ? aliases.map(a => a.alias)
      : parseAllowedModels(selectedKey.allowed_models)
    : [];

  const configText = selectedKey
    ? tool.generate(gatewayUrl, selectedKey.key, selectedModels)
    : tool.generate(gatewayUrl, '<YOUR_API_KEY>', []);

  const toggleModel = (model: string) => {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  return (
    <div className="flex gap-0 h-full min-h-[calc(100vh-8rem)] animate-in fade-in duration-500">

      {/* Left sidebar: tool list */}
      <div className="w-52 shrink-0 border-r border-border pr-4 space-y-1 pt-1">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 pb-2">
          {t('setup.tools')}
        </div>
        {TOOLS.map(t => {
          const Icon = t.icon;
          const active = selectedTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTool(t.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon size={15} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{t.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
              </div>
              {active && <ChevronRight size={12} className="ml-auto shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Right: config panel */}
      <div className="flex-1 pl-6 space-y-6 min-w-0">
        {/* Tool header */}
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <tool.icon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold">{tool.label}</h2>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left of panel: Key + Model selectors */}
          <div className="xl:col-span-2 space-y-5">

            {/* Select Key */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {t('setup.step1')}
              </div>
              {keys.length === 0 ? (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>
                    {t('setup.noKeys')}{' '}
                    <Link to="/keys" className="text-primary underline underline-offset-2 font-medium">
                      {t('setup.createKey')}
                    </Link>
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {keys.map(k => (
                    <button
                      key={k.id}
                      onClick={() => setSelectedKeyId(k.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                        selectedKeyId === k.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-muted/50'
                      )}
                    >
                      <Key size={13} className={selectedKeyId === k.id ? 'text-primary' : 'text-muted-foreground'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{k.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {k.key.slice(0, 12)}••••••••
                        </div>
                      </div>
                      {selectedKeyId === k.id && <ChevronRight size={12} className="text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Select Models */}
            {selectedKey && allowedModelsList.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {t('setup.step2Models')}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 p-2.5 rounded-xl border border-border bg-card">
                  {allowedModelsList.map(model => {
                    const isSelected = selectedModels.includes(model);
                    return (
                      <button
                        key={model}
                        onClick={() => toggleModel(model)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
                        )}
                      >
                        <div className={cn(
                          'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <Check size={9} className="text-primary-foreground" />}
                        </div>
                        <Box size={11} className="shrink-0" />
                        <span className="truncate">{model}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t('setup.selectedCount', { count: selectedModels.length })}
                </div>
              </div>
            )}
          </div>

          {/* Right of panel: config preview */}
          <div className="xl:col-span-3 space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t('setup.step3')}
            </div>

            <div className="rounded-xl border border-border bg-[#0d0d0d] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono ml-1">{tool.lang}</span>
                </div>
                <CopyButton value={configText} size={14} title={t('setup.copy')} />
              </div>
              <pre className="p-5 text-[12px] leading-relaxed overflow-x-auto text-green-300 font-mono whitespace-pre">
                <code>{configText}</code>
              </pre>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card text-xs text-muted-foreground">
              <Globe size={13} className="shrink-0 text-primary" />
              <span>
                {t('setup.gatewayUrl')}{' '}
                <span className="font-mono text-foreground">{gatewayUrl}/v1</span>
              </span>
              <CopyButton value={`${gatewayUrl}/v1`} size={13} className="ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
