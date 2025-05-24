'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitHubClient, Repository, UserProfile, PullRequest } from '@/lib/github/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/footer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Search, 
  Plus,
  Star,
  GitPullRequest,
  Clock,
  GitBranch,
  Users,
  TrendingUp,
  ExternalLink,
  Calendar,
  FileText
} from 'lucide-react';

type FilterType = 'all' | 'ready' | 'draft' | 'my-prs';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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

  const displayedRepositories = useMemo(() => {
    return repositories.filter(repo => selectedRepos.has(repo.full_name));
  }, [repositories, selectedRepos]);

  const filteredRepositories = useMemo(() => {
    if (!repoSearchQuery.trim()) return repositories;
    const query = repoSearchQuery.toLowerCase();
    return repositories.filter(repo =>
      repo.name.toLowerCase().includes(query) ||
      repo.full_name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  }, [repositories, repoSearchQuery]);

  const filteredPRs = useMemo(() => {
    let filtered = pullRequests;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.title.toLowerCase().includes(query) ||
        pr.user.login.toLowerCase().includes(query) ||
        pr.number.toString().includes(query) ||
        pr.base?.repo?.full_name?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    switch (activeFilter) {
      case 'ready':
        filtered = filtered.filter(pr => !pr.draft && pr.state === 'open');
        break;
      case 'draft':
        filtered = filtered.filter(pr => pr.draft);
        break;
      case 'my-prs':
        filtered = filtered.filter(pr => pr.user.login === userProfile?.login);
        break;
      default:
        break;
    }
    
    return filtered;
  }, [pullRequests, searchQuery, activeFilter, userProfile?.login]);

  const stats = useMemo(() => {
    const totalPRs = pullRequests.length;
    const readyForReview = pullRequests.filter(pr => !pr.draft && pr.state === 'open').length;
    const draftPRs = pullRequests.filter(pr => pr.draft).length;
    const myPRs = pullRequests.filter(pr => pr.user.login === userProfile?.login).length;
    
    return { totalPRs, readyForReview, draftPRs, myPRs };
  }, [pullRequests, userProfile?.login]);

  const loadInitialData = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

        try {
          const github = new GitHubClient(session.accessToken);
      
      const [profile, repos] = await Promise.all([
            github.getUserProfile(),
        github.getUserRepositories()
      ]);
      
      setUserProfile(profile);
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
  }, [selectedRepos, repositories, loadPullRequests]);

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

  const handlePRClick = useCallback((pr: PullRequest) => {
    const [owner, repo] = pr.base?.repo?.full_name?.split('/') || ['', ''];
    if (owner && repo) {
      router.push(`/dashboard/pr/${owner}/${repo}/${pr.number}`);
    }
  }, [router]);

  if (status === 'loading' || (loading && repositories.length === 0)) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">Loading Dashboard</h3>
              <p className="text-sm text-gray-600">Fetching your repositories and pull requests...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

    return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage and review pull requests across your repositories.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total PRs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalPRs}</p>
                </div>
                <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <GitPullRequest className="h-4 w-4 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ready for Review</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.readyForReview}</p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Draft PRs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.draftPRs}</p>
                </div>
                <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">My PRs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.myPRs}</p>
          </div>
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
        </div>
      </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
            </div>
        )}

        {/* Repository Selection */}
        {selectedRepos.size === 0 ? (
          <Card className="border border-gray-200 mb-8">
            <CardContent className="p-12 text-center">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                  <GitBranch className="h-6 w-6 text-gray-600" />
              </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-900">Select Repositories</h3>
                  <p className="text-gray-600">
                    Choose repositories to track their pull requests. Your selection will be saved automatically.
                  </p>
              </div>
                <Button 
                  onClick={() => setShowRepoSelector(true)}
                  disabled={repositories.length === 0}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {repositories.length === 0 ? 'Loading...' : 'Select Repositories'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 mb-8">
            {/* Repository Cards */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Selected Repositories ({selectedRepos.size})
              </h2>
              <Button 
                variant="outline" 
                onClick={() => setShowRepoSelector(true)}
                size="sm"
              >
                Manage
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedRepositories.map((repo) => (
                <Card key={repo.id} className="border border-gray-200 hover:border-gray-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">{repo.name}</h4>
                          <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
              </div>
                        <p className="text-xs text-gray-500 truncate mb-2">{repo.full_name}</p>
                        {repo.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-3">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {repo.private !== undefined && (
                            <Badge variant={repo.private ? "secondary" : "outline"} className="text-xs">
                              {repo.private ? 'Private' : 'Public'}
                            </Badge>
                          )}
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              {repo.language}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
          </CardContent>
        </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pull Requests Section */}
        {selectedRepos.size > 0 && (
          <div className="space-y-6">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-1">
                <Button
                  variant={activeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className={activeFilter === 'all' ? 'bg-black text-white hover:bg-gray-800' : ''}
                >
                  All ({pullRequests.length})
                </Button>
                <Button
                  variant={activeFilter === 'ready' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFilter('ready')}
                  className={activeFilter === 'ready' ? 'bg-black text-white hover:bg-gray-800' : ''}
                >
                  Ready ({stats.readyForReview})
                </Button>
                <Button
                  variant={activeFilter === 'draft' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFilter('draft')}
                  className={activeFilter === 'draft' ? 'bg-black text-white hover:bg-gray-800' : ''}
                >
                  Draft ({stats.draftPRs})
                </Button>
                <Button
                  variant={activeFilter === 'my-prs' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFilter('my-prs')}
                  className={activeFilter === 'my-prs' ? 'bg-black text-white hover:bg-gray-800' : ''}
                >
                  Mine ({stats.myPRs})
                </Button>
              </div>
              
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search pull requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Pull Requests List */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border border-gray-200">
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPRs.length === 0 ? (
              <Card className="border border-gray-200">
                <CardContent className="p-12 text-center">
                  <FileText className="h-8 w-8 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No pull requests found</h3>
                  <p className="text-gray-600">
                    {searchQuery.trim() 
                      ? 'No pull requests match your search criteria.'
                      : 'No open pull requests found in selected repositories.'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPRs.map((pr) => (
                  <Card 
                    key={pr.id} 
                    className="border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer group"
                    onClick={() => handlePRClick(pr)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900 group-hover:text-black transition-colors line-clamp-1">
                              {pr.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge variant={pr.state === 'open' ? 'outline' : 'secondary'}>
                                {pr.state}
                              </Badge>
                              {pr.draft && (
                                <Badge variant="secondary">Draft</Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                            <span>#{pr.number}</span>
                            <span>•</span>
                            <span className="truncate">{pr.base?.repo?.full_name}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <img 
                                src={pr.user.avatar_url} 
                                alt={pr.user.login}
                                className="h-4 w-4 rounded-full"
                              />
                              <span>{pr.user.login}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(pr.created_at).toLocaleDateString()}</span>
            </div>
                  </div>
                  
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {(pr.changed_files ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {pr.changed_files} files
                              </span>
                            )}
                            {((pr.additions ?? 0) > 0 || (pr.deletions ?? 0) > 0) && (
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">+{pr.additions ?? 0}</span>
                                <span className="text-red-600">-{pr.deletions ?? 0}</span>
                    </div>
                            )}
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                      ))}
                    </div>
            )}
          </div>
        )}
      </main>

      {/* Repository Selection Modal */}
      <Dialog open={showRepoSelector} onOpenChange={setShowRepoSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Repositories</DialogTitle>
            <DialogDescription>
              Choose repositories to track their pull requests on your dashboard.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search repositories..."
                value={repoSearchQuery}
                onChange={(e) => setRepoSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {filteredRepositories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No repositories found.</p>
                    </div>
                  ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRepositories.map((repo) => (
                    <Card 
                      key={repo.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedRepos.has(repo.full_name) 
                          ? 'border-black bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleRepo(repo.full_name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">{repo.name}</h4>
                              {selectedRepos.has(repo.full_name) && (
                                <Star className="h-3 w-3 text-black fill-current" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mb-2">{repo.full_name}</p>
                            {repo.description && (
                              <p className="text-xs text-gray-600 line-clamp-2">{repo.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      ))}
                    </div>
                  )}
                    </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRepos.size} repositories selected
              </span>
              <Button onClick={() => setShowRepoSelector(false)} className="bg-black hover:bg-gray-800">
                Done
              </Button>
        </div>
      </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
} 