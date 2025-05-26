import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { GitHubClient, Repository, PullRequest, UserProfile } from '../github/api'

// Query keys for consistent caching
export const queryKeys = {
  user: ['user'] as const,
  repositories: ['repositories'] as const,
  starredRepos: ['starred-repos'] as const,
  pullRequests: (repos?: string[]) => ['pull-requests', repos] as const,
  pullRequestsForRepo: (owner: string, repo: string, options?: Record<string, unknown>) => 
    ['pull-requests', owner, repo, options] as const,
  pullRequestDetail: (owner: string, repo: string, number: number) => 
    ['pull-request-detail', owner, repo, number] as const,
  pullRequestFiles: (owner: string, repo: string, number: number) => 
    ['pull-request-files', owner, repo, number] as const,
  pullRequestComments: (owner: string, repo: string, number: number) => 
    ['pull-request-comments', owner, repo, number] as const,
  settings: (user: string) => ['settings', user] as const,
  repoStarredPRs: ['repo-starred-prs'] as const,
}

// Hook to get user profile
export function useUserProfile() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async (): Promise<UserProfile> => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getUserProfile()
    },
    enabled: !!session?.accessToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Hook to get user repositories
export function useRepositories() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.repositories,
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getUserRepositories()
    },
    enabled: !!session?.accessToken,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get starred repositories
export function useStarredRepos() {
  return useQuery({
    queryKey: queryKeys.starredRepos,
    queryFn: async (): Promise<Set<string>> => {
      const response = await fetch('/api/starred-repos')
      if (!response.ok) throw new Error('Failed to fetch starred repos')
      const data = await response.json()
      return new Set<string>(data.starredRepositories)
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get pull requests for selected repositories
export function usePullRequests(selectedRepos: Set<string>, repositories: Repository[]) {
  const { data: session } = useSession()
  
  // Create a stable, sorted list of selected repos for consistent caching
  const selectedReposList = Array.from(selectedRepos).sort()
  const selectedReposKey = selectedReposList.join('|') || 'none'

  return useQuery({
    queryKey: ['pull-requests-stable', selectedReposKey],
    queryFn: async () => {
      if (!session?.accessToken || selectedRepos.size === 0) return []
      
      const github = new GitHubClient(session.accessToken)
      const allPRs: PullRequest[] = []
      
      const selectedRepoList = repositories.filter(repo => selectedRepos.has(repo.full_name))
      
      // Fetch PRs from each selected repository
      for (const repo of selectedRepoList) {
        const [owner, repoName] = repo.full_name.split('/')
        if (owner && repoName) {
          try {
            const result = await github.getRepositoryPullRequests(owner, repoName, {
              state: 'open',
              sort: 'updated',
              direction: 'desc',
              per_page: 20
            })
            allPRs.push(...result.pullRequests)
          } catch (error) {
            console.warn(`Failed to load PRs for ${repo.full_name}:`, error)
          }
        }
      }
      
      // Sort by updated date
      return allPRs.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    },
    enabled: !!session?.accessToken && selectedRepos.size > 0 && repositories.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes - longer cache for stability
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get pull requests for a specific repository
export function useRepositoryPullRequests(
  owner: string, 
  repo: string, 
  options: {
    state?: 'open' | 'closed' | 'all'
    sort?: 'created' | 'updated' | 'popularity'
    direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
  } = {}
) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.pullRequestsForRepo(owner, repo, options),
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getRepositoryPullRequests(owner, repo, options)
    },
    enabled: !!session?.accessToken && !!owner && !!repo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get user settings
export function useSettings(userEmail?: string) {
  return useQuery({
    queryKey: queryKeys.settings(userEmail || ''),
    queryFn: async () => {
      if (!userEmail) throw new Error('User email required')
      const response = await fetch(`/api/settings?user=${encodeURIComponent(userEmail)}`)
      if (!response.ok) throw new Error('Failed to fetch settings')
      return response.json()
    },
    enabled: !!userEmail,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Mutation to save starred repositories
export function useSaveStarredRepos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (starredRepos: Set<string>) => {
      const response = await fetch('/api/starred-repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starredRepositories: Array.from(starredRepos) })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save starred repositories')
      }
      
      return starredRepos
    },
    onSuccess: (data) => {
      // Update the cache with the new starred repos
      queryClient.setQueryData(queryKeys.starredRepos, data)
    },
    onError: (error) => {
      console.error('Error saving starred repositories:', error)
    }
  })
}

// Mutation to save user settings
export function useSaveSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userEmail, settings }: { userEmail: string; settings: Record<string, unknown> }) => {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userEmail, settings })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save settings')
      }
      
      return response.json()
    },
    onSuccess: (_data, variables) => {
      // Update the cache with the new settings
      queryClient.setQueryData(queryKeys.settings(variables.userEmail), variables.settings)
    },
    onError: (error) => {
      console.error('Error saving settings:', error)
    }
  })
}

