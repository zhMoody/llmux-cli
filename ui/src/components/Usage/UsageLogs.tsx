import React from 'react';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

interface UsageLogsProps {
  t: (key: string, options?: any) => string;
  logs: any[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export const UsageLogs = ({ t, logs, page, setPage }: UsageLogsProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-xs font-black uppercase text-muted-foreground/70 border-b border-border/20">
            <th className="pb-4 px-4">{t('usage.time')}</th>
            <th className="pb-4 px-4">{t('common.models')}</th>
            <th className="pb-4 px-4">{t('usage.account')}</th>
            <th className="pb-4 text-right px-4">{t('usage.latency')}</th>
            <th className="pb-4 text-right px-4">{t('usage.status')}</th>
          </tr>
        </thead>
        <tbody className="space-y-4">
          {logs.map((log) => (
            <tr key={log.id} className="group bg-muted/5 hover:bg-primary/[0.03] transition-all duration-300">
              <td className="py-4 px-4 rounded-l-2xl text-xs font-bold text-muted-foreground tabular-nums">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="py-4 px-4 text-xs font-black group-hover:text-primary transition-colors">{log.model}</td>
              <td className="py-4 px-4">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                   <span className="text-[11px] font-bold uppercase tracking-tight">{log.account_name || 'System'}</span>
                 </div>
              </td>
              <td className="py-4 text-right px-4 tabular-nums text-xs font-bold text-muted-foreground">
                {log.latency_ms}ms
              </td>
              <td className="py-4 text-right px-4 rounded-r-2xl">
                 <div className={cn(
                   "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black tracking-tighter uppercase",
                   log.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                 )}>
                   {log.success ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                   {log.success ? t('usage.success') : t('usage.failed')}
                 </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination for Logs */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
          <div className="text-xs font-black text-muted-foreground/80 uppercase tracking-widest">{t('usage.page', { page: page + 1 })}</div>
          <div className="flex gap-2">
            <button 
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="p-2 bg-muted/40 hover:bg-muted border border-border/40 rounded-lg disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16}/>
            </button>
            <button 
              disabled={logs.length < 50}
              onClick={() => setPage(p => p + 1)}
              className="p-2 bg-muted/40 hover:bg-muted border border-border/40 rounded-lg disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
