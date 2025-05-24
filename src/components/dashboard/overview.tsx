"use client"

import { Card, CardContent } from '@/components/ui/card';
import { Repository, PullRequest, UserProfile } from '@/lib/github/api';
import { useEffect, useState } from 'react';
import { 
  GitPullRequest,
  Clock,
  Users,
  TrendingUp,
  Star,
  Lock,
  Plus
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

export function Overview({ stats, selectedRepos, repositories, pullRequests }: OverviewProps) {
  const [cachedRepos, setCachedRepos] = useState<Repository[]>([]);
  const [cachedPRs, setCachedPRs] = useState<PullRequest[]>([]);

  // Load from cache and update cache when data changes
  useEffect(() => {
    const cached = getCachedData(CACHE_KEYS.REPOSITORIES);
    if (cached && repositories.length === 0) {
      setCachedRepos(cached);
    } else if (repositories.length > 0) {
      setCachedRepos(repositories);
      setCachedData(CACHE_KEYS.REPOSITORIES, repositories);
    }
  }, [repositories]);

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

      {/* Two Column Layout with Equal Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Starred Repositories - Left Column */}
        <Card className="border border-gray-300 shadow-sm rounded-lg h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 bg-gray-900 border border-gray-900 rounded-lg flex items-center justify-center">
                <Star className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Starred Repositories</h2>
                <p className="text-sm text-gray-600">{selectedRepos.size} of {(repositories.length > 0 ? repositories : cachedRepos).length} repositories</p>
              </div>
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
                        <img 
                          src={repo.owner?.avatar_url || '/default-avatar.png'} 
                          alt={repo.owner?.login || 'Repository'}
                          className="w-10 h-10 border border-gray-300 rounded-lg flex-shrink-0"
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
                    <div key={pr.id} className="p-3 hover:bg-gray-50 transition-colors cursor-pointer">
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
                                  <img 
                                    src={pr.user.avatar_url} 
                                    alt={pr.user.login}
                                    className="w-5 h-5 border border-gray-300 rounded-full"
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
    </div>
  );
} 