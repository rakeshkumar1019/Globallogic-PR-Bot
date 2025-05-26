import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './github-queries'

/**
 * Utility functions for managing cache invalidation when repositories are added/removed
 */
export class CacheManager {
  constructor(private queryClient: QueryClient) {}

  /**
   * Invalidate and refresh all PR-related queries when repositories change
   */
  async refreshPRData(repoFullName?: string) {
    // Invalidate starred repos PRs
    this.queryClient.invalidateQueries({ queryKey: queryKeys.repoStarredPRs })
    
    // Invalidate all pull request stable queries
    this.queryClient.invalidateQueries({ 
      queryKey: ['pull-requests-stable'],
      exact: false 
    })
    
    // If specific repo provided, invalidate its specific queries
    if (repoFullName) {
      const [owner, repo] = repoFullName.split('/')
      if (owner && repo) {
        this.queryClient.invalidateQueries({ 
          queryKey: queryKeys.pullRequestsForRepo(owner, repo),
          exact: false 
        })
      }
    }
    
    // Refresh repositories to get latest data
    this.queryClient.invalidateQueries({ queryKey: queryKeys.repositories })
    
    // Force immediate refetch of critical data
    setTimeout(async () => {
      try {
        await Promise.all([
          this.queryClient.refetchQueries({ queryKey: queryKeys.repoStarredPRs }),
          this.queryClient.refetchQueries({ 
            queryKey: ['pull-requests-stable'],
            exact: false 
          })
        ])
      } catch (error) {
        console.warn('Error during cache refresh:', error)
      }
    }, 100)
  }

  /**
   * Clear all GitHub-related cache data
   */
  clearGitHubCache() {
    this.queryClient.invalidateQueries({ queryKey: queryKeys.repositories })
    this.queryClient.invalidateQueries({ queryKey: queryKeys.starredRepos })
    this.queryClient.invalidateQueries({ queryKey: queryKeys.repoStarredPRs })
    this.queryClient.invalidateQueries({ 
      queryKey: ['pull-requests-stable'],
      exact: false 
    })
  }

  /**
   * Prefetch data for newly added repository
   */
  async prefetchRepositoryData(repoFullName: string) {
    const [owner, repo] = repoFullName.split('/')
    if (!owner || !repo) return

    try {
      // Prefetch PRs for the new repository
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.pullRequestsForRepo(owner, repo),
        staleTime: 0 // Force fresh fetch
      })
    } catch (error) {
      console.warn(`Failed to prefetch data for ${repoFullName}:`, error)
    }
  }
}

/**
 * Create a cache manager instance
 */
export const createCacheManager = (queryClient: QueryClient) => new CacheManager(queryClient) 