import { Cpu } from 'lucide-react';
import { TFunction } from 'i18next';
import { parseServerDate } from '../../utils/date';

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

export interface ModelHealth {
  model: string;
  account_name: string;
  provider_id: string;
  success: number;
  latency: number;
  last_checked: number;
}

interface ActiveModelsCardProps {
  models: ModelHealth[];
  t: TFunction;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return parseServerDate(ts).toLocaleDateString();
}

export const ActiveModelsCard = ({ models, t }: ActiveModelsCardProps) => {
  return (
    <div className="premium-card bg-gradient-to-br from-card to-primary/[0.02] flex flex-col">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">
        <Cpu size={14} className="text-primary" />
        {t('dashboard.activeModels')}
      </div>
      {models.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/50 text-center py-4">
          {t('dashboard.noActiveModels')}
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[260px] no-scrollbar">
          {models.map((m, i) => (
            <div
              key={`${m.account_name}-${m.model}-${i}`}
              className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50 group hover:border-primary/20 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 mt-0.5",
                  m.success === 1
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                )} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate leading-tight">{m.model}</div>
                  <div className="text-[9px] text-muted-foreground/60 truncate mt-0.5">
                    {m.account_name || m.provider_id}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-[10px] font-mono text-muted-foreground">
                  {m.latency != null ? `${(m.latency / 1000).toFixed(2)}s` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground/50 mt-0.5">
                  {formatRelativeTime(m.last_checked)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
