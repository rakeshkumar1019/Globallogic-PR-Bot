interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class APICache {
  private cache = new Map<string, CacheItem<unknown>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = ttl || this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (now - item.timestamp > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Create cache key from parameters
  createKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }
}

export const apiCache = new APICache();

// Cache TTL constants
export const CACHE_TTL = {
  USER_PROFILE: 10 * 60 * 1000, // 10 minutes
  REPOSITORIES: 5 * 60 * 1000,  // 5 minutes
  PULL_REQUESTS: 2 * 60 * 1000, // 2 minutes
  PR_DETAILS: 5 * 60 * 1000,    // 5 minutes
  PR_FILES: 5 * 60 * 1000,      // 5 minutes
} as const; 