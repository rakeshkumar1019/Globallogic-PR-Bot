'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  getSettings, 
  saveSettings
} from '@/lib/llm-providers/settings';
import { LLMProviderConfig, LLMProviderType, LLMSettings } from '@/lib/llm-providers/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function Settings() {
  const { status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }

    if (typeof window !== 'undefined') {
      setSettings(getSettings());
    }
  }, [status, router]);

  if (status === 'loading' || !settings) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-5 w-32" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const validateProvider = (type: LLMProviderType, provider: LLMProviderConfig): string[] => {
    const errors: string[] = [];
    
    if (!provider.enabled) return errors;
    
    if (type === 'ollama') {
      if (!provider.baseUrl?.trim()) {
        errors.push('Server URL is required');
      } else if (!provider.baseUrl.startsWith('http')) {
        errors.push('Server URL must start with http:// or https://');
      }
    } else {
      if (!provider.apiKey?.trim()) {
        errors.push('API Key is required');
      }
    }
    
    if (!provider.model?.trim()) {
      errors.push('Model is required');
    }
    
    return errors;
  };

  const handleProviderChange = (type: LLMProviderType, field: keyof LLMProviderConfig, value: string | boolean) => {
    if (!settings) return;
    
    const updatedSettings = { ...settings };
    
    updatedSettings.providers[type] = {
      ...updatedSettings.providers[type],
      [field]: value
    };
    
    setSettings(updatedSettings);
    
    // Clear validation errors for this field
    const errorKey = `${type}-${String(field)}`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleSetActive = (type: LLMProviderType) => {
    if (!settings) return;
    
    const provider = settings.providers[type];
    const errors = validateProvider(type, provider);
    
    if (errors.length > 0) {
      const newValidationErrors: Record<string, string> = {};
      errors.forEach(error => {
        newValidationErrors[`${type}-validation`] = error;
      });
      setValidationErrors(newValidationErrors);
      return;
    }
    
    const updatedSettings = { ...settings, activeProvider: type };
    setSettings(updatedSettings);
    setValidationErrors({});
  };

  const handleSaveSettings = () => {
    if (!settings) return;
    
    // Validate all enabled providers
    const allErrors: Record<string, string> = {};
    Object.entries(settings.providers).forEach(([type, provider]) => {
      if (provider.enabled) {
        const errors = validateProvider(type as LLMProviderType, provider);
        if (errors.length > 0) {
          allErrors[`${type}-validation`] = errors[0];
        }
      }
    });
    
    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors);
      return;
    }
    
    setSaving(true);
    
    try {
      saveSettings(settings);
      setSaveMessage({ type: 'success', text: 'Settings saved successfully! Your changes have been applied.' });
      setValidationErrors({});
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const renderProviderCard = (type: LLMProviderType) => {
    const provider = settings?.providers[type];
    const isActive = settings?.activeProvider === type;
    const hasValidationError = validationErrors[`${type}-validation`];
    
    const modelFieldsByType: Record<LLMProviderType, {name: string, description: string, icon: React.ReactNode, defaultModel: string, gradient: string}> = {
      'openai': {
        name: 'OpenAI',
        description: 'GPT-4 and GPT-3.5 models for sophisticated code analysis',
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5833 1.4997-2.6256-1.4997z" fill="currentColor"/>
          </svg>
        ),
        defaultModel: 'gpt-4-turbo',
        gradient: 'from-green-500 to-blue-600'
      },
      'gemini': {
        name: 'Google Gemini',
        description: 'Advanced multimodal AI with exceptional reasoning capabilities',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 12a4.5 4.5 0 0 0 4.5-4.5h-9C7.5 10 9.5 12 12 12z"/>
            <path d="M12 12a4.5 4.5 0 0 1 4.5 4.5h-9A4.5 4.5 0 0 1 12 12z"/>
          </svg>
        ),
        defaultModel: 'gemini-1.5-pro',
        gradient: 'from-purple-500 to-pink-600'
      },
      'ollama': {
        name: 'Ollama',
        description: 'Self-hosted open-source models for complete privacy control',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M12 3a6 6 0 0 0 9 5.197M12 3a6 6 0 0 1-9 5.197M12 3v10"/>
            <path d="M12 13a6 6 0 0 0 9 5.197M12 13a6 6 0 0 1-9 5.197M12 13v4"/>
          </svg>
        ),
        defaultModel: 'llama3.2:3b',
        gradient: 'from-orange-500 to-red-600'
      }
    };
    
    const providerInfo = modelFieldsByType[type];
    
    return (
      <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
        isActive ? 'ring-2 ring-primary shadow-lg' : hasValidationError ? 'ring-2 ring-red-500' : ''
      }`}>
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${providerInfo.gradient} opacity-5`} />
        
        <CardHeader className="relative pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'} transition-colors`}>
              {providerInfo.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{providerInfo.name}</CardTitle>
                {isActive && <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>}
                {provider?.enabled && !isActive && <Badge variant="outline">Enabled</Badge>}
              </div>
              <CardDescription className="text-sm leading-relaxed">
                {providerInfo.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="relative space-y-5">
          {hasValidationError && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertDescription className="text-sm">{hasValidationError}</AlertDescription>
            </Alert>
          )}
          
          {type === 'ollama' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${type}-baseUrl`} className="text-sm font-medium">Server URL</Label>
                <Input
                  id={`${type}-baseUrl`}
                  placeholder="http://localhost:11434"
                  value={provider?.baseUrl as string || ''}
                  onChange={(e) => handleProviderChange(type, 'baseUrl', e.target.value)}
                  className={validationErrors[`${type}-baseUrl`] ? 'border-red-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${type}-model`} className="text-sm font-medium">Model Name</Label>
                <Input
                  id={`${type}-model`}
                  placeholder={providerInfo.defaultModel}
                  value={provider?.model as string || ''}
                  onChange={(e) => handleProviderChange(type, 'model', e.target.value)}
                  className={validationErrors[`${type}-model`] ? 'border-red-500' : ''}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${type}-apiKey`} className="text-sm font-medium">API Key</Label>
                <Input
                  id={`${type}-apiKey`}
                  type="password"
                  placeholder="Enter your API key"
                  value={provider?.apiKey as string || ''}
                  onChange={(e) => handleProviderChange(type, 'apiKey', e.target.value)}
                  className={validationErrors[`${type}-apiKey`] ? 'border-red-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${type}-model`} className="text-sm font-medium">Model</Label>
                <Input
                  id={`${type}-model`}
                  placeholder={providerInfo.defaultModel}
                  value={provider?.model as string || ''}
                  onChange={(e) => handleProviderChange(type, 'model', e.target.value)}
                  className={validationErrors[`${type}-model`] ? 'border-red-500' : ''}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-3 pt-2">
            <input
              id={`${type}-enabled`}
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary transition-colors"
              checked={provider?.enabled || false}
              onChange={(e) => handleProviderChange(type, 'enabled', e.target.checked)}
            />
            <Label htmlFor={`${type}-enabled`} className="text-sm font-medium select-none cursor-pointer">
              Enable {providerInfo.name} for code reviews
            </Label>
          </div>
        </CardContent>
        
        <CardFooter className="relative">
          <Button
            variant={isActive ? "secondary" : "default"}
            onClick={() => handleSetActive(type)}
            className="w-full transition-all"
            disabled={isActive || !(provider?.enabled)}
          >
            {isActive ? '✓ Currently Active' : 'Set as Active Provider'}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your AI providers for intelligent code reviews
          </p>
        </div>
        <Button 
          onClick={handleSaveSettings} 
          disabled={saving}
          className="px-6"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>
      
      {saveMessage && (
        <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'} className="max-w-2xl">
          <AlertTitle className="font-semibold">
            {saveMessage.type === 'success' ? '✓ Success' : '⚠ Error'}
          </AlertTitle>
          <AlertDescription>{saveMessage.text}</AlertDescription>
        </Alert>
      )}
      
      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-1">
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Providers
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="providers" className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-full p-1">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Provider Configuration</h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Configure your preferred AI providers for code reviews. You will need valid API keys or 
                  connection details for each provider. Only one provider can be active at a time.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {renderProviderCard('openai')}
            {renderProviderCard('gemini')}
            {renderProviderCard('ollama')}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 