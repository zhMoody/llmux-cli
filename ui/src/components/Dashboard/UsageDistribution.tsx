import React from 'react';
import { BarChart as BarIcon } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// 注册
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface UsageDistributionProps {
  data: any[];
  colors: string[];
  t: (key: string) => string;
}

export const UsageDistribution = ({ data, colors, t }: UsageDistributionProps) => {
  const chartData: ChartData<'bar'> = {
    labels: data.map(d => d.name),
    datasets: [
      {
        label: t('dashboard.stats.requests'),
        data: data.map(d => d.requests),
        backgroundColor: data.map((_, i) => `${colors[i % colors.length]}cc`),
        hoverBackgroundColor: data.map((_, i) => colors[i % colors.length]),
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 24,
      }
    ]
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#09090b',
        titleColor: '#94a3b8',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        titleFont: { size: 10, weight: 'bold' },
        bodyFont: { size: 12, weight: 'bold' },
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 10, weight: 600 },
          color: '#94a3b8'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(128, 128, 128, 0.1)',
        },
        ticks: {
          font: { size: 10, weight: 700 },
          color: '#94a3b8',
        }
      }
    }
  };

  return (
    <div className="premium-card flex flex-col">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-8">
        <BarIcon size={14} className="text-primary" />
        {t('dashboard.charts.accountRequests')}
      </div>
      <div className="h-[210px] w-full">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};
