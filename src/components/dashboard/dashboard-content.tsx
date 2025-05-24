"use client"

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GitHubClient, Repository, UserProfile, PullRequest } from '@/lib/github/api';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { Overview } from '@/components/dashboard/overview';
import { PullRequests } from '@/components/dashboard/pull-requests';
import { ManageRepos } from '@/components/dashboard/manage-repos';

type FilterType = 'all' | 'ready' | 'draft' | 'my-prs';

export function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Get current view from URL params
  const currentView = searchParams.get('view') || 'overview';
  const urlFilter = searchParams.get('filter') as FilterType;
  
  // Update filter based on URL params
  useEffect(() => {
    if (urlFilter && ['all', 'ready', 'draft', 'my-prs'].includes(urlFilter)) {
      setActiveFilter(urlFilter);
    }
  }, [urlFilter]);

  const stats = useMemo(() => {
    const totalPRs = pullRequests.length;
    const readyForReview = pullRequests.filter(pr => !pr.draft && pr.state === 'open').length;
    const draftPRs = pullRequests.filter(pr => pr.draft).length;
    const myPRs = pullRequests.filter(pr => pr.user.login === userProfile?.login).length;
    
    return { totalPRs, readyForReview, draftPRs, myPRs };
  }, [pullRequests, userProfile?.login]);

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

  // Render appropriate view based on currentView
  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return (
          <Overview 
            stats={stats}
            selectedRepos={selectedRepos}
            repositories={repositories}
            pullRequests={pullRequests}
            userProfile={userProfile}
            onToggleRepo={toggleRepo}
          />
        );
      case 'pull-requests':
        return (
          <PullRequests
            pullRequests={pullRequests}
            userLogin={userProfile?.login}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        );
      case 'manage-repos':
        return (
          <ManageRepos
            repositories={repositories}
            selectedRepos={selectedRepos}
            onToggleRepo={toggleRepo}
          />
        );
      default:
        return (
          <Overview 
            stats={stats}
            selectedRepos={selectedRepos}
            repositories={repositories}
            pullRequests={pullRequests}
            userProfile={userProfile}
            onToggleRepo={toggleRepo}
          />
        );
    }
  };

  const getBreadcrumbs = () => {
    const baseBreadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];
    
    switch (currentView) {
      case 'pull-requests':
        return [...baseBreadcrumbs, { label: "Pull Requests" }];
      case 'manage-repos':
        return [...baseBreadcrumbs, { label: "Manage Repositories" }];
      case 'overview':
      default:
        return [...baseBreadcrumbs, { label: "Overview" }];
    }
  };

  return (
    <SidebarLayout breadcrumbs={getBreadcrumbs()}>
      <div className="w-full">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {renderCurrentView()}
      </div>
    </SidebarLayout>
  );
} 