import { create } from 'zustand';

export interface UsageSummary {
  totalInput: number;
  totalOutput: number;
  avgLatency: number;
  totalRequests: number;
  successRequests: number;
}

export interface FailoverStats {
  failoverTriggers: number;
  recoveredRequests: number;
  failoverSuccessRate: number;
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
  failoverStats: FailoverStats | null;
  breakdown: UsageBreakdown | null;
  logs: any[];
  recentLogs: any[];
  isLoading: boolean;
  fetchSummary: (start?: number, end?: number) => Promise<void>;
  fetchDetails: (start?: number, end?: number) => Promise<void>;
  fetchLogs: (params: { start?: number, end?: number, model?: string, provider?: string, success?: number, limit?: number, offset?: number }) => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  failoverStats: null,
  breakdown: null,
  logs: [],
  recentLogs: [],
  isLoading: false,

  fetchSummary: async (start?: number, end?: number) => {
    set({ isLoading: true });
    try {
      const url = new URL('/api/usage/summary', window.location.origin);
      if (start) url.searchParams.set('start', String(start));
      if (end) url.searchParams.set('end', String(end));

      const res = await fetch(url.toString());
      const data = await res.json();
      set({
        summary: data.summary,
        failoverStats: data.failoverStats || { failoverTriggers: 0, recoveredRequests: 0, failoverSuccessRate: 0 },
        recentLogs: data.recent || []
      });
    } catch (error) {
      console.error('Failed to fetch usage summary:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDetails: async (start?: number, end?: number) => {
    try {
      const url = new URL('/api/usage/details', window.location.origin);
      if (start) url.searchParams.set('start', String(start));
      if (end) url.searchParams.set('end', String(end));

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
