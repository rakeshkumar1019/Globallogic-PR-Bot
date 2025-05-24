"use client"

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitHubClient, Repository, UserProfile } from '@/lib/github/api';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { ManageRepos } from '@/components/dashboard/manage-repos';

export function RepositoriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      loadInitialData();
    }
  }, [status, session, loadInitialData]);

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
      <SidebarLayout title="Repositories">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">Loading Repositories</h3>
              <p className="text-sm text-gray-600">Fetching your repositories...</p>
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
    { label: "Repositories", href: "/repositories" }
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

        <ManageRepos
          repositories={repositories}
          selectedRepos={selectedRepos}
          onToggleRepo={toggleRepo}
        />
      </div>
    </SidebarLayout>
  );
} 