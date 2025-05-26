'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { Check, AlertCircle, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';

interface LLMSettings {
  selectedProvider?: 'openai' | 'gemini';
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaModel?: string; // Keep for backward compatibility but not selectable
}

export default function Settings() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<LLMSettings>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const OPENAI_MODELS = [
    { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  const GEMINI_MODELS = [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
  ];

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/settings?user=${encodeURIComponent(session!.user!.email!)}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data || {});
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
    if (status === 'authenticated' && session?.user?.email) {
      loadSettings();
    }
  }, [status, router, session, loadSettings]);

  const handleSaveSettings = async () => {
    if (!session?.user?.email) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: session.user.email,
          settings
        })
      });

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Settings saved successfully! Your AI configuration is now active.' });
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof LLMSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (status === 'loading' || loading) {
    return (
      <SidebarLayout 
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" }
        ]}
      >
        <div className="space-y-6">
          <Skeleton className="h-12 w-96" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[400px] w-full" />
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout 
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings" }
      ]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">LLM Provider Settings</h1>
                <p className="text-sm text-gray-600">Configure your AI providers for intelligent code reviews</p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleSaveSettings} 
            disabled={saving}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Saving...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Save Settings
              </div>
            )}
          </Button>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'} className="border border-gray-200">
            <div className="flex items-center gap-3">
              {saveMessage.type === 'success' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{saveMessage.text}</AlertDescription>
            </div>
          </Alert>
        )}



        {/* Provider Information */}
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Getting Started with AI Providers</h3>
                <p className="text-blue-800 mb-4">
                  Configure one or more AI providers to enable intelligent code reviews. Each provider offers different strengths and pricing models.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-900">📋 Requirements:</h4>
                    <ul className="text-blue-800 space-y-1">
                      <li>• Valid API key from your chosen provider</li>
                      <li>• Select an appropriate model for your needs</li>
                      <li>• Ensure sufficient API credits/quota</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-900">💡 Tips:</h4>
                    <ul className="text-blue-800 space-y-1">
                      <li>• Start with OpenAI GPT-4o for best results</li>
                      <li>• Use Gemini Flash for faster, cost-effective reviews</li>
                      <li>• Keep your API keys secure and private</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Configurations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OpenAI */}
          <Card className="border border-gray-300 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 border border-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-green-700">AI</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-gray-900">OpenAI</CardTitle>
                  <p className="text-sm text-gray-600">GPT-4 and GPT-3.5 models</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Most Advanced</div>
                  <div className="text-xs font-medium text-green-600">Recommended</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-green-800">Need an API Key?</h4>
                    <p className="text-xs text-green-700">Get started with $5 free credit</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                    className="text-xs border-green-600 text-green-600 hover:bg-green-50"
                  >
                    Get API Key
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey" className="text-sm font-medium">API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  placeholder="sk-proj-..."
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => handleFieldChange('openaiApiKey', e.target.value)}
                  className="h-9"
                />
                <p className="text-xs text-gray-500">Your API key from platform.openai.com</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="openaiModel" className="text-sm font-medium">Model</Label>
                <Select 
                  value={settings.openaiModel || ''} 
                  onValueChange={(value) => handleFieldChange('openaiModel', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Best for complex code analysis</span>
                </div>
                <div className="text-xs text-gray-500">
                  💰 Pricing: ~$0.01-0.06 per 1K tokens
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google Gemini */}
          <Card className="border border-gray-300 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-700">G</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-gray-900">Google Gemini</CardTitle>
                  <p className="text-sm text-gray-600">Fast and efficient AI model</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Fast & Affordable</div>
                  <div className="text-xs font-medium text-blue-600">Cost-Effective</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800">Need an API Key?</h4>
                    <p className="text-xs text-blue-700">Free tier with generous limits</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                    className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    Get API Key
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="geminiApiKey" className="text-sm font-medium">API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  placeholder="AIza..."
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => handleFieldChange('geminiApiKey', e.target.value)}
                  className="h-9"
                />
                <p className="text-xs text-gray-500">Your API key from Google AI Studio</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="geminiModel" className="text-sm font-medium">Model</Label>
                <Select 
                  value={settings.geminiModel || ''} 
                  onValueChange={(value) => handleFieldChange('geminiModel', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Fast and cost-effective</span>
                </div>
                <div className="text-xs text-gray-500">
                  💰 Pricing: Free tier + $0.001-0.005 per 1K tokens
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ollama */}
          <Card className="border border-gray-300 shadow-sm opacity-60">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 border border-orange-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm">🦙</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-gray-900">Ollama</CardTitle>
                  <p className="text-sm text-gray-600">Self-hosted open source</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                    Coming Soon
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800">Coming Soon!</h4>
                    <p className="text-xs text-yellow-700">Run AI models locally on your machine</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://ollama.ai/', '_blank')}
                    className="text-xs border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                    disabled
                  >
                    Learn More
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ollamaEndpoint" className="text-sm font-medium text-gray-400">Endpoint URL</Label>
                <Input
                  id="ollamaEndpoint"
                  type="text"
                  value="http://localhost:11434"
                  disabled
                  className="h-9 bg-gray-100 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">Default Ollama endpoint</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ollamaModel" className="text-sm font-medium text-gray-400">Model Name</Label>
                <Input
                  id="ollamaModel"
                  type="text"
                  placeholder="llama3.2:3b"
                  value=""
                  disabled
                  className="h-9 bg-gray-100 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">Popular models: llama3.2, codellama, mistral</p>
              </div>
              
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Complete privacy and control</span>
                </div>
                <div className="text-xs text-gray-400">
                  💰 Pricing: Free (runs on your hardware)
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Resources */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Resources</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">📚 Documentation</h4>
                <div className="space-y-1">
                  <a 
                    href="https://platform.openai.com/docs/api-reference" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:text-blue-800"
                  >
                    OpenAI API Documentation
                  </a>
                  <a 
                    href="https://ai.google.dev/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:text-blue-800"
                  >
                    Google AI Documentation
                  </a>
                  <a 
                    href="https://ollama.ai/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:text-blue-800"
                  >
                    Ollama Documentation
                  </a>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">💡 Best Practices</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Store API keys securely in environment variables</li>
                  <li>• Monitor your API usage and billing</li>
                  <li>• Start with recommended models for best results</li>
                  <li>• Test with small PRs before larger reviews</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">🔐 Security</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• API keys are encrypted and stored securely</li>
                  <li>• Your code is only sent to your chosen provider</li>
                  <li>• No code is stored on our servers</li>
                  <li>• You can revoke access anytime</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </SidebarLayout>
  );
} 