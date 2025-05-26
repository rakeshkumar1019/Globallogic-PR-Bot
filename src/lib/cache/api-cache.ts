import { apiCache, CACHE_TTL } from '../cache';

// MongoDB caching utility for API routes
export class ApiCache {
  // Cache for starred repositories
  static async getStarredRepos(userEmail: string): Promise<string[] | null> {
    const cacheKey = `starred_repos:${userEmail}`;
    return apiCache.get<string[]>(cacheKey);
  }

  static setStarredRepos(userEmail: string, repos: string[]): void {
    const cacheKey = `starred_repos:${userEmail}`;
    apiCache.set(cacheKey, repos, CACHE_TTL.USER_PROFILE); // 30 minutes
  }

  static invalidateStarredRepos(userEmail: string): void {
    const cacheKey = `starred_repos:${userEmail}`;
    apiCache.delete(cacheKey);
  }

  // Cache for user settings
  static async getUserSettings(userEmail: string): Promise<Record<string, unknown> | null> {
    const cacheKey = `user_settings:${userEmail}`;
    return apiCache.get<Record<string, unknown>>(cacheKey);
  }

  static setUserSettings(userEmail: string, settings: Record<string, unknown>): void {
    const cacheKey = `user_settings:${userEmail}`;
    apiCache.set(cacheKey, settings, CACHE_TTL.USER_PROFILE); // 30 minutes
  }

  static invalidateUserSettings(userEmail: string): void {
    const cacheKey = `user_settings:${userEmail}`;
    apiCache.delete(cacheKey);
  }

  // Cache for AI reviews
  static async getAiReview(prKey: string): Promise<unknown | null> {
    const cacheKey = `ai_review:${prKey}`;
    return apiCache.get(cacheKey);
  }

  static setAiReview(prKey: string, review: unknown): void {
    const cacheKey = `ai_review:${prKey}`;
    apiCache.set(cacheKey, review, CACHE_TTL.PULL_REQUESTS); // 15 minutes
  }

  // General purpose MongoDB result caching
  static async getCachedResult<T>(
    operation: string, 
    params: Record<string, unknown>
  ): Promise<T | null> {
    const cacheKey = this.createKey(operation, params);
    return apiCache.get<T>(cacheKey);
  }

  static setCachedResult<T>(
    operation: string, 
    params: Record<string, unknown>, 
    result: T, 
    ttl: number = CACHE_TTL.USER_PROFILE
  ): void {
    const cacheKey = this.createKey(operation, params);
    apiCache.set(cacheKey, result, ttl);
  }

  static invalidateCachedResult(operation: string, params: Record<string, unknown>): void {
    const cacheKey = this.createKey(operation, params);
    apiCache.delete(cacheKey);
  }

  private static createKey(operation: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, unknown>);
    
    return `${operation}:${JSON.stringify(sortedParams)}`;
  }

  // Bulk cache invalidation
  static invalidateUserCache(userEmail: string): void {
    this.invalidateStarredRepos(userEmail);
    this.invalidateUserSettings(userEmail);
    // Add more user-specific cache invalidations as needed
  }

  // Clear all MongoDB caches
  static clearAllApiCaches(): void {
    // This would clear all caches - use with caution
    apiCache.clear();
  }
} 