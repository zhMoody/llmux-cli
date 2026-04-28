import { create } from 'zustand';

interface UsageSummary {
  totalInput: number;
  totalOutput: number;
  avgLatency: number;
  totalRequests: number;
  successRequests: number;
}

interface UsageLog {
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

interface UsageBreakdown {
  byModel: any[];
  byProvider: any[];
  byAccount: any[];
}

interface UsageState {
  summary: UsageSummary | null;
  recentLogs: UsageLog[];
  breakdown: UsageBreakdown | null;
  isLoading: boolean;
  fetchSummary: () => Promise<void>;
  fetchDetails: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  recentLogs: [],
  breakdown: null,
  isLoading: false,

  fetchSummary: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/usage/summary');
      const data = await res.json();
      set({ summary: data.summary, recentLogs: data.recent });
    } catch (err) {
      console.error('Failed to fetch usage summary:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDetails: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/usage/details');
      const data = await res.json();
      set({ breakdown: data });
    } catch (err) {
      console.error('Failed to fetch usage details:', err);
    } finally {
      set({ isLoading: false });
    }
  }
}));
