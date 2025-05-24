"use client"

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitPullRequest } from 'lucide-react';
import { GitHubClient, Repository, UserProfile, PullRequest } from '@/lib/github/api';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { PullRequests } from '@/components/dashboard/pull-requests';

type FilterType = 'all' | 'ready' | 'draft' | 'my-prs';

export function PullRequestsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  if (status === 'loading' || (loading && repositories.length === 0)) {
    return (
      <SidebarLayout title="Pull Requests">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">Loading Pull Requests</h3>
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

  const getBreadcrumbs = () => [
            { label: "Pull Requests", href: "/pull-request" }
  ];

  return (
    <SidebarLayout breadcrumbs={getBreadcrumbs()}>
      <div className="w-full">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {selectedRepos.size === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <GitPullRequest className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No repositories selected</h3>
            <p className="text-gray-600 mb-4">
              Select repositories first to view their pull requests.
            </p>
            <button
              onClick={() => router.push('/repositories')}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Manage Repositories
            </button>
          </div>
        ) : (
          <PullRequests
            pullRequests={pullRequests}
            userLogin={userProfile?.login}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        )}
      </div>
    </SidebarLayout>
  );
} 