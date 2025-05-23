export type LLMProviderType = 'openai' | 'gemini' | 'ollama';

export interface LLMProviderConfig {
  type: LLMProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

export interface LLMSettings {
  providers: Record<LLMProviderType, LLMProviderConfig>;
  activeProvider?: LLMProviderType;
} 