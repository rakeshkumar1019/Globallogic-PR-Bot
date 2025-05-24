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
  selectedProvider?: 'openai' | 'gemini' | 'ollama';
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaModel?: string;
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



        {/* Provider Configurations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OpenAI */}
          <Card className="border border-gray-300 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 border border-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-green-700">AI</span>
                </div>
                <div>
                  <CardTitle className="text-base text-gray-900">OpenAI</CardTitle>
                  <p className="text-sm text-gray-600">GPT-4 and GPT-3.5 models</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey" className="text-sm font-medium">API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => handleFieldChange('openaiApiKey', e.target.value)}
                  className="h-9"
                />
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
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Best for complex analysis</span>
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
                <div>
                  <CardTitle className="text-base text-gray-900">Google Gemini</CardTitle>
                  <p className="text-sm text-gray-600">Fast and efficient AI model</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="geminiApiKey" className="text-sm font-medium">API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  placeholder="AI..."
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => handleFieldChange('geminiApiKey', e.target.value)}
                  className="h-9"
                />
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
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Fast and cost-effective</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ollama */}
          <Card className="border border-gray-300 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 border border-orange-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm">🦙</span>
                </div>
                <div>
                  <CardTitle className="text-base text-gray-900">Ollama</CardTitle>
                  <p className="text-sm text-gray-600">Self-hosted open source</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ollamaEndpoint" className="text-sm font-medium">Endpoint URL</Label>
                <Input
                  id="ollamaEndpoint"
                  type="text"
                  value="http://localhost:11434"
                  disabled
                  className="h-9 bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500">Endpoint is hardcoded for security</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollamaModel" className="text-sm font-medium">Model Name</Label>
                <Input
                  id="ollamaModel"
                  type="text"
                  placeholder="llama3.2:3b"
                  value={settings.ollamaModel || ''}
                  onChange={(e) => handleFieldChange('ollamaModel', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Complete privacy and control</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


      </div>
    </SidebarLayout>
  );
} 