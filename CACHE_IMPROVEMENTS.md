# Cache Improvements for Repository PRs and LLM Selection

## Issues Resolved

### 1. New Repository PRs Not Visible Due to Caching
**Problem:** When users added a new repository to their starred list, the PRs from that repository were not immediately visible due to aggressive caching.

**Solution Implemented:**
- Enhanced cache invalidation strategy in `useToggleRepo()` hook
- Created `CacheManager` class for centralized cache management
- Improved query invalidation to refresh all PR-related data when repositories change
- Added prefetching for newly added repositories
- Reduced stale time for PR queries from 15 minutes to 5 minutes for better responsiveness
- Immediate refetch of critical data after repository changes

**Files Modified:**
- `src/lib/query/github-queries.ts` - Enhanced `useToggleRepo()` with better cache invalidation
- `src/lib/query/cache-utils.ts` - New cache management utilities
- `src/components/dashboard/overview.tsx` - Improved cache prioritization logic

### 2. LLM Selection Loading Every Time
**Problem:** LLM provider selection was not cached, causing users to re-select their preferred provider on every page visit.

**Solution Implemented:**
- Created `useLLMProviderCache()` hook to persist LLM provider selection in localStorage
- Automatic loading of cached provider selection on page load
- Graceful fallback to default provider if cache is invalid
- Smart provider switching based on configured providers

**Files Modified:**
- `src/lib/hooks/useLLMProviderCache.ts` - New hook for LLM provider caching
- `src/app/pull-request/review/[owner]/[repo]/[number]/page.tsx` - Integrated cached provider selection

## Technical Details

### Cache Management Strategy
1. **Immediate Cache Updates:** Optimistic updates for better UX
2. **Smart Invalidation:** Targeted invalidation of affected queries only
3. **Background Refresh:** Automatic refetch of data after changes
4. **Prefetching:** Proactive loading of data for newly added repositories

### LLM Provider Persistence
1. **localStorage Integration:** Persistent storage across sessions
2. **Type Safety:** Strict validation of cached provider values
3. **Error Handling:** Graceful degradation when localStorage is unavailable
4. **Auto-Selection:** Smart selection of configured providers

## Performance Improvements
- Reduced cache stale time for PR queries (15min → 5min)
- Immediate data refresh after repository changes
- Prefetching for better perceived performance
- Eliminated redundant provider configuration checks

## User Experience Improvements
- PRs from newly added repositories appear immediately
- LLM provider selection persists across page visits
- Reduced loading states and better responsiveness
- Smoother repository management workflow 