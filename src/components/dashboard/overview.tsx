"use client"

import { Card, CardContent } from '@/components/ui/card';
import { Repository, PullRequest, UserProfile } from '@/lib/github/api';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  GitPullRequest,
  Clock,
  Users,
  TrendingUp,
  Star,
  Lock,
  Plus,
  Brain,
  Settings,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

interface OverviewProps {
  stats: {
    totalPRs: number;
    readyForReview: number;
    draftPRs: number;
    myPRs: number;
  };
  selectedRepos: Set<string>;
  repositories: Repository[];
  pullRequests: PullRequest[];
  userProfile: UserProfile | null;
  onToggleRepo?: (repoFullName: string) => void;
}

// Helper function to get time ago string
const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  } else {
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }
};

// Get status background for PR
const getPRStatusBg = (pr: PullRequest): string => {
  if (pr.draft) return 'bg-gray-500';
  if (pr.state === 'open') return 'bg-green-600';
  return 'bg-purple-600';
};

// localStorage helper functions
const CACHE_KEYS = {
  REPOSITORIES: 'dashboard_repositories',
  PULL_REQUESTS: 'dashboard_pull_requests',
  LAST_UPDATE: 'dashboard_last_update'
};

const getCachedData = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedData = (key: string, data: Repository[] | PullRequest[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(CACHE_KEYS.LAST_UPDATE, Date.now().toString());
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

export function Overview({ stats, selectedRepos, repositories, pullRequests, onToggleRepo }: OverviewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [cachedRepos, setCachedRepos] = useState<Repository[]>([]);
  const [cachedPRs, setCachedPRs] = useState<PullRequest[]>([]);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [loading] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [isAICardExpanded, setIsAICardExpanded] = useState(false);
  const [allSettings, setAllSettings] = useState<{
    selectedProvider?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    ollamaEndpoint?: string;
    ollamaModel?: string;
  } | null>(null);

  // Load provider selection and all settings
  const loadProviderSelection = useCallback(async () => {
    if (!session?.user?.email) return;
    try {
      const response = await fetch(`/api/settings?user=${encodeURIComponent(session.user.email)}`);
      if (response.ok) {
        const settings = await response.json();
        setAllSettings(settings);
        setSelectedProvider(settings?.selectedProvider || '');
      }
    } catch (error) {
      console.error('Error loading provider selection:', error);
    }
  }, [session?.user?.email]);

  // Check if a provider is properly configured
  const isProviderConfigured = (provider: string): boolean => {
    if (!allSettings) return false;
    
    switch (provider) {
      case 'openai':
        return !!(allSettings.openaiApiKey && allSettings.openaiModel);
      case 'gemini':
        return !!(allSettings.geminiApiKey && allSettings.geminiModel);
      case 'ollama':
        return !!(allSettings.ollamaModel); // URL is hardcoded, only model required
      default:
        return false;
    }
  };

  // Save provider selection with proper data structure
  const saveProviderSelection = async (provider: string) => {
    if (!session?.user?.email) return;
    
    // Check if provider is configured before allowing selection
    if (!isProviderConfigured(provider)) {
      setSaveMessage(`✗ Please configure ${provider.toUpperCase()} settings first`);
      setTimeout(() => setSaveMessage(''), 4000);
      return;
    }
    
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: session.user.email,
          settings: {
            selectedProvider: provider
          }
        })
      });
      
      if (response.ok) {
        setSelectedProvider(provider);
        setSaveMessage('✓ Provider saved successfully');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        const errorData = await response.text();
        console.error('Response error:', errorData);
        throw new Error(`Failed to save provider: ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving provider selection:', error);
      setSaveMessage('✗ Failed to save provider');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Load from cache and update cache when data changes
  useEffect(() => {
    const cached = getCachedData(CACHE_KEYS.REPOSITORIES);
    if (cached && repositories.length === 0) {
      setCachedRepos(cached);
    } else if (repositories.length > 0) {
      setCachedRepos(repositories);
      setCachedData(CACHE_KEYS.REPOSITORIES, repositories);
    }
    
    // Load provider selection on mount
    loadProviderSelection();
  }, [repositories, session, loadProviderSelection]);

  useEffect(() => {
    const cached = getCachedData(CACHE_KEYS.PULL_REQUESTS);
    if (cached && pullRequests.length === 0) {
      setCachedPRs(cached);
    } else if (pullRequests.length > 0) {
      setCachedPRs(pullRequests);
      setCachedData(CACHE_KEYS.PULL_REQUESTS, pullRequests);
    }
  }, [pullRequests]);

  const displayedRepositories = (repositories.length > 0 ? repositories : cachedRepos)
    .filter(repo => selectedRepos.has(repo.full_name));
  const recentPRs = (pullRequests.length > 0 ? pullRequests : cachedPRs).slice(0, 15);

  // Get the most recent update time from PRs
  const getLastUpdated = () => {
    if (recentPRs.length === 0) return 'Never';
    const mostRecent = recentPRs.reduce((latest, pr) => {
      const prTime = new Date(pr.updated_at).getTime();
      const latestTime = new Date(latest.updated_at).getTime();
      return prTime > latestTime ? pr : latest;
    });
    return getTimeAgo(mostRecent.updated_at);
  };

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-gray-300 shadow-sm rounded-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total PRs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalPRs}</p>
                <p className="text-xs text-gray-500 mt-1">Across all repositories</p>
              </div>
              <div className="h-12 w-12 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
                <GitPullRequest className="h-6 w-6 text-gray-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-300 shadow-sm rounded-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready for Review</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.readyForReview}</p>
                <p className="text-xs text-gray-500 mt-1">Needs attention</p>
              </div>
              <div className="h-12 w-12 bg-green-600 border border-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-300 shadow-sm rounded-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Draft PRs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.draftPRs}</p>
                <p className="text-xs text-gray-500 mt-1">Work in progress</p>
              </div>
              <div className="h-12 w-12 bg-gray-600 border border-gray-600 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-300 shadow-sm rounded-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">My PRs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.myPRs}</p>
                <p className="text-xs text-gray-500 mt-1">Created by you</p>
              </div>
              <div className="h-12 w-12 bg-blue-600 border border-blue-600 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Providers Card */}
      <Card className="border border-gray-300 shadow-sm rounded-lg">
        <CardContent className="p-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsAICardExpanded(!isAICardExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-900 border border-gray-900 rounded-lg flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select LLM Provider for AI PR Review</h3>
                <p className="text-sm text-gray-600">
                  {selectedProvider && isProviderConfigured(selectedProvider) 
                    ? `Currently using: ${selectedProvider.toUpperCase()}` 
                    : 'No LLM provider is selected, first configure then select'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <div className={`text-sm font-medium ${saveMessage.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/settings');
                }}
                className="bg-gray-900 text-white px-4 py-2 border border-gray-900 text-sm font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2 rounded-lg"
              >
                <Settings className="h-4 w-4" />
                Configure
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                {isAICardExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {isAICardExpanded && (
            <div className="mt-6">

          {/* Provider Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* OpenAI */}
            <div 
              onClick={() => !isSaving && saveProviderSelection('openai')}
              className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedProvider === 'openai' 
                  ? 'border-gray-900 bg-gray-50 shadow-md' 
                  : isProviderConfigured('openai')
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-red-200 bg-red-50 cursor-not-allowed'
              }`}
            >
              {selectedProvider === 'openai' && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              {!isProviderConfigured('openai') && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 border border-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-green-700">AI</span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">OpenAI GPT-4</h4>
                  <p className="text-sm text-gray-600">
                    {isProviderConfigured('openai') ? 'Enterprise-grade AI' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('openai') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Best for complex analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('openai') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Industry-leading accuracy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('openai') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">
                    {isProviderConfigured('openai') ? 'Reliable & stable' : 'Requires API key & model'}
                  </span>
                </div>
              </div>
            </div>

            {/* Google Gemini */}
            <div 
              onClick={() => !isSaving && saveProviderSelection('gemini')}
              className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedProvider === 'gemini' 
                  ? 'border-gray-900 bg-gray-50 shadow-md' 
                  : isProviderConfigured('gemini')
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-red-200 bg-red-50 cursor-not-allowed'
              }`}
            >
              {selectedProvider === 'gemini' && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              {!isProviderConfigured('gemini') && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-700">G</span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Google Gemini</h4>
                  <p className="text-sm text-gray-600">
                    {isProviderConfigured('gemini') ? 'Fast & efficient' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('gemini') ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Lightning-fast reviews</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('gemini') ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Multimodal capabilities</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('gemini') ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">
                    {isProviderConfigured('gemini') ? 'Cost-effective' : 'Requires API key & model'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ollama */}
            <div 
              onClick={() => !isSaving && saveProviderSelection('ollama')}
              className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedProvider === 'ollama' 
                  ? 'border-gray-900 bg-gray-50 shadow-md' 
                  : isProviderConfigured('ollama')
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-red-200 bg-red-50 cursor-not-allowed'
              }`}
            >
              {selectedProvider === 'ollama' && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              {!isProviderConfigured('ollama') && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-100 border border-orange-200 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🦙</span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Ollama</h4>
                  <p className="text-sm text-gray-600">
                    {isProviderConfigured('ollama') ? 'Self-hosted & private' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('ollama') ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Complete privacy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('ollama') ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">Open source models</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProviderConfigured('ollama') ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-700">
                    {isProviderConfigured('ollama') ? 'No external dependencies' : 'Requires model configuration'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading overlay */}
          {isSaving && (
            <div className="mt-4 flex items-center justify-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <Loader2 className="h-4 w-4 animate-spin text-gray-900 mr-2" />
              <span className="text-sm text-gray-600">Saving your preference...</span>
            </div>
          )}

          {/* Information footer */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              <span className="font-medium">Need help choosing?</span> OpenAI for enterprises • Gemini for speed • Ollama for privacy
            </p>
          </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Column Layout with Equal Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Starred Repositories - Left Column */}
        <Card className="border border-gray-300 shadow-sm rounded-lg h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-900 border border-gray-900 rounded-lg flex items-center justify-center">
                  <Star className="h-4 w-4 text-white" />
            </div>
            <div>
                  <h2 className="text-lg font-semibold text-gray-900">Starred Repositories</h2>
                  <p className="text-sm text-gray-600">{selectedRepos.size} of {(repositories.length > 0 ? repositories : cachedRepos).length} repositories</p>
                </div>
              </div>
              <button
                onClick={() => setShowRepoSelector(true)}
                className="bg-gray-900 text-white px-3 py-1.5 border border-gray-900 text-sm font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2 rounded-lg"
                title="Add more repositories"
              >
                <Plus className="h-4 w-4" />
                Add Repo
              </button>
            </div>
            
            {/* Summary Stats at Top */}
            <div className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-600 border border-green-700 rounded-full"></div>
                  <span className="text-gray-700 font-medium">{displayedRepositories.filter(r => !r.private).length} Public</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-600 border border-gray-700 rounded-full"></div>
                  <span className="text-gray-700 font-medium">{displayedRepositories.filter(r => r.private).length} Private</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Star className="h-3 w-3 text-orange-500" />
                <span className="font-medium">{displayedRepositories.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)} Stars</span>
              </div>
            </div>
          </div>
          
          {/* Content with Fixed Height */}
          <CardContent className="p-0 flex-1 overflow-hidden">
          {selectedRepos.size === 0 ? (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center max-w-sm">
                  <div className="h-16 w-16 bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Star className="h-8 w-8 text-gray-500" />
              </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No repositories starred</h3>
                  <p className="text-base text-gray-600 mb-6">
                    Star repositories to start tracking their pull requests.
                  </p>
                  <button className="bg-gray-900 text-white px-4 py-2 border border-gray-900 text-sm font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2 rounded-lg">
                    <Plus className="h-4 w-4" />
                    Star Repositories
              </button>
                </div>
            </div>
          ) : (
              <div className="h-full overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {displayedRepositories.map((repo) => (
                    <div key={repo.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {/* Repository Avatar */}
                        <Image 
                          src={repo.owner?.avatar_url || '/default-avatar.png'} 
                          alt={repo.owner?.login || 'Repository'}
                          width={40}
                          height={40}
                          className="border border-gray-300 rounded-lg flex-shrink-0"
                        />
                        
                        {/* Repository Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base text-gray-900 truncate">
                              {repo.name}
                            </h4>
                            {repo.private && <Lock className="h-5 w-5 text-gray-500" />}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="truncate">{repo.owner?.login}</span>
                            {repo.language && (
                              <>
                                <span>•</span>
                                <span>{repo.language}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{repo.stargazers_count || 0} stars</span>
                            {repo.updated_at && (
                              <>
                                <span>•</span>
                                <span>Updated {getTimeAgo(repo.updated_at)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Unstar Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleRepo?.(repo.full_name);
                          }}
                          className="flex-shrink-0 p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors rounded-lg"
                          title="Unstar repository"
                        >
                          <Star className="h-4 w-4 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

        {/* Recent PRs from Starred Repos - Right Column */}
        <Card className="border border-gray-300 shadow-sm rounded-lg h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 bg-green-600 border border-green-600 rounded-lg flex items-center justify-center">
                <GitPullRequest className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recent Pull Requests</h2>
                <p className="text-sm text-gray-600">{recentPRs.length} from starred repositories</p>
              </div>
            </div>

            {/* Summary Stats at Top */}
            <div className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-600 border border-green-700 rounded-full"></div>
                  <span className="text-gray-700 font-medium">{recentPRs.filter(pr => !pr.draft).length} Open</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-600 border border-gray-700 rounded-full"></div>
                  <span className="text-gray-700 font-medium">{recentPRs.filter(pr => pr.draft).length} Draft</span>
                </div>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Updated: {getLastUpdated()}</span>
              </div>
            </div>
          </div>

          {/* Content with Fixed Height */}
          <CardContent className="p-0 flex-1 overflow-hidden">
            {recentPRs.length === 0 ? (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center max-w-sm">
                  <div className="h-16 w-16 bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <GitPullRequest className="h-8 w-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No pull requests</h3>
                  <p className="text-base text-gray-600">
                    {selectedRepos.size === 0 
                      ? "Star repositories to see their pull requests here." 
                      : "No open pull requests found in your starred repositories."
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {recentPRs.map((pr) => (
                    <div 
                      key={pr.id} 
                      className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/pull-request/review/${pr.base?.repo?.owner?.login}/${pr.base?.repo?.name}/${pr.number}`)}
                    >
                      <div className="flex items-start gap-3">
                        {/* PR Status Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-6 h-6 border flex items-center justify-center ${getPRStatusBg(pr)} border-gray-300 rounded-lg`}>
                            <GitPullRequest className="h-4 w-4 text-white" />
                          </div>
                        </div>

                        {/* PR Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-base text-gray-900 line-clamp-2 mb-1">
                                {pr.title}
                              </h4>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <span className="font-semibold">#{pr.number}</span>
                                <span>•</span>
                                <span className="truncate">{pr.base?.repo?.full_name || 'Unknown repo'}</span>
                                {pr.draft && (
                                  <>
                                    <span>•</span>
                                    <span className="text-gray-700 bg-gray-100 px-1.5 py-0.5 border border-gray-200 text-sm rounded-full">
                                      Draft
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Image 
                                    src={pr.user.avatar_url} 
                                    alt={pr.user.login}
                                    width={20}
                                    height={20}
                                    className="border border-gray-300 rounded-full"
                                  />
                                  <span>{pr.user.login}</span>
                                </div>
                                <span>•</span>
                                <span>{getTimeAgo(pr.updated_at)}</span>
                                {pr.changed_files > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{pr.changed_files} files</span>
                                  </>
                                )}
                                {(pr.additions > 0 || pr.deletions > 0) && (
                                  <>
                                    <span>•</span>
                                    <span className="text-green-600">+{pr.additions || 0}</span>
                                    <span className="text-red-600">-{pr.deletions || 0}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
                  </CardContent>
                </Card>
      </div>

      {/* Repository Selector Modal */}
      {showRepoSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Repositories</h3>
                <button
                  onClick={() => {
                    setShowRepoSelector(false);
                    setRepoSearchQuery('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus className="h-6 w-6 transform rotate-45" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">Select repositories to star and track their pull requests</p>
              
              {/* Search Input */}
              <div className="mt-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={repoSearchQuery}
                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-600">Loading repositories...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {(repositories.length > 0 ? repositories : cachedRepos)
                    .filter(repo => !selectedRepos.has(repo.full_name))
                    .filter(repo => {
                      if (!repoSearchQuery.trim()) return true;
                      const query = repoSearchQuery.toLowerCase();
                      return (
                        repo.name.toLowerCase().includes(query) ||
                        repo.full_name.toLowerCase().includes(query) ||
                        (repo.description && repo.description.toLowerCase().includes(query)) ||
                        (repo.owner?.login && repo.owner.login.toLowerCase().includes(query))
                      );
                    })
                    .map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Image 
                          src={repo.owner?.avatar_url || '/default-avatar.png'} 
                          alt={repo.owner?.login || 'Repository'}
                          width={32}
                          height={32}
                          className="border border-gray-300 rounded-lg"
                        />
                        <div>
                          <h4 className="font-semibold text-sm text-gray-900">
                            {repo.full_name}
                          </h4>
                          <p className="text-xs text-gray-600">
                            {repo.description || 'No description available'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onToggleRepo?.(repo.full_name);
                          setShowRepoSelector(false);
                          setRepoSearchQuery('');
                        }}
                        className="bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-800 transition-colors rounded-lg flex items-center gap-1"
                      >
                        <Star className="h-3 w-3" />
                        Star
                      </button>
                    </div>
                  ))}
                  
                  {(repositories.length > 0 ? repositories : cachedRepos)
                    .filter(repo => !selectedRepos.has(repo.full_name))
                    .filter(repo => {
                      if (!repoSearchQuery.trim()) return true;
                      const query = repoSearchQuery.toLowerCase();
                      return (
                        repo.name.toLowerCase().includes(query) ||
                        repo.full_name.toLowerCase().includes(query) ||
                        (repo.description && repo.description.toLowerCase().includes(query)) ||
                        (repo.owner?.login && repo.owner.login.toLowerCase().includes(query))
                      );
                    }).length === 0 && (
                    <div className="text-center py-8">
                      <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Star className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-600">
                        {repoSearchQuery.trim() 
                          ? `No repositories found matching "${repoSearchQuery}"`
                          : "All available repositories are already starred!"
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
            </div>
          )}
    </div>
  );
} 