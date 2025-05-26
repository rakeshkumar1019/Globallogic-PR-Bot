"use client"

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitHubClient, Repository, PullRequest } from '@/lib/github/api';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  GitPullRequest, Search, Filter, LayoutList, LayoutGrid, 
  Plus, Star, ChevronDown, Eye
} from 'lucide-react';
import Image from 'next/image';

type FilterType = 'all' | 'ready' | 'draft';
type ViewType = 'list' | 'grid';
type RepoFilterType = 'all' | string;

export function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [repoViewType, setRepoViewType] = useState<ViewType>('list');
  const [repoFilter, setRepoFilter] = useState<RepoFilterType>('all');

  const stats = useMemo(() => {
    const totalPRs = pullRequests.length;
    const readyForReview = pullRequests.filter(pr => !pr.draft && pr.state === 'open').length;
    const draftPRs = pullRequests.filter(pr => pr.draft).length;
    
    return { totalPRs, readyForReview, draftPRs };
  }, [pullRequests]);

  // Filter PRs based on active filter, repository filter, and search query
  const filteredPRs = useMemo(() => {
    let filtered = pullRequests;

    // Apply PR status filter
    switch (activeFilter) {
      case 'ready':
        filtered = filtered.filter(pr => !pr.draft && pr.state === 'open');
        break;
      case 'draft':
        filtered = filtered.filter(pr => pr.draft);
        break;
    }

    // Apply repository filter
    if (repoFilter === 'all') {
      // Show PRs from all selected repositories
      filtered = filtered.filter(pr => pr.base?.repo?.full_name && selectedRepos.has(pr.base.repo.full_name));
    } else {
      // Show PRs from specific repository
      filtered = filtered.filter(pr => pr.base?.repo?.full_name === repoFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pr => 
        pr.title.toLowerCase().includes(query) ||
        pr.user.login.toLowerCase().includes(query) ||
        (pr.base?.repo?.full_name && pr.base.repo.full_name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [pullRequests, activeFilter, repoFilter, selectedRepos, searchQuery]);

  // Filter repositories based on search query
  const filteredRepositories = useMemo(() => {
    if (!repoSearchQuery.trim()) return repositories;
    
    const query = repoSearchQuery.toLowerCase();
    return repositories.filter(repo => 
      repo.name.toLowerCase().includes(query) ||
      repo.full_name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query)) ||
      (repo.owner?.login && repo.owner.login.toLowerCase().includes(query))
    );
  }, [repositories, repoSearchQuery]);

  // Load starred repos from MongoDB
  const loadStarredRepos = useCallback(async () => {
    try {
      const response = await fetch('/api/starred-repos');
      if (response.ok) {
        const data = await response.json();
        setSelectedRepos(new Set(data.starredRepositories));
      }
    } catch (error) {
      console.error('Error loading starred repositories:', error);
    }
  }, []);

  // Save starred repos to MongoDB
  const saveStarredRepos = useCallback(async (repos: Set<string>) => {
    try {
      const response = await fetch('/api/starred-repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starredRepositories: Array.from(repos) })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save starred repositories');
      }
    } catch (error) {
      console.error('Error saving starred repositories:', error);
      setError('Failed to save repository selection');
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const github = new GitHubClient(session.accessToken);
      
      const repos = await github.getUserRepositories();
      
      setRepositories(repos);
      
      await loadStarredRepos();
    } catch (err) {
      console.error('Error loading GitHub data:', err);
      setError('Failed to load GitHub data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, loadStarredRepos]);

  const loadPullRequests = useCallback(async () => {
    if (!session?.accessToken || selectedRepos.size === 0) {
      setPullRequests([]);
      return;
    }

    setLoading(true);
    
    try {
      const github = new GitHubClient(session.accessToken);
      const allPRs: PullRequest[] = [];
      
      const selectedRepoList = repositories.filter(repo => selectedRepos.has(repo.full_name));
      
      for (const repo of selectedRepoList) {
        const [owner, repoName] = repo.full_name.split('/');
        if (owner && repoName) {
          try {
            const result = await github.getRepositoryPullRequests(owner, repoName, {
              state: 'open',
              sort: 'updated',
              direction: 'desc',
              per_page: 20
            });
            allPRs.push(...result.pullRequests);
          } catch (error) {
            console.warn(`Failed to load PRs for ${repo.full_name}:`, error);
          }
        }
      }
      
      allPRs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setPullRequests(allPRs);
    } catch (err) {
      console.error('Error loading pull requests:', err);
      setError('Failed to load pull requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, selectedRepos, repositories]);

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      loadInitialData();
    }
  }, [status, session, loadInitialData]);

  useEffect(() => {
    if (repositories.length > 0 && selectedRepos.size > 0) {
      loadPullRequests();
    }
    
    // Reset repository filter if current selection is no longer valid
    if (repoFilter !== 'all' && !selectedRepos.has(repoFilter)) {
      setRepoFilter('all');
    }
  }, [selectedRepos, repositories, loadPullRequests, repoFilter]);

  const toggleRepo = useCallback(async (repoFullName: string) => {
    const newSelectedRepos = new Set(selectedRepos);
    if (newSelectedRepos.has(repoFullName)) {
      newSelectedRepos.delete(repoFullName);
    } else {
      newSelectedRepos.add(repoFullName);
    }
    
    setSelectedRepos(newSelectedRepos);
    await saveStarredRepos(newSelectedRepos);
  }, [selectedRepos, saveStarredRepos]);

  // Helper functions
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

  const getPRStatusColor = (pr: PullRequest): string => {
    if (pr.draft) return 'bg-gray-500';
    if (pr.state === 'open') return 'bg-green-600';
    return 'bg-purple-600';
  };

  const handlePRClick = (pr: PullRequest) => {
    router.push(`/pull-request/review/${pr.base?.repo?.owner?.login}/${pr.base?.repo?.name}/${pr.number}`);
  };

  if (status === 'loading' || (loading && repositories.length === 0)) {
    return (
      <SidebarLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">Loading Dashboard</h3>
              <p className="text-sm text-gray-600">Fetching your repositories and pull requests...</p>
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <SidebarLayout breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}>
      <div className="w-full space-y-4">
        {/* Error Display */}
        {error && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Header with Stats */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pull Requests</h1>
            <p className="text-gray-600 text-sm">Track and review pull requests from your selected repositories</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-green-600 rounded-full"></div>
                <span className="text-gray-700 text-xs">{stats.readyForReview} Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-gray-500 rounded-full"></div>
                <span className="text-gray-700 text-xs">{stats.draftPRs} Draft</span>
              </div>

            </div>
          </div>
        </div>

        {/* Repository Selector - Light theme professional design */}
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div 
              className="p-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setShowRepoSelector(!showRepoSelector)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="h-4 w-4 text-gray-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">Select Repositories</h3>
                    <p className="text-xs text-gray-600">{selectedRepos.size} of {repositories.length} selected</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-600 hover:text-gray-900 p-1 h-auto"
                  >
                    {showRepoSelector ? 'Hide' : 'Manage'}
                  </Button>
                  <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform duration-200 ${showRepoSelector ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {showRepoSelector && (
              <div className="p-3 bg-white">
                {/* Repository Controls */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        placeholder="Search repositories..."
                        value={repoSearchQuery}
                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                        className="pl-9 h-8 text-sm border-gray-300"
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {filteredRepositories.length} repos
                    </div>
                  </div>

                  {/* View Toggle */}
                  <div className="flex items-center border border-gray-200 rounded-md p-0.5">
                    <Button
                      variant={repoViewType === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setRepoViewType('list')}
                      className="h-6 w-6 p-0"
                    >
                      <LayoutList className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={repoViewType === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setRepoViewType('grid')}
                      className="h-6 w-6 p-0"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Repository List */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredRepositories.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">{repoSearchQuery.trim() ? `No repositories match "${repoSearchQuery}"` : 'No repositories found'}</p>
                    </div>
                  ) : (
                    <div className={`${
                      repoViewType === 'grid' 
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2' 
                        : 'space-y-1'
                    }`}>
                      {filteredRepositories.map((repo) => (
                        <div
                          key={repo.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            repoViewType === 'list'
                              ? `flex items-center gap-2.5 p-2.5 border rounded-md ${
                                  selectedRepos.has(repo.full_name)
                                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                                }`
                              : `p-2.5 border rounded-md ${
                                  selectedRepos.has(repo.full_name)
                                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                                }`
                          }`}
                          onClick={() => toggleRepo(repo.full_name)}
                        >
                          {repoViewType === 'list' ? (
                            // List View
                            <>
                              <Image 
                                src={repo.owner?.avatar_url || '/default-avatar.png'} 
                                alt={repo.owner?.login || 'Repository'}
                                width={24}
                                height={24}
                                className="rounded-full flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium text-sm truncate ${
                                    selectedRepos.has(repo.full_name) ? 'text-blue-900' : 'text-gray-900'
                                  }`}>
                                    {repo.name}
                                  </p>
                                  {repo.private && (
                                    <Badge variant="outline" className={`text-xs ${
                                      selectedRepos.has(repo.full_name) 
                                        ? 'border-blue-400 text-blue-700' 
                                        : 'border-gray-400 text-gray-600'
                                    }`}>
                                      Private
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-xs truncate ${
                                  selectedRepos.has(repo.full_name) ? 'text-blue-700' : 'text-gray-500'
                                }`}>
                                  {repo.owner?.login} • ⭐ {repo.stargazers_count || 0}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedRepos.has(repo.full_name) ? (
                                  <Star className="h-4 w-4 text-blue-600 fill-blue-600" />
                                ) : (
                                  <Star className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </>
                          ) : (
                            // Grid View
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Image 
                                  src={repo.owner?.avatar_url || '/default-avatar.png'} 
                                  alt={repo.owner?.login || 'Repository'}
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                />
                                {selectedRepos.has(repo.full_name) ? (
                                  <Star className="h-4 w-4 text-blue-600 fill-blue-600" />
                                ) : (
                                  <Star className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <p className={`font-medium text-xs truncate ${
                                    selectedRepos.has(repo.full_name) ? 'text-blue-900' : 'text-gray-900'
                                  }`}>
                                    {repo.name}
                                  </p>
                                  {repo.private && (
                                    <Badge variant="outline" className={`text-xs ${
                                      selectedRepos.has(repo.full_name) 
                                        ? 'border-blue-400 text-blue-700' 
                                        : 'border-gray-400 text-gray-600'
                                    }`}>
                                      Private
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-xs truncate ${
                                  selectedRepos.has(repo.full_name) ? 'text-blue-700' : 'text-gray-500'
                                }`}>
                                  {repo.owner?.login}
                                </p>
                                <p className={`text-xs ${
                                  selectedRepos.has(repo.full_name) ? 'text-blue-600' : 'text-gray-500'
                                }`}>
                                  ⭐ {repo.stargazers_count || 0}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>


              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search pull requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>

            {/* PR Status Filter */}
            <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as FilterType)}>
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PRs</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            {/* Repository Filter - Only show if repositories are selected */}
            {selectedRepos.size > 0 && (
              <Select value={repoFilter} onValueChange={(value) => setRepoFilter(value as RepoFilterType)}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <Star className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder="Select repo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Repos</SelectItem>
                  {Array.from(selectedRepos).map((repoFullName) => {
                    const repo = repositories.find(r => r.full_name === repoFullName);
                    return (
                      <SelectItem key={repoFullName} value={repoFullName}>
                        {repo?.name || repoFullName.split('/')[1]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center border border-gray-200 rounded-md p-0.5">
            <Button
              variant={viewType === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('list')}
              className="h-6 w-6 p-0"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewType === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('grid')}
              className="h-6 w-6 p-0"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Pull Requests Content */}
        {selectedRepos.size === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-center">
              <Star className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No repositories selected</h3>
              <p className="text-gray-600 mb-4 text-sm">Select repositories to start tracking their pull requests</p>
              <Button onClick={() => setShowRepoSelector(true)} size="sm">
                <Plus className="h-3.5 w-3.5 mr-2" />
                Select Repositories
              </Button>
            </CardContent>
          </Card>
        ) : filteredPRs.length === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="p-8 text-center">
              <GitPullRequest className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No pull requests found</h3>
              <p className="text-gray-600 text-sm">
                {searchQuery.trim() 
                  ? `No pull requests match "${searchQuery}"`
                  : "No open pull requests in your selected repositories"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={`${
            viewType === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' 
              : 'space-y-2'
          }`}>
            {filteredPRs.map((pr) => (
              <Card 
                key={pr.id} 
                className="border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                onClick={() => handlePRClick(pr)}
              >
                <CardContent className={`${viewType === 'grid' ? 'p-3' : 'p-3'}`}>
                  {viewType === 'list' ? (
                    // List View
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPRStatusColor(pr)}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 text-sm">{pr.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                              <span className="font-medium">#{pr.number}</span>
                              <span>•</span>
                              <span className="truncate">{pr.base?.repo?.full_name}</span>
                              {pr.draft && (
                                <>
                                  <span>•</span>
                                  <Badge variant="secondary" className="text-xs py-0 px-1.5">Draft</Badge>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                                  <AvatarFallback className="text-xs">{pr.user.login[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                              <Eye className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Grid View
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getPRStatusColor(pr)}`}></div>
                        {pr.draft && <Badge variant="secondary" className="text-xs py-0 px-1.5">Draft</Badge>}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1.5 line-clamp-3 text-sm">{pr.title}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                          <span className="font-medium">#{pr.number}</span>
                          <span>•</span>
                          <span className="truncate">{pr.base?.repo?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                            <AvatarFallback className="text-xs">{pr.user.login[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-600">{pr.user.login}</span>
                        </div>
                        <span className="text-xs text-gray-500">{getTimeAgo(pr.updated_at)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <Button variant="outline" size="sm" className="w-full text-xs h-6">
                          <Eye className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {loading && pullRequests.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600 text-sm">Loading more pull requests...</span>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
} 