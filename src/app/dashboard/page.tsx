'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitHubClient, Repository, UserProfile, PullRequest } from '@/lib/github/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { demoUserProfile, demoRepositories, demoPullRequests } from '@/lib/demo-data';
import { GitPullRequest, Clock, CheckCircle, Search, FileText, Grid3X3, List, RefreshCw, Filter, TrendingUp, Users, Activity, ChevronRight, ExternalLink } from 'lucide-react';

type ViewMode = 'grid' | 'list';
type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';
type CacheData = UserProfile | Repository[] | PullRequest[];

interface CacheEntry {
  data: CacheData;
  timestamp: number;
  ttl: number;
  etag?: string;
}

// Enhanced cache with better management
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = {
  REPOS: 15 * 60 * 1000,    // 15 minutes
  PRS: 3 * 60 * 1000,      // 3 minutes  
  PROFILE: 60 * 60 * 1000   // 1 hour
};

// Enhanced cache functions with stale-while-revalidate pattern
const getCachedData = (key: string): { data: CacheData | null; isStale: boolean } => {
  const cached = cache.get(key);
  if (!cached) return { data: null, isStale: false };
  
  const isExpired = Date.now() - cached.timestamp > cached.ttl;
  const isStale = Date.now() - cached.timestamp > cached.ttl * 0.8; // Consider stale at 80% of TTL
  
  if (isExpired) {
    cache.delete(key);
    return { data: null, isStale: false };
  }
  
  return { data: cached.data, isStale };
};

const setCachedData = (key: string, data: CacheData, ttl: number, etag?: string): void => {
  cache.set(key, { data, timestamp: Date.now(), ttl, etag });
};

