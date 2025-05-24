import { PullRequest } from './github/api';

export type LLMProvider = 'ollama' | 'gemini' | 'openai';

export interface AIReviewComment {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  provider: LLMProvider;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'submitted';
  isEditing?: boolean;
  originalContent?: string;
  lineContent?: string;
  lineType?: 'added' | 'removed' | 'context';
}

export interface PRReview {
  pullRequest: PullRequest;
  comments: AIReviewComment[];
  selectedProvider: LLMProvider;
}

export interface PRFilters {
  repository?: string;
  status: 'pending' | 'reviewed' | 'all';
  searchQuery: string;
}

export interface PaginationState {
  page: number;
  perPage: number;
  total: number;
} 