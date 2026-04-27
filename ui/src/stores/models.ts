import { create } from 'zustand';

export interface AvailableModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelAlias {
  id: number;
  alias: string;
  target_model: string;
  provider_id: string | null;
}

interface ModelsState {
  availableModels: AvailableModel[];
  aliases: ModelAlias[];
  isLoading: boolean;
  error: string | null;
  fetchModels: () => Promise<void>;
  fetchAliases: () => Promise<void>;
  addAlias: (alias: string, targetModel: string, providerId?: string) => Promise<void>;
  deleteAlias: (id: number) => Promise<void>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  availableModels: [],
  aliases: [],
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/models/available');
      if (!res.ok) throw new Error('Failed to fetch available models');
      const data = await res.json();
      set({ availableModels: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchAliases: async () => {
    set({ error: null });
    try {
      const res = await fetch('/api/models/aliases');
      if (!res.ok) throw new Error('Failed to fetch aliases');
      const data = await res.json();
      set({ aliases: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addAlias: async (alias, targetModel, providerId) => {
    try {
      const res = await fetch('/api/models/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, target_model: targetModel, provider_id: providerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add alias');
      }
      await get().fetchAliases();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteAlias: async (id) => {
    try {
      const res = await fetch(`/api/models/aliases/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alias');
      await get().fetchAliases();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));
