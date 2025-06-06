import { PullRequest, Repository, UserProfile } from './github/api';
import { AIReviewComment } from './types';

export const demoUserProfile: UserProfile = {
  login: 'demo-user',
  id: 12345,
  avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
  name: 'Demo User',
  company: 'GlobalLogic',
  blog: 'https://blog.example.com',
  location: 'San Francisco, CA',
  email: 'demo@example.com',
  bio: 'Full-stack developer passionate about creating amazing user experiences',
  public_repos: 25,
  public_gists: 8,
  followers: 150,
  following: 75,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const demoRepositories: Repository[] = [
  {
    id: 1,
    name: 'react-dashboard',
    full_name: 'demo-user/react-dashboard',
    private: false,
    owner: {
      login: 'demo-user',
      id: 12345,
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    html_url: 'https://github.com/demo-user/react-dashboard',
    description: 'A modern React dashboard with TypeScript and Tailwind CSS',
    fork: false,
    url: 'https://api.github.com/repos/demo-user/react-dashboard',
    default_branch: 'main',
  },
  {
    id: 2,
    name: 'api-service',
    full_name: 'demo-user/api-service',
    private: false,
    owner: {
      login: 'demo-user',
      id: 12345,
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    html_url: 'https://github.com/demo-user/api-service',
    description: 'REST API service built with Node.js and Express',
    fork: false,
    url: 'https://api.github.com/repos/demo-user/api-service',
    default_branch: 'main',
  },
  {
    id: 3,
    name: 'mobile-app',
    full_name: 'demo-user/mobile-app',
    private: true,
    owner: {
      login: 'demo-user',
      id: 12345,
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    html_url: 'https://github.com/demo-user/mobile-app',
    description: 'Cross-platform mobile app built with React Native',
    fork: false,
    url: 'https://api.github.com/repos/demo-user/mobile-app',
    default_branch: 'main',
  },
];

export const demoPullRequests: PullRequest[] = [
  {
    id: 101,
    number: 42,
    state: 'open',
    title: 'Add user authentication system',
    body: 'This PR adds a comprehensive user authentication system with login, logout, and session management.',
    user: {
      login: 'contributor1',
      id: 54321,
      avatar_url: 'https://avatars.githubusercontent.com/u/54321?v=4',
    },
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-16T14:20:00Z',
    closed_at: null,
    merged_at: null,
    base: {
      ref: 'main',
      sha: 'abc123def456',
      repo: demoRepositories[0],
    },
    head: {
      ref: 'feature/auth-system',
      sha: 'def456ghi789',
      repo: demoRepositories[0],
    },
    changed_files: 8,
    additions: 245,
    deletions: 32,
    mergeable: true,
    mergeable_state: 'clean',
    merged: false,
    draft: false,
  },
  {
    id: 102,
    number: 38,
    state: 'open',
    title: 'Improve API error handling',
    body: 'Enhanced error handling across all API endpoints with better error messages and status codes.',
    user: {
      login: 'contributor2',
      id: 67890,
      avatar_url: 'https://avatars.githubusercontent.com/u/67890?v=4',
    },
    created_at: '2024-01-14T09:15:00Z',
    updated_at: '2024-01-16T11:45:00Z',
    closed_at: null,
    merged_at: null,
    base: {
      ref: 'main',
      sha: 'ghi789jkl012',
      repo: demoRepositories[1],
    },
    head: {
      ref: 'feature/error-handling',
      sha: 'jkl012mno345',
      repo: demoRepositories[1],
    },
    changed_files: 12,
    additions: 156,
    deletions: 89,
    mergeable: true,
    mergeable_state: 'clean',
    merged: false,
    draft: false,
  },
  {
    id: 103,
    number: 25,
    state: 'open',
    title: 'Add dark mode support',
    body: 'Implements dark mode theme switching with persistent user preference storage.',
    user: {
      login: 'contributor3',
      id: 98765,
      avatar_url: 'https://avatars.githubusercontent.com/u/98765?v=4',
    },
    created_at: '2024-01-13T16:20:00Z',
    updated_at: '2024-01-15T13:30:00Z',
    closed_at: null,
    merged_at: null,
    base: {
      ref: 'main',
      sha: 'mno345pqr678',
      repo: demoRepositories[2],
    },
    head: {
      ref: 'feature/dark-mode',
      sha: 'pqr678stu901',
      repo: demoRepositories[2],
    },
    changed_files: 6,
    additions: 187,
    deletions: 23,
    mergeable: true,
    mergeable_state: 'clean',
    merged: false,
    draft: true,
  },
];

export const demoAIReviewComments: AIReviewComment[] = [
  {
    id: 'demo-review-1',
    filePath: 'src/components/AuthForm.tsx',
    startLine: 15,
    content: '**Missing input validation**\n\nAdd proper validation for email format before submitting:\n```typescript\nconst isValidEmail = (email: string) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);\n```',
    provider: 'openai',
    timestamp: '2024-01-16T10:30:00Z',
    status: 'pending'
  },
  {
    id: 'demo-review-2',
    filePath: 'src/components/AuthForm.tsx',
    startLine: 28,
    content: '**Potential security vulnerability**\n\nPassword should be validated on both client and server side. Consider adding minimum requirements:\n```typescript\nconst validatePassword = (pwd: string) => pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd);\n```',
    provider: 'openai',
    timestamp: '2024-01-16T10:30:00Z',
    status: 'pending'
  },
  {
    id: 'demo-review-3',
    filePath: 'src/hooks/useAuth.ts',
    startLine: 42,
    content: '**Memory leak risk**\n\nUseEffect cleanup is missing. Add cleanup to prevent memory leaks:\n```typescript\nreturn () => {\n  controller.abort();\n  clearTimeout(timeoutId);\n};\n```',
    provider: 'openai',
    timestamp: '2024-01-16T10:30:00Z',
    status: 'pending'
  },
  {
    id: 'demo-review-4',
    filePath: 'src/utils/api.ts',
    startLine: 67,
    content: '**Error handling improvement**\n\nCatch block should handle different error types appropriately:\n```typescript\nif (error.code === \'NETWORK_ERROR\') {\n  throw new NetworkError(\'Connection failed\');\n} else if (error.status === 401) {\n  throw new AuthenticationError(\'Invalid credentials\');\n}\n```',
    provider: 'openai',
    timestamp: '2024-01-16T10:30:00Z',
    status: 'pending'
  },
  {
    id: 'demo-review-5',
    filePath: 'src/components/UserProfile.tsx',
    startLine: 23,
    content: '**Performance optimization**\n\nUseMemo would improve performance for expensive calculations:\n```typescript\nconst userStats = useMemo(() => calculateUserStats(userData), [userData]);\n```',
    provider: 'openai',
    timestamp: '2024-01-16T10:30:00Z',
    status: 'pending'
  }
]; 