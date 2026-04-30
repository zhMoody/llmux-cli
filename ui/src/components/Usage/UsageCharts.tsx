import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  SubTitle,
  ChartData,
  BarController,
  DoughnutController
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  SubTitle,
  BarController,
  DoughnutController
);

interface UsageChartsProps {
  t: (key: string, options?: any) => string;
  doughnutData: ChartData<'doughnut'>;
  barData: ChartData<'bar'>;
  activeAccountsCount: number;
}

export const UsageCharts = ({ t, doughnutData, barData, activeAccountsCount }: UsageChartsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Account Distribution Doughnut */}
      <div className="premium-card lg:col-span-1 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-full h-[200px]">
          <Doughnut 
            data={doughnutData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              cutout: '75%'
            }} 
          />
        </div>
        <div className="mt-6 text-center">
          <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('usage.realTimePricing')}</div>
          <div className="text-lg font-black">{t('usage.activeAccounts', { count: activeAccountsCount })}</div>
        </div>
      </div>

      {/* Model Efficiency Bar Chart */}
      <div className="premium-card lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('usage.efficiency')}</div>
          <div className="text-xs font-bold px-2 py-1 bg-muted rounded-lg text-muted-foreground uppercase">{t('usage.performance')}</div>
        </div>
        <div className="h-[200px]">
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${((ctx.parsed.y ?? 0) / 1000).toFixed(1)}s`
                  }
                }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, callback: (v) => `${(Number(v) / 1000).toFixed(1)}s` } }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
