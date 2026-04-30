import React from 'react';

interface UsageTableProps {
  t: (key: string, options?: any) => string;
  data: any[];
  formatTokens: (n: number) => string;
}

export const UsageTable = ({ t, data, formatTokens }: UsageTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-xs font-black uppercase text-muted-foreground/70 border-b border-border/20">
            <th className="pb-4 px-4">{t('common.models')}</th>
            <th className="pb-4 text-right px-4">{t('usage.usageIo')}</th>
            <th className="pb-4 text-right px-4">{t('usage.performance')}</th>
          </tr>
        </thead>
        <tbody className="space-y-4">
          {data?.map((item) => (
            <tr key={item.model} className="group bg-muted/5 hover:bg-primary/[0.03] transition-all duration-300">
              <td className="py-4 px-4 rounded-l-2xl border-l border-t border-b border-transparent group-hover:border-primary/10">
                <div className="flex flex-col">
                  <span className="text-sm font-bold group-hover:text-primary transition-colors">{item.model}</span>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-tighter opacity-80">{t('usage.provisioned')}</span>
                </div>
              </td>
              <td className="py-4 text-right px-4 tabular-nums">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-foreground">{formatTokens(item.input + item.output)}</span>
                  <span className="text-xs text-muted-foreground/70 font-mono tracking-tighter">{formatTokens(item.input)}i / {formatTokens(item.output)}o</span>
                </div>
              </td>
              <td className="py-4 text-right px-4 rounded-r-2xl border-r border-t border-b border-transparent group-hover:border-primary/10">
                 <div className="flex flex-col items-end gap-1">
                    <div className="text-xs font-bold tabular-nums">{(item.avgLatency / 1000).toFixed(1)}s</div>
                    <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                       <div className="h-full bg-primary/40 rounded-full" style={{ width: `${(item.successCount / (item.requests || 1) * 100)}%` }} />
                    </div>
                 </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