// Hook to get pull request details for review page
export function usePullRequestDetail(owner: string, repo: string, number: number) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.pullRequestDetail(owner, repo, number),
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getPullRequest(owner, repo, number)
    },
    enabled: !!session?.accessToken && !!owner && !!repo && !!number,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get pull request files for review page
export function usePullRequestFiles(owner: string, repo: string, number: number) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.pullRequestFiles(owner, repo, number),
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getPullRequestFiles(owner, repo, number)
    },
    enabled: !!session?.accessToken && !!owner && !!repo && !!number,
    staleTime: 15 * 60 * 1000, // 15 minutes - files don't change often
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get pull request comments for review page
export function usePullRequestComments(owner: string, repo: string, number: number) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.pullRequestComments(owner, repo, number),
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No access token')
      const github = new GitHubClient(session.accessToken)
      return github.getPullRequestComments(owner, repo, number)
    },
    enabled: !!session?.accessToken && !!owner && !!repo && !!number,
    staleTime: 5 * 60 * 1000, // 5 minutes - comments change more frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to get PRs from all starred repositories (for dashboard optimization)
export function useStarredReposPullRequests() {
  const { data: session } = useSession()
  const { data: starredRepos = new Set<string>() } = useStarredRepos()
  const { data: repositories = [] } = useRepositories()

  return useQuery({
    queryKey: queryKeys.repoStarredPRs,
    queryFn: async () => {
      if (!session?.accessToken || starredRepos.size === 0) return []
      
      const github = new GitHubClient(session.accessToken)
      const allPRs: PullRequest[] = []
      
      const starredRepoList = repositories.filter(repo => starredRepos.has(repo.full_name))
      
      // Fetch PRs from each starred repository in parallel
      const prPromises = starredRepoList.map(async (repo) => {
        const [owner, repoName] = repo.full_name.split('/')
        if (owner && repoName) {
          try {
            const result = await github.getRepositoryPullRequests(owner, repoName, {
              state: 'open',
              sort: 'updated',
              direction: 'desc',
              per_page: 10 // Fewer PRs per repo for performance
            })
            return result.pullRequests.map(pr => ({ ...pr, _repoInfo: repo }))
          } catch (error) {
            console.warn(`Failed to load PRs for ${repo.full_name}:`, error)
            return []
          }
        }
        return []
      })
      
      const results = await Promise.all(prPromises)
      allPRs.push(...results.flat())
      
      // Sort by updated date
      return allPRs.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    },
    enabled: !!session?.accessToken && starredRepos.size > 0 && repositories.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

// Hook to toggle repository starred status
export function useToggleRepo() {
  const queryClient = useQueryClient()
  const saveStarredRepos = useSaveStarredRepos()

  return {
    toggleRepo: async (repoFullName: string) => {
      const currentStarredRepos = queryClient.getQueryData<Set<string>>(queryKeys.starredRepos) || new Set()
      const newStarredRepos = new Set(currentStarredRepos)
      
      if (newStarredRepos.has(repoFullName)) {
        newStarredRepos.delete(repoFullName)
      } else {
        newStarredRepos.add(repoFullName)
      }
      
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.starredRepos, newStarredRepos)
      
      // Also invalidate related PR queries
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStarredPRs })
      
      try {
        await saveStarredRepos.mutateAsync(newStarredRepos)
      } catch (error) {
        // Revert on error
        queryClient.setQueryData(queryKeys.starredRepos, currentStarredRepos)
        throw error
      }
    },
    isLoading: saveStarredRepos.isPending
  }
} 