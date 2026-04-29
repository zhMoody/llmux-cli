import { create } from 'zustand';

export interface UsageSummary {
  totalInput: number;
  totalOutput: number;
  avgLatency: number;
  totalRequests: number;
  successRequests: number;
}

export interface UsageLog {
  id: number;
  timestamp: string;
  account_id: number;
  provider_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: number;
  error_message: string | null;
}

export interface UsageBreakdown {
  byModel: {
    model: string;
    input: number;
    output: number;
    requests: number;
    successCount: number;
    avgLatency: number;
  }[];
  byProvider: {
    id: string;
    totalTokens: number;
    requests: number;
    successCount: number;
    avgLatency: number;
  }[];
  byAccount: {
    id: number;
    name: string;
    provider: string;
    totalTokens: number;
    requests: number;
    successCount: number;
    avgLatency: number;
  }[];
}

export interface UsageState {
  summary: UsageSummary | null;
  breakdown: UsageBreakdown | null;
  logs: any[];
  recentLogs: any[];
  isLoading: boolean;
  fetchSummary: (start?: string, end?: string) => Promise<void>;
  fetchDetails: (start?: string, end?: string) => Promise<void>;
  fetchLogs: (params: { start?: string, end?: string, model?: string, provider?: string, success?: number, limit?: number, offset?: number }) => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  breakdown: null,
  logs: [],
  recentLogs: [],
  isLoading: false,

  fetchSummary: async (start, end) => {
    set({ isLoading: true });
    try {
      const url = new URL('/api/usage/summary', window.location.origin);
      // 增加 5 分钟容错余量，防止因为时钟漂移导致边缘数据丢失
      if (start) {
        const bufferedStart = new Date(new Date(start.replace(' ', 'T') + 'Z').getTime() - 300000);
        url.searchParams.set('start', bufferedStart.toISOString().replace('T', ' ').split('.')[0]);
      }
      if (end) url.searchParams.set('end', end);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      set({ 
        summary: data.summary,
        recentLogs: data.recent || []
      });
    } catch (error) {
      console.error('Failed to fetch usage summary:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDetails: async (start, end) => {
    // 详情请求也使用 5 分钟容错
    try {
      const url = new URL('/api/usage/details', window.location.origin);
      if (start) {
        const bufferedStart = new Date(new Date(start.replace(' ', 'T') + 'Z').getTime() - 300000);
        url.searchParams.set('start', bufferedStart.toISOString().replace('T', ' ').split('.')[0]);
      }
      if (end) url.searchParams.set('end', end);

      const res = await fetch(url.toString());
      const data = await res.json();
      set({ breakdown: data });
    } catch (error) {
      console.error('Failed to fetch usage details:', error);
    }
  },

  fetchLogs: async (params) => {
    set({ isLoading: true });
    try {
      const url = new URL('/api/usage/logs', window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value));
      });

      const res = await fetch(url.toString());
      const data = await res.json();
      set({ logs: data });
    } catch (error) {
      console.error('Failed to fetch usage logs:', error);
    } finally {
      set({ isLoading: false });
    }
  }
}));