// Retry utility with exponential backoff
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>, 
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Enhanced state management
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [allPullRequests, setAllPullRequests] = useState<PullRequest[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [loadingPRs, setLoadingPRs] = useState<LoadingState>('idle');
  const [isDemo, setIsDemo] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Enhanced memoized filtered PRs with better performance
  const filteredPRs = useMemo(() => {
    let filtered = [...pullRequests];
    
    if (selectedRepo && selectedRepo !== 'all') {
      filtered = filtered.filter(pr => pr.base.repo.full_name === selectedRepo);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(pr =>
        pr.title.toLowerCase().includes(query) ||
        pr.user.login.toLowerCase().includes(query) ||
        pr.number.toString().includes(query) ||
        pr.base?.repo?.full_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [pullRequests, selectedRepo, searchQuery]);

  // Latest PRs from all repositories
  const latestPRs = useMemo(() => {
    return allPullRequests
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [allPullRequests]);

  // Enhanced stats with essential metrics only
  const stats = useMemo(() => {
    const totalPRs = filteredPRs.length;
    const readyForReview = filteredPRs.filter(pr => !pr.draft && pr.state === 'open').length;
    const draftPRs = filteredPRs.filter(pr => pr.draft).length;
    const activeRepos = new Set(filteredPRs.map(pr => pr.base.repo.full_name)).size;
    
    return { totalPRs, readyForReview, draftPRs, activeRepos };
  }, [filteredPRs]);

  // Enhanced data loading with better error handling
  useEffect(() => {
    if (status === 'unauthenticated') {
      setUserProfile(demoUserProfile);
      setRepositories(demoRepositories);
      setPullRequests(demoPullRequests);
      setAllPullRequests(demoPullRequests);
      setIsDemo(true);
      setLoadingState('idle');
      return;
    }

    if (status === 'authenticated' && session?.accessToken) {
      loadInitialData();
    }
  }, [status, session]);

  useEffect(() => {
    if (repositories.length > 0 && !isDemo) {
      loadPullRequests();
    }
  }, [selectedRepo, repositories, isDemo]);

  const loadInitialData = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoadingState('loading');
    setError(null);

    // Declare variables outside try block
    let cachedProfileData: CacheData | null = null;
    let cachedReposData: CacheData | null = null;

    try {
      const github = new GitHubClient(session.accessToken);
      
      const profileKey = `profile:${session.accessToken.slice(-8)}`;
      const reposKey = `repos:${session.accessToken.slice(-8)}`;
      
      const { data: profileData, isStale: profileStale } = getCachedData(profileKey);
      const { data: reposData, isStale: reposStale } = getCachedData(reposKey);
      
      cachedProfileData = profileData;
      cachedReposData = reposData;
      
      // Use cached data immediately if available
      if (cachedProfileData) setUserProfile(cachedProfileData as UserProfile);
      if (cachedReposData) setRepositories(cachedReposData as Repository[]);
      
      // Load fresh data if stale or missing
      const promises: Promise<UserProfile | Repository[]>[] = [];
      
      if (!cachedProfileData || profileStale) {
        promises.push(
          retryWithBackoff(() => github.getUserProfile())
            .then(data => {
              setCachedData(profileKey, data, CACHE_TTL.PROFILE);
              setUserProfile(data);
              return data;
            })
        );
      }
      
      if (!cachedReposData || reposStale) {
        promises.push(
          retryWithBackoff(() => github.getUserRepositories())
            .then(data => {
              setCachedData(reposKey, data, CACHE_TTL.REPOS);
              setRepositories(data);
              return data;
            })
        );
      }
      
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      
      setIsDemo(false);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error loading GitHub data:', err);
      if (!cachedProfileData && !cachedReposData) {
        // Only fallback to demo if no cached data
        setUserProfile(demoUserProfile);
        setRepositories(demoRepositories);
        setPullRequests(demoPullRequests);
        setAllPullRequests(demoPullRequests);
        setIsDemo(true);
        setError('Failed to load GitHub data. Using demo data.');
      } else {
        setError('Failed to refresh data. Using cached version.');
      }
    } finally {
      setLoadingState('idle');
    }
  }, [session?.accessToken]);

  const loadPullRequests = useCallback(async () => {
    if (!session?.accessToken || isDemo) return;
    
    setLoadingPRs('loading');
    setError(null);
    
    // Declare variable outside try block
    let cachedData: CacheData | null = null;
    
    try {
      const github = new GitHubClient(session.accessToken);
      const cacheKey = `prs:${selectedRepo}:${session.accessToken.slice(-8)}`;
      const allPRsCacheKey = `allprs:${session.accessToken.slice(-8)}`;
      
      const { data: prData, isStale } = getCachedData(cacheKey);
      const { data: cachedAllData } = getCachedData(allPRsCacheKey);
      
      cachedData = prData;
      
      // Use cached data immediately if available
      if (cachedData && !isStale) {
        setPullRequests(cachedData as PullRequest[]);
        setLoadingPRs('idle');
      }
      
      if (cachedAllData) {
        setAllPullRequests(cachedAllData as PullRequest[]);
      }
      
      if (cachedData && !isStale && cachedAllData) {
        return;
      }
      
      if (cachedData) {
        setPullRequests(cachedData as PullRequest[]);
        setLoadingPRs('refreshing');
      }
      
      const options = {
        state: 'open' as const,
        sort: 'updated' as const,
        direction: 'desc' as const,
        per_page: 100,
        page: 1
      };
      
      let result;
      let allResult;
      
      // Load all PRs for latest section
      if (!cachedAllData) {
        allResult = await retryWithBackoff(() => 
          github.getRepositoryPullRequests(undefined, undefined, options)
        );
        setAllPullRequests(allResult.pullRequests);
        setCachedData(allPRsCacheKey, allResult.pullRequests, CACHE_TTL.PRS);
      }
      
      // Load filtered PRs
      if (selectedRepo === 'all') {
        result = allResult || await retryWithBackoff(() => 
          github.getRepositoryPullRequests(undefined, undefined, options)
        );
      } else {
        const [owner, repo] = selectedRepo.split('/');
        if (owner && repo) {
          result = await retryWithBackoff(() => 
            github.getRepositoryPullRequests(owner, repo, options)
          );
        } else {
          result = allResult || await retryWithBackoff(() => 
            github.getRepositoryPullRequests(undefined, undefined, options)
          );
        }
      }
      
      setPullRequests(result.pullRequests);
      setCachedData(cacheKey, result.pullRequests, CACHE_TTL.PRS);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error loading pull requests:', err);
      if (!cachedData) {
        setError('Failed to load pull requests. Please try again.');
      } else {
        setError('Failed to refresh pull requests. Showing cached data.');
      }
    } finally {
      setLoadingPRs('idle');
    }
  }, [session?.accessToken, selectedRepo, isDemo]);

  const handleRefresh = useCallback(async () => {
    if (isDemo) return;
    
    setLoadingPRs('refreshing');
    // Clear cache for fresh data
    const cacheKey = `prs:${selectedRepo}:${session?.accessToken?.slice(-8)}`;
    const allPRsCacheKey = `allprs:${session?.accessToken?.slice(-8)}`;
    cache.delete(cacheKey);
    cache.delete(allPRsCacheKey);
    await loadPullRequests();
  }, [selectedRepo, session?.accessToken, isDemo, loadPullRequests]);

  const handlePRClick = useCallback((pr: PullRequest) => {
    const [owner, repo] = pr.base?.repo?.full_name?.split('/') || ['', ''];
    if (owner && repo) {
      router.push(`/dashboard/pr/${owner}/${repo}/${pr.number}`);
    }
  }, [router]);

  // Compact PR card for better space utilization
  const renderCompactPRCard = (pr: PullRequest) => (
    <Card 
      key={pr.id} 
      className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-300 group bg-white"
      onClick={() => handlePRClick(pr)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm line-clamp-2 mb-1 leading-tight">
              {pr.title}
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              #{pr.number} • {pr.base?.repo?.full_name}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Badge 
              variant={pr.state === 'open' ? 'default' : 'secondary'} 
              className="px-2 py-0.5 text-xs"
            >
              {pr.state}
            </Badge>
            {pr.draft && (
              <Badge variant="outline" className="px-2 py-0.5 text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                Draft
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
            <AvatarFallback className="text-xs">{pr.user.login[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-600 truncate">
            {pr.user.login}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500">
            {new Date(pr.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-3">
            {(pr.changed_files ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{pr.changed_files ?? 0}</span>
              </div>
            )}
            {((pr.additions ?? 0) > 0 || (pr.deletions ?? 0) > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-green-600">+{pr.additions ?? 0}</span>
                <span className="text-red-600">-{pr.deletions ?? 0}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-blue-500" />
        </div>
      </CardContent>
    </Card>
  );

  // Compact list item
  const renderCompactListItem = (pr: PullRequest) => (
    <div 
      key={pr.id}
      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg bg-white hover:bg-blue-50/30 cursor-pointer transition-all duration-200 hover:shadow-sm hover:border-blue-300 group"
      onClick={() => handlePRClick(pr)}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
        <AvatarFallback className="text-xs">{pr.user.login[0].toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm truncate pr-2">
            {pr.title}
          </h3>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <Badge variant={pr.state === 'open' ? 'default' : 'secondary'} className="px-2 py-0.5 text-xs">
              {pr.state}
            </Badge>
            {pr.draft && (
              <Badge variant="outline" className="px-2 py-0.5 text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                Draft
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <span>#{pr.number}</span>
          <span>{pr.base?.repo?.full_name}</span>
          <span>{pr.user.login}</span>
          <span>{new Date(pr.created_at).toLocaleDateString()}</span>
          {(pr.changed_files ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {pr.changed_files ?? 0}
            </span>
          )}
          {((pr.additions ?? 0) > 0 || (pr.deletions ?? 0) > 0) && (
            <span className="flex items-center gap-2">
              <span className="text-green-600">+{pr.additions ?? 0}</span>
              <span className="text-red-600">-{pr.deletions ?? 0}</span>
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
    </div>
  );

  // Latest PRs mini card
  const renderLatestPRItem = (pr: PullRequest, index: number) => (
    <div 
      key={pr.id}
      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
      onClick={() => handlePRClick(pr)}
    >
      <div className="text-xs font-medium text-gray-500 w-4">
        {index + 1}
      </div>
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
        <AvatarFallback className="text-xs">{pr.user.login[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
          {pr.title}
        </h4>
        <p className="text-xs text-gray-600">
          {pr.base?.repo?.full_name} • {new Date(pr.created_at).toLocaleDateString()}
        </p>
      </div>
      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
    </div>
  );

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-full px-4 py-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-10 w-80" />
              <Skeleton className="h-5 w-60" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Skeleton className="h-12 w-full mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-96 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-full">
        {/* Professional Header - Full Width */}
        <div className="border-b border-gray-200 bg-white px-4 lg:px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                PR Dashboard
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-lg text-gray-600">
                  Welcome, <span className="font-semibold">{userProfile?.name || userProfile?.login}</span>
                </p>
                {lastUpdate && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isDemo && (
                <div className="bg-blue-100 border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-blue-800 font-medium flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    Demo Mode
                  </p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={loadingPRs === 'loading' || loadingPRs === 'refreshing' || isDemo}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${(loadingPRs === 'loading' || loadingPRs === 'refreshing') ? 'animate-spin' : ''}`} />
                {loadingPRs === 'refreshing' ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Essential Stats Cards - Full Width */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total PRs</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalPRs}</p>
                  </div>
                  <GitPullRequest className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Ready</p>
                    <p className="text-2xl font-bold text-green-900">{stats.readyForReview}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-yellow-50 to-yellow-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-700">Draft</p>
                    <p className="text-2xl font-bold text-yellow-900">{stats.draftPRs}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Repos</p>
                    <p className="text-2xl font-bold text-purple-900">{stats.activeRepos}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 lg:px-6 py-3">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-orange-800 text-sm">
                {error}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Content Area - Full Width */}
        <div className="px-4 lg:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* PR List Section - Takes 2/3 width */}
            <div className="lg:col-span-2 space-y-4">
              {/* Compact Filters */}
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
                    <div className="flex flex-col lg:flex-row gap-3 items-center w-full lg:w-auto">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                          <SelectTrigger className="w-full lg:w-[250px] bg-white">
                            <SelectValue placeholder="Select Repository" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Repositories</SelectItem>
                            {repositories.map((repo) => (
                              <SelectItem key={repo.id} value={repo.full_name}>
                                {repo.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="relative w-full lg:w-[300px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search PRs..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 font-medium">
                        {filteredPRs.length} PRs
                      </span>
                      
                      <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                        <Button
                          variant={viewMode === 'grid' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('grid')}
                          className="rounded-r-none border-r"
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                          className="rounded-l-none"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PR Content */}
              {loadingPRs === 'loading' ? (
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                  : "space-y-3"
                }>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton 
                      key={i} 
                      className={viewMode === 'grid' ? "h-36 w-full" : "h-16 w-full"} 
                    />
                  ))}
                </div>
              ) : filteredPRs.length === 0 ? (
                <Card className="border border-gray-200 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <GitPullRequest className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No pull requests found</h3>
                    <p className="text-gray-600">
                      {selectedRepo === 'all' 
                        ? 'No pull requests match your search criteria'
                        : 'No pull requests found in selected repository'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4" 
                  : "space-y-3"
                }>
                  {filteredPRs.map(pr => 
                    viewMode === 'grid' ? renderCompactPRCard(pr) : renderCompactListItem(pr)
                  )}
                </div>
              )}
            </div>

            {/* Latest PRs Sidebar - Takes 1/3 width */}
            <div className="space-y-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Latest PRs
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {latestPRs.length === 0 ? (
                    <div className="text-center py-8">
                      <GitPullRequest className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">No recent PRs</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {latestPRs.map((pr, index) => renderLatestPRItem(pr, index))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
} 