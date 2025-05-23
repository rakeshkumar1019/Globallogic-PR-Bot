'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Brain, Check, AlertCircle, Settings as SettingsIcon, Shield, Zap } from 'lucide-react';

interface LLMSettings {
  selectedProvider?: 'openai' | 'gemini' | 'ollama';
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaEndpoint?: string;
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
    if (status === 'authenticated' && session?.user?.email) {
      loadSettings();
    }
  }, [status, router, session]);

  const loadSettings = async () => {
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
  };

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
      <div className="min-h-screen bg-white">
        <div className="w-full px-8 py-6">
          <div className="space-y-6">
            <Skeleton className="h-12 w-96" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[400px] w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center gap-6 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <SettingsIcon className="h-8 w-8 text-purple-600" />
                <h1 className="text-4xl font-bold text-gray-900">AI Settings</h1>
              </div>
              <p className="text-lg text-gray-600">
                Configure your AI providers for intelligent code reviews and automated assistance
              </p>
            </div>
            <Button 
              onClick={handleSaveSettings} 
              disabled={saving}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 px-8"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Save Configuration
                </div>
              )}
            </Button>
          </div>
        </div>

        {saveMessage && (
          <div className="mx-8 mt-6">
            <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'} className="border-l-4 border-l-green-500">
              <div className="flex items-center gap-3">
                {saveMessage.type === 'success' ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <AlertDescription className="text-base">{saveMessage.text}</AlertDescription>
              </div>
            </Alert>
          </div>
        )}

        {/* Main Content */}
        <div className="px-8 py-6 space-y-8">
          {/* Default Provider Selection */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <Brain className="h-6 w-6 text-purple-600" />
                Default AI Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="selectedProvider" className="text-base font-medium">
                    Select your preferred AI provider for code reviews
                  </Label>
                  <Select 
                    value={settings.selectedProvider || ''} 
                    onValueChange={(value) => handleFieldChange('selectedProvider', value)}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Choose an AI provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">🤖 OpenAI (GPT-4)</SelectItem>
                      <SelectItem value="gemini">✨ Google Gemini</SelectItem>
                      <SelectItem value="ollama">🦙 Ollama (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You must configure at least one provider below and select it here to use AI reviews.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Provider Configurations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* OpenAI */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <svg className="h-6 w-6 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5833 1.4997-2.6256-1.4997z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">OpenAI</CardTitle>
                    <p className="text-sm text-gray-600">GPT-4 and GPT-3.5 models</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openaiApiKey" className="text-sm font-medium">API Key</Label>
                  <Input
                    id="openaiApiKey"
                    type="password"
                    placeholder="sk-..."
                    value={settings.openaiApiKey || ''}
                    onChange={(e) => handleFieldChange('openaiApiKey', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openaiModel" className="text-sm font-medium">Model</Label>
                  <Select 
                    value={settings.openaiModel || ''} 
                    onValueChange={(value) => handleFieldChange('openaiModel', value)}
                  >
                    <SelectTrigger className="h-10">
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
                    <Shield className="h-3 w-3" />
                    <span>Requires valid OpenAI API key</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Gemini */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Google Gemini</CardTitle>
                    <p className="text-sm text-gray-600">Advanced multimodal AI</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="geminiApiKey" className="text-sm font-medium">API Key</Label>
                  <Input
                    id="geminiApiKey"
                    type="password"
                    placeholder="AI..."
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => handleFieldChange('geminiApiKey', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geminiModel" className="text-sm font-medium">Model</Label>
                  <Select 
                    value={settings.geminiModel || ''} 
                    onValueChange={(value) => handleFieldChange('geminiModel', value)}
                  >
                    <SelectTrigger className="h-10">
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
                    <Zap className="h-3 w-3" />
                    <span>Fast and efficient multimodal</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ollama */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">O</span>
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">Ollama</CardTitle>
                    <p className="text-sm text-gray-600">Self-hosted open models</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ollamaEndpoint" className="text-sm font-medium">Server URL</Label>
                  <Input
                    id="ollamaEndpoint"
                    placeholder="http://localhost:11434"
                    value={settings.ollamaEndpoint || ''}
                    onChange={(e) => handleFieldChange('ollamaEndpoint', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ollamaModel" className="text-sm font-medium">Model Name</Label>
                  <Input
                    id="ollamaModel"
                    placeholder="llama3.2:3b"
                    value={settings.ollamaModel || ''}
                    onChange={(e) => handleFieldChange('ollamaModel', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Shield className="h-3 w-3" />
                    <span>Complete privacy control</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started Guide */}
          <Card className="border border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-blue-900">
                <Brain className="h-6 w-6" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4 text-blue-800">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">1</div>
                  <p><strong>Configure a Provider:</strong> Fill in the API key and model for your preferred AI provider above.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">2</div>
                  <p><strong>Select Default:</strong> Choose your preferred provider in the &ldquo;Default AI Provider&rdquo; section.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">3</div>
                  <p><strong>Save Settings:</strong> Click &ldquo;Save Configuration&rdquo; to apply your changes.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">4</div>
                  <p><strong>Start Reviewing:</strong> Go to any PR and click &ldquo;Generate AI Review&rdquo; to get intelligent code insights!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 