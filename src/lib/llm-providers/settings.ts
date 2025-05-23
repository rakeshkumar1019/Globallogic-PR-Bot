import { LLMProviderConfig, LLMProviderType, LLMSettings } from './types';

const LOCAL_STORAGE_KEY = 'globallogic-pr-bot-settings';

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

export function getSettings(): LLMSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  
  const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
  
  if (!storedSettings) {
    return DEFAULT_SETTINGS;
  }
  
  try {
    return JSON.parse(storedSettings) as LLMSettings;
  } catch (error) {
    console.error('Failed to parse stored settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: LLMSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

export function updateProviderConfig(
  type: LLMProviderType,
  config: Partial<LLMProviderConfig>
): LLMSettings {
  const settings = getSettings();
  
  settings.providers[type] = {
    ...settings.providers[type],
    ...config,
  };
  
  saveSettings(settings);
  return settings;
}

export function setActiveProvider(type: LLMProviderType): LLMSettings {
  const settings = getSettings();
  settings.activeProvider = type;
  saveSettings(settings);
  return settings;
} 