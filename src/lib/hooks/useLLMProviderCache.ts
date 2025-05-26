import { useState, useEffect } from 'react'

const LLM_PROVIDER_CACHE_KEY = 'llm_provider_selection'

export function useLLMProviderCache() {
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini'>('openai')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LLM_PROVIDER_CACHE_KEY)
      if (cached && (cached === 'openai' || cached === 'gemini')) {
        setSelectedProvider(cached as 'openai' | 'gemini')
      }
    } catch (error) {
      console.warn('Failed to load LLM provider from cache:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save to localStorage when provider changes
  const updateProvider = (provider: 'openai' | 'gemini') => {
    try {
      localStorage.setItem(LLM_PROVIDER_CACHE_KEY, provider)
      setSelectedProvider(provider)
    } catch (error) {
      console.warn('Failed to save LLM provider to cache:', error)
      // Still update state even if localStorage fails
      setSelectedProvider(provider)
    }
  }

  // Clear cache
  const clearCache = () => {
    try {
      localStorage.removeItem(LLM_PROVIDER_CACHE_KEY)
    } catch (error) {
      console.warn('Failed to clear LLM provider cache:', error)
    }
    setSelectedProvider('openai')
  }

  return {
    selectedProvider,
    setSelectedProvider: updateProvider,
    clearCache,
    isLoaded
  }
} 