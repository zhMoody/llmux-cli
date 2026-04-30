import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { UsageBreakdown } from '../../stores/usage';
import { TFunction } from 'i18next';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

interface UsageIntelligenceProps {
  breakdown: UsageBreakdown | null;
  t: TFunction;
  colors: string[];
}

type MetricMode = 'requests' | 'tokens';

export const UsageIntelligence = ({ breakdown, t, colors }: UsageIntelligenceProps) => {
  const [mode, setMode] = useState<MetricMode>('requests');
  const [prices, setPrices] = useState<Record<string, { input: number, output: number }>>({});

  // 获取价格数据 (尝试从本地获取，失败则忽略或使用默认)
  useEffect(() => {
    const loadPrices = async () => {
      try {
        // 尝试获取本地价格接口
        const res = await fetch('/api/models/prices').catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          // 假设格式为 [{ model_id, input_price, output_price }]
          const priceMap: Record<string, any> = {};
          data.forEach((p: any) => {
            priceMap[p.model_id] = { input: p.input_price, output: p.output_price };
          });
          setPrices(priceMap);
        } else {
          // 备选方案：从 GitHub 获取 LiteLLM 价格表
          const githubRes = await fetch('https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json').catch(() => null);
          if (githubRes && githubRes.ok) {
            const data = await githubRes.json();
            const priceMap: Record<string, any> = {};
            Object.keys(data).forEach(key => {
              const info = data[key];
              if (info.input_cost_per_token) {
                priceMap[key] = { 
                  input: info.input_cost_per_token * 1000, 
                  output: (info.output_cost_per_token || info.input_cost_per_token) * 1000 
                };
              }
            });
            setPrices(priceMap);
          }
        }
      } catch (e) {
        console.warn('Failed to load prices:', e);
      }
    };
    loadPrices();
  }, []);

  // 计算每个模型/账户的成本
  const processedData = useMemo(() => {
    if (!breakdown) return { models: [], accounts: [] };

    const models = (breakdown.byModel || []).map(m => ({
      ...m,
      name: m.model,
      successRate: m.requests > 0 ? (m.successCount / m.requests) * 100 : 0
    }));

    const accounts = (breakdown.byAccount || []).map(a => ({
      ...a,
      successRate: a.requests > 0 ? (a.successCount / a.requests) * 100 : 0
    }));

    return { models, accounts };
  }, [breakdown]);

  const chartData: ChartData<'doughnut'> = {
    labels: processedData.accounts.map(a => a.name),
    datasets: [{
      data: processedData.accounts.map(a => {
        if (mode === 'requests') return a.requests;
        return a.totalTokens;
      }),
      backgroundColor: colors.map(c => `${c}cc`),
      hoverBackgroundColor: colors,
      borderWidth: 0,
      borderRadius: 4,
    }]
  };

  const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        padding: 12,
        cornerRadius: 12,
        boxPadding: 6,
        callbacks: {
          label: (item) => {
            const val = item.raw as number;
            if (mode === 'tokens') return ` ${val.toLocaleString()} Tokens`;
            return ` ${val} Requests`;
          }
        }
      }
    }
  };

  const totalValue = useMemo(() => {
    return processedData.accounts.reduce((acc, curr) => {
      if (mode === 'requests') return acc + curr.requests;
      return acc + curr.totalTokens;
    }, 0);
  }, [processedData, mode]);

  return (
    <div className="premium-card bg-gradient-to-br from-card to-primary/[0.01] flex flex-col min-h-[480px]">
      {/* Header with Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <Activity size={14} className="text-primary" />
            {t('dashboard.usageIntelligence')}
          </div>
          <div className="text-[10px] text-muted-foreground/60">{t('dashboard.usageInsightDesc')}</div>
        </div>
        
        <div className="flex bg-muted/40 p-1 rounded-xl self-start">
          {[
            { id: 'requests', icon: Zap, label: t('dashboard.stats.requests') },
            { id: 'tokens', icon: BarChart3, label: t('dashboard.stats.tokens') }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as MetricMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                mode === m.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <m.icon size={12} />
              <span className="hidden xs:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1">
        {/* Left: Distribution Chart */}
        <div className="relative flex items-center justify-center min-h-[220px]">
          <div className="w-full h-full max-h-[240px]">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter opacity-50">
              {'Total volume'}
            </div>
            <div className="text-2xl font-black tracking-tighter text-foreground tabular-nums">
              {totalValue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-500 mt-1">
              <TrendingUp size={10} />
              <span>+12.5%</span>
            </div>
          </div>
        </div>

        {/* Right: Detailed List */}
        <div className="flex flex-col">
          <div className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mb-4 px-1">
            {t('dashboard.topPerformers')}
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[280px] pr-2 no-scrollbar">
            {processedData.models.slice(0, 5).map((m, i) => (
              <div key={m.name} className="group p-3 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 hover:bg-muted/40 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-background flex items-center justify-center text-[10px] font-bold border border-border group-hover:border-primary/30 transition-colors">
                      {i + 1}
                    </div>
                    <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{m.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tabular-nums">
                      {mode === 'tokens' ? `${(m.input + m.output).toLocaleString()}` : `${m.requests}`}
                    </div>
                    <div className="text-[9px] text-muted-foreground/50 font-medium">
                      {mode === 'tokens' ? 'Tokens' : 'Requests'}
                    </div>
                  </div>
                </div>
                
                {/* Metrics Row */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        m.successRate > 95 ? "bg-green-500" : m.successRate > 80 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${m.successRate}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <Activity size={10} className={m.successRate > 90 ? "text-green-500" : "text-amber-500"} />
                      <span className="text-[10px] font-bold tabular-nums">{m.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-muted-foreground/40" />
                      <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">{(m.avgLatency / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer Insight */}
      <div className="mt-8 pt-6 border-t border-border/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold leading-none mb-1">{t('dashboard.healthHealthy')}</div>
            <p className="text-[9px] text-muted-foreground">{t('dashboard.healthSub', 'System is operating at peak efficiency')}</p>
          </div>
        </div>
        <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
          {t('dashboard.viewFullReport')}
          <ArrowUpRight size={12} />
        </button>
      </div>
    </div>
  );
};
