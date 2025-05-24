import { LLMSettings } from '@/lib/llm-providers/types';

const DEFAULT_SETTINGS: LLMSettings = {
  activeProvider: 'openai',
  providers: {
    openai: {
      type: 'openai',
      apiKey: '',
      model: 'gpt-4-turbo-preview',
      enabled: false,
    },
    gemini: {
      type: 'gemini',
      apiKey: '',
      model: 'gemini-1.5-pro',
      enabled: false,
    },
    ollama: {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:3b',
      enabled: false,
    },
  },
};

export async function getSettings(user: string): Promise<LLMSettings> {
  try {
    const res = await fetch(`/api/settings?user=${encodeURICompouser)}`, { cach 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    if (!data) return DEFAULT_SETTING
    return data;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(user: string, settings: LLMSettings): Promise<void> {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, settings }),
  });
}

export function updateProviderConfig(): LLMSettings {
  throw new Error('updateProviderConfig should not be used for persistent storage');
}

export function setActiveProvider(): LLMSettings {
  throw new Error('setActiveProvider should not be used for persistent storage');
} 
