import React, { useRef, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// 注册 Chart.js 核心组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface UsageTrendChartProps {
  data: any[];
  modelNames: string[];
  colors: string[];
  t: (key: string) => string;
}

export const UsageTrendChart = ({ data, modelNames, colors, t }: UsageTrendChartProps) => {
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    datasets: [],
  });

  useEffect(() => {
    if (!data.length || !modelNames.length) return;

    const chart = chartRef.current;
    if (!chart) return;

    // 创建数据集
    const datasets = modelNames.map((model, i) => {
      const color = colors[i % colors.length];
      
      return {
        label: model,
        data: data.map(d => d[model] || 0),
        borderColor: color,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, `${color}44`); // 降低透明度更通透
          gradient.addColorStop(1, `${color}00`); 
          return gradient;
        },
        fill: true,
        tension: 0.45, // 略微增加张力
        cubicInterpolationMode: 'monotone' as const, // 使用单调立方插值，解决数学锯齿
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 3,
        hoverBorderWidth: 4,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
        // 添加细微阴影，提升高级感并辅助抗锯齿
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowBlur: 10,
        shadowOffsetY: 5,
      };
    });

    setChartData({
      labels: data.map(d => d.name),
      datasets: datasets
    });
  }, [data, modelNames, colors]);

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 2, // 强制高清渲染
    spanGaps: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: 'rgba(0, 0, 0, 0.1)', // 增强边框可见度
        borderWidth: 1,
        padding: 12,
        boxPadding: 8,
        usePointStyle: true,
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 12, weight: 600 },
        cornerRadius: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            return ` ${context.dataset.label}: ${(context.parsed.y || 0).toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          font: { size: 10, weight: 600 },
          color: '#94a3b8'
        }
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: {
          color: 'rgba(0, 0, 0, 0.04)',
        },
        ticks: {
          font: { size: 10, weight: 600 },
          color: '#94a3b8',
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
            return value;
          }
        }
      }
    }
  };

  return (
    <div className="premium-card flex flex-col bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <Zap size={14} className="text-primary" />
            {t('dashboard.charts.modelTokens')}
          </div>
          <div className="text-[10px] text-muted-foreground/60">{t('dashboard.charts.realTimeTrend')}</div>
        </div>
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {modelNames.map((m, i) => (
            <div key={m} className="flex items-center gap-1.5 grayscale-[0.5] shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px]">{m}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="h-[340px] w-full relative">
        {data.length > 0 ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl bg-muted/5">
            <div className="p-4 rounded-full bg-muted/10 mb-4">
              <Zap size={32} className="text-muted-foreground/20" />
            </div>
            <p className="text-sm font-bold text-muted-foreground/40">{t('dashboard.noDataTrend')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
