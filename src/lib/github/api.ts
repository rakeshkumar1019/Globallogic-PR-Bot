import { apiCache, CACHE_TTL } from '../cache';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  default_branch: string;
  updated_at?: string;
  language?: string;
  stargazers_count?: number;
}

export interface UserProfile {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface PullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  base: {
    ref: string;
    sha: string;
    repo: Repository;
  };
  head: {
    ref: string;
    sha: string;
    repo: Repository;
  };
  changed_files: number;
  additions: number;
  deletions: number;
  mergeable: boolean;
  mergeable_state: string;
  merged: boolean;
  draft: boolean;
}

export interface PullRequestFilters {
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface PullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
}

export interface PullRequestComment {
  id: number;
  url: string;
  html_url: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  body: string;
  path?: string;
  position?: number;
  line?: number;
  commit_id?: string;
}

export class GitHubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${error}`);
    }

    return response.json();
  }

  async getUserProfile(): Promise<UserProfile> {
    const cacheKey = `user_profile:${this.accessToken.slice(-8)}`;
    
    // Check cache first
    const cached = apiCache.get<UserProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.request<UserProfile>('/user');
    apiCache.set(cacheKey, profile, CACHE_TTL.USER_PROFILE);
    return profile;
  }

  async getUserRepositories(): Promise<Repository[]> {
    const cacheKey = `user_repositories:${this.accessToken.slice(-8)}`;
    
    // Check cache first
    const cached = apiCache.get<Repository[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get user's own repositories
      const userRepos = await this.request<Repository[]>('/user/repos?per_page=100&sort=updated');
      
      // Get organization repositories
      const orgs = await this.request<{login: string}[]>('/user/orgs');
      const orgRepos: Repository[] = [];
      
      for (const org of orgs) {
        try {
          const repos = await this.request<Repository[]>(`/orgs/${org.login}/repos?per_page=100&sort=updated`);
          orgRepos.push(...repos);
        } catch (err) {
          console.warn(`Failed to fetch repos for org ${org.login}:`, err);
        }
      }
      
      // Combine and deduplicate repositories
      const allRepos = [...userRepos, ...orgRepos];
      const uniqueRepos = allRepos.filter((repo, index, self) => 
        index === self.findIndex(r => r.id === repo.id)
      );
      
      const sortedRepos = uniqueRepos.sort((a, b) => 
        new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
      );

      apiCache.set(cacheKey, sortedRepos, CACHE_TTL.REPOSITORIES);
      return sortedRepos;
    } catch (err) {
      console.error('Error fetching repositories:', err);
      return [];
    }
  }

  async getRepositoryPullRequests(owner?: string, repo?: string, options: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<{
    pullRequests: PullRequest[];
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const cacheKey = apiCache.createKey('pull_requests', {
      owner: owner || 'all',
      repo: repo || 'all',
      ...options,
      token: this.accessToken.slice(-8)
    });

    // Check cache first
    const cached = apiCache.get<{
      pullRequests: PullRequest[];
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let pullRequests: PullRequest[] = [];
      let totalCount = 0;

      if (owner && repo) {
        // Get PRs from specific repository
        const params = new URLSearchParams({
          state: options.state || 'open',
          sort: options.sort || 'updated',
          direction: options.direction || 'desc',
          per_page: String(options.per_page || 10),
          page: String(options.page || 1),
        });

        const response = await this.request<PullRequest[]>(`/repos/${owner}/${repo}/pulls?${params}`);
        pullRequests = response.map(pr => ({
          ...pr,
          changed_files: pr.changed_files || 0,
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
          mergeable: pr.mergeable || false,
          mergeable_state: pr.mergeable_state || 'unknown',
          merged: pr.merged || false,
          draft: pr.draft || false,
        }));
        totalCount = pullRequests.length;
      } else {
        // Get all PRs where user is mentioned or requested as reviewer
        const userProfile = await this.getUserProfile();
        const repos = await this.getUserRepositories();
        
        // Get PRs from all accessible repositories
        for (const repository of repos.slice(0, 20)) { // Limit to first 20 repos to avoid rate limiting
          try {
            const [repoOwner, repoName] = repository.full_name.split('/');
            const prParams = new URLSearchParams({
              state: 'open',
              sort: 'updated',
              direction: 'desc',
              per_page: '10',
            });

            const repoResponse = await this.request<PullRequest[]>(`/repos/${repoOwner}/${repoName}/pulls?${prParams}`);
            
            // Filter PRs where user is requested as reviewer or mentioned
            const relevantPRs = repoResponse.filter(pr => {
              // For now, include all open PRs from accessible repos
              // In a real implementation, you'd check review requests
              return pr.state === 'open' && pr.user.login !== userProfile.login;
            });

            pullRequests.push(...relevantPRs.map(pr => ({
              ...pr,
              changed_files: pr.changed_files || 0,
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
              mergeable: pr.mergeable || false,
              mergeable_state: pr.mergeable_state || 'unknown',
              merged: pr.merged || false,
              draft: pr.draft || false,
            })));
          } catch (err) {
            console.warn(`Failed to fetch PRs for ${repository.full_name}:`, err);
          }
        }

        // Sort by updated date
        pullRequests.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        // Apply pagination
        const perPage = options.per_page || 10;
        const page = options.page || 1;
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        
        totalCount = pullRequests.length;
        pullRequests = pullRequests.slice(startIndex, endIndex);
      }

      const perPage = options.per_page || 10;
      const currentPage = options.page || 1;

      const result = {
        pullRequests,
        totalCount,
        hasNext: currentPage * perPage < totalCount,
        hasPrev: currentPage > 1,
      };

      apiCache.set(cacheKey, result, CACHE_TTL.PULL_REQUESTS);
      return result;
    } catch (err) {
      console.error('Error fetching pull requests:', err);
    return {
        pullRequests: [],
        totalCount: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  }

  async searchRepositories(query: string): Promise<Repository[]> {
    if (!query.trim()) {
      return this.getUserRepositories();
    }

    const userRepos = await this.getUserRepositories();
    return userRepos.filter(repo => 
      repo.name.toLowerCase().includes(query.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(query.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const cacheKey = `pr_detail:${owner}:${repo}:${number}:${this.accessToken.slice(-8)}`;
    
    // Check cache first
    const cached = apiCache.get<PullRequest>(cacheKey);
    if (cached) {
      return cached;
    }

    const pr = await this.request<PullRequest>(`/repos/${owner}/${repo}/pulls/${number}`);
    const enhancedPr = {
      ...pr,
      changed_files: pr.changed_files || 0,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      mergeable: pr.mergeable || false,
      mergeable_state: pr.mergeable_state || 'unknown',
      merged: pr.merged || false,
      draft: pr.draft || false,
    };
    
    apiCache.set(cacheKey, enhancedPr, CACHE_TTL.PULL_REQUESTS);
    return enhancedPr;
  }

  async getPullRequestFiles(owner: string, repo: string, number: number): Promise<PullRequestFile[]> {
    const cacheKey = `pr_files:${owner}:${repo}:${number}:${this.accessToken.slice(-8)}`;
    
    // Check cache first
    const cached = apiCache.get<PullRequestFile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const files = await this.request<PullRequestFile[]>(`/repos/${owner}/${repo}/pulls/${number}/files`);
    apiCache.set(cacheKey, files, CACHE_TTL.PULL_REQUESTS);
    return files;
  }

  async getPullRequestComments(owner: string, repo: string, number: number): Promise<PullRequestComment[]> {
    const cacheKey = `pr_comments:${owner}:${repo}:${number}:${this.accessToken.slice(-8)}`;
    
    // Check cache first
    const cached = apiCache.get<PullRequestComment[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get both review comments and issue comments
    const [reviewComments, issueComments] = await Promise.all([
      this.request<PullRequestComment[]>(`/repos/${owner}/${repo}/pulls/${number}/comments`),
      this.request<PullRequestComment[]>(`/repos/${owner}/${repo}/issues/${number}/comments`)
    ]);

    const allComments = [...reviewComments, ...issueComments]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    apiCache.set(cacheKey, allComments, CACHE_TTL.PULL_REQUESTS);
    return allComments;
  }
} 