import { Octokit } from 'octokit';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
}

export interface UserProfile {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  draft?: boolean;
}

export interface PullRequestFilters {
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  async getUserProfile(): Promise<UserProfile> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return data as UserProfile;
  }

  async getUserRepositories(): Promise<Repository[]> {
    const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    return data as Repository[];
  }

  async getRepositoryPullRequests(
    owner: string,
    repo: string,
    filters: PullRequestFilters = {}
  ): Promise<{ pullRequests: PullRequest[]; totalCount: number; hasNext: boolean; hasPrev: boolean }> {
    const {
      state = 'all',
      sort = 'updated',
      direction = 'desc',
      per_page = 10,
      page = 1
    } = filters;

    const { data, headers } = await this.octokit.rest.pulls.list({
      owner,
      repo,
      state,
      sort,
      direction,
      per_page,
      page,
    });

    // Parse pagination info from headers
    const linkHeader = headers.link || '';
    const hasNext = linkHeader.includes('rel="next"');
    const hasPrev = linkHeader.includes('rel="prev"');

    return {
      pullRequests: data.map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state as 'open' | 'closed',
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        user: {
          login: pr.user?.login || '',
          avatar_url: pr.user?.avatar_url || ''
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        },
        draft: pr.draft
      })),
      totalCount: data.length,
      hasNext,
      hasPrev
    };
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
} 