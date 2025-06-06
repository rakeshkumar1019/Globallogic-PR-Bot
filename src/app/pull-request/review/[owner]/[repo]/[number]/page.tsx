'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PullRequest } from '@/lib/github/api';
import { AIReviewComment } from '@/lib/types';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { useLLMProviderCache } from '@/lib/hooks/useLLMProviderCache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { 
  GitBranch, Clock, FileText, Plus, Minus, Brain, Check, X, Send, 
  AlertCircle, ChevronDown, ChevronRight, Eye, Code, Edit3, Save, RotateCcw, CheckCheck,
  Bot, Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FileChange {
  filename: string;
  patch?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export default function PRDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  
  // Use cached LLM provider selection
  const { selectedProvider, setSelectedProvider: setCachedProvider, isLoaded: providerCacheLoaded } = useLLMProviderCache();
  
  const [pullRequest, setPullRequest] = useState<PullRequest | null>(null);
  const [reviewComments, setReviewComments] = useState<AIReviewComment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(true);
  const [isLoadingPR, setIsLoadingPR] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [collapsedCommentFiles, setCollapsedCommentFiles] = useState<Set<string>>(new Set());
  const [editingComments, setEditingComments] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('ai-review');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [providerSettings, setProviderSettings] = useState<{
    selectedProvider?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    ollamaModel?: string;
  } | null>(null);



  // Initialize all files as collapsed by default
  useEffect(() => {
    if (fileChanges.length > 0) {
      setCollapsedFiles(new Set(fileChanges.map(file => file.filename)));
    }
  }, [fileChanges]);

  // Initialize all comment files as expanded by default (empty set means all expanded)
  useEffect(() => {
    if (reviewComments.length > 0) {
      // Start with empty set so all files are expanded by default
      setCollapsedCommentFiles(new Set());
    }
  }, [reviewComments]);

  const checkUserSettings = useCallback(async () => {
    if (!session?.user?.email) return;
    
    try {
      const response = await fetch(`/api/settings?user=${encodeURIComponent(session.user.email)}`);
      if (response.ok) {
        const settings = await response.json();
        setProviderSettings(settings);
      }
    } catch (error) {
      console.error('Error checking settings:', error);
    }
  }, [session?.user?.email]);

  // Check if a provider is properly configured
  const isProviderConfigured = useCallback((provider: string): boolean => {
    if (!providerSettings) return false;
    
    switch (provider) {
      case 'openai':
        return !!(providerSettings.openaiApiKey && providerSettings.openaiModel);
      case 'gemini':
        return !!(providerSettings.geminiApiKey && providerSettings.geminiModel);
      case 'ollama':
        return false; // Disabled as per requirements
      default:
        return false;
    }
  }, [providerSettings]);

  const loadPullRequest = useCallback(async () => {
    if (!session?.accessToken) return;

    const cacheKey = `pr_details:${params.owner}:${params.repo}:${params.number}:${session.accessToken.slice(-8)}`;
    
    const cached = apiCache.get<PullRequest>(cacheKey);
    if (cached) {
      setPullRequest(cached);
      setIsLoadingPR(false);
      return;
    }

    try {
      setIsLoadingPR(true);
      const response = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/pulls/${params.number}`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pull request');
      }

      const pr: PullRequest = await response.json();
      const processedPR = {
        ...pr,
        changed_files: pr.changed_files || 0,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        mergeable: pr.mergeable || false,
        mergeable_state: pr.mergeable_state || 'unknown',
        merged: pr.merged || false,
        draft: pr.draft || false,
      };
      
      setPullRequest(processedPR);
      apiCache.set(cacheKey, processedPR, CACHE_TTL.PR_DETAILS);
    } catch (err) {
      console.error('Error loading pull request:', err);
      setError('Failed to load pull request. Please try again.');
    } finally {
      setIsLoadingPR(false);
    }
  }, [session?.accessToken, params.owner, params.repo, params.number]);

  const loadFileChanges = useCallback(async () => {
    if (!session?.accessToken || !pullRequest) return;

    const cacheKey = `pr_files:${params.owner}:${params.repo}:${params.number}:${session.accessToken.slice(-8)}`;
    
    const cached = apiCache.get<FileChange[]>(cacheKey);
    if (cached) {
      setFileChanges(cached);
      setIsLoadingChanges(false);
      return;
    }

    try {
      setIsLoadingChanges(true);
      const response = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/pulls/${params.number}/files`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PR changes');
      }

      const files: FileChange[] = await response.json();
      setFileChanges(files);
      apiCache.set(cacheKey, files, CACHE_TTL.PR_FILES);
    } catch (err) {
      console.error('Error loading PR changes:', err);
      setError('Failed to load PR changes. Please try again.');
    } finally {
      setIsLoadingChanges(false);
    }
  }, [session?.accessToken, pullRequest, params.owner, params.repo, params.number]);

  // useEffect hooks after function declarations
  useEffect(() => {
    if (session?.accessToken && params.owner && params.repo && params.number) {
      loadPullRequest();
      checkUserSettings();
    }
  }, [session, params, loadPullRequest, checkUserSettings]);

  // Set default provider based on what's configured
  useEffect(() => {
    if (providerSettings && providerCacheLoaded) {
      // Check which providers are configured and set the first available one as default
      // Only update if current selection is not configured
      if (!isProviderConfigured(selectedProvider)) {
        if (isProviderConfigured('openai')) {
          setCachedProvider('openai');
        } else if (isProviderConfigured('gemini')) {
          setCachedProvider('gemini');
        }
      }
    }
  }, [providerSettings, providerCacheLoaded, selectedProvider, isProviderConfigured, setCachedProvider]);

  useEffect(() => {
    if (pullRequest && session?.accessToken) {
      loadFileChanges();
    }
  }, [pullRequest, session, loadFileChanges]);

  const handleGenerateReview = async () => {
    if (!pullRequest || !session?.user?.email) return;

    // Check if the selected provider is configured
    if (!isProviderConfigured(selectedProvider)) {
      setError('Please add API key and model in Settings before generating a review. Configure your LLM provider to continue.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const prData = {
        title: pullRequest.title,
        body: pullRequest.body || '',
        files: fileChanges.map(file => ({
          filename: file.filename,
          patch: file.patch || ''
        }))
      };

      const response = await fetch('/api/ai-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: session.user.email,
          prData,
          // Always pass the selected provider
          overrideProvider: selectedProvider
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate AI review');
      }

      const result = await response.json();
      
      if (result.comments && Array.isArray(result.comments)) {
        const commentsWithIds = result.comments.map((comment: AIReviewComment, index: number) => ({
          ...comment,
          id: `ai-comment-${Date.now()}-${index}`,
          status: 'pending' as const
        }));
        
        setReviewComments(commentsWithIds);
      } else {
        // No issues found or no comments returned
        const noIssuesComment: AIReviewComment = {
          id: `no-issues-${Date.now()}`,
          content: `## ✅ No Issues Found

The AI review did not identify any significant issues in the code changes. The changes appear to follow good practices and coding standards.

**Files Analyzed:** ${fileChanges.length} files  
**Provider:** ${result.provider || 'AI'}

Great work! The code looks clean and well-structured.`,
          filePath: '',
          startLine: 0,
          provider: result.provider || 'AI',
          status: 'pending',
          timestamp: new Date().toISOString()
        };
        setReviewComments([noIssuesComment]);
      }
    } catch (err) {
      console.error('Error generating AI review:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI review';
      setError(errorMessage);
      
      // Show a helpful error comment
      const errorComment: AIReviewComment = {
        id: `error-${Date.now()}`,
        content: `## ⚠️ AI Review Failed

**Error:** ${errorMessage}

### Possible Solutions:
1. **Configure AI Provider**: Go to Settings and configure your preferred AI provider (OpenAI, Gemini, or Ollama)
2. **Check API Keys**: Ensure your API keys are valid and have sufficient credits
3. **Try Again**: Click "Generate Review" again
4. **Check Network**: Verify your internet connection

Please configure your AI settings in the Settings page and try again.`,
        filePath: '',
        startLine: 0,
        provider: 'openai',
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      setReviewComments([errorComment]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommentStatusChange = (commentId: string, status: AIReviewComment['status']) => {
    setReviewComments(prev => 
      prev.map(comment => 
        comment.id === commentId ? { ...comment, status } : comment
      )
    );
  };

  const handleSelectAllApprove = () => {
    setReviewComments(prev => 
      prev.map(comment => 
        comment.status !== 'submitted' ? { ...comment, status: 'approved' as const } : comment
      )
    );
  };

  const handleRejectAll = () => {
    setReviewComments([]);
    setSubmitMessage(null);
  };

  const handleEditComment = (commentId: string) => {
    const comment = reviewComments.find(c => c.id === commentId);
    if (comment) {
      setEditingComments(prev => ({ ...prev, [commentId]: comment.content }));
      setReviewComments(prev => 
        prev.map(c => c.id === commentId ? { ...c, isEditing: true } : c)
      );
    }
  };

  const handleSaveComment = (commentId: string) => {
    const editedContent = editingComments[commentId];
    if (editedContent !== undefined) {
      setReviewComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { ...c, content: editedContent, isEditing: false }
            : c
        )
      );
      setEditingComments(prev => 
        Object.fromEntries(
          Object.entries(prev).filter(([key]) => key !== commentId)
        )
      );
    }
  };

  const handleCancelEdit = (commentId: string) => {
    setReviewComments(prev => 
      prev.map(c => c.id === commentId ? { ...c, isEditing: false } : c)
    );
    setEditingComments(prev => 
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => key !== commentId)
      )
    );
  };

  const handleEditContentChange = (commentId: string, content: string) => {
    setEditingComments(prev => ({ ...prev, [commentId]: content }));
  };

    const handleSubmitComments = async () => {
    const approvedComments = reviewComments.filter(c => c.status === 'approved');
    if (approvedComments.length === 0) return;

    setIsSubmitting(true);
    setSubmitMessage(null);
    
    try {
      if (!session?.accessToken) {
        throw new Error('No access token available');
      }

      // Separate general comments from file-specific comments
      const generalComments = approvedComments.filter(c => !c.filePath || c.filePath === '' || !c.startLine || c.startLine <= 0);
      const fileComments = approvedComments.filter(c => c.filePath && c.filePath !== '' && c.startLine && c.startLine > 0);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Submit file-specific comments as a single PR review with line-specific comments
      if (fileComments.length > 0) {
        try {
          const reviewComments = fileComments.map(comment => ({
            path: comment.filePath!,
            line: comment.startLine,
            side: 'RIGHT', // Comments on the new version of the file
            body: comment.content.trim()
          }));

          const reviewData = {
            event: 'COMMENT',
            comments: reviewComments
          };

          const response = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/pulls/${params.number}/reviews`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(reviewData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to submit line comments: ${response.status}`);
          }

          successCount += fileComments.length;
          
          // Mark file-specific comments as submitted
          setReviewComments(prev => 
            prev.map(c => 
              fileComments.find(fc => fc.id === c.id)
                ? { ...c, status: 'submitted' as const, isSubmitted: true }
                : c
            )
          );

        } catch (error) {
          console.error('Error submitting file comments:', error);
          errorCount += fileComments.length;
          errors.push(`Line comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Submit general comments individually using issues API
      for (const comment of generalComments) {
        try {
          const response = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/issues/${params.number}/comments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              body: comment.content.trim()
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to submit general comment: ${response.status}`);
          }

          successCount++;
          
          // Mark this specific comment as submitted
          setReviewComments(prev => 
            prev.map(c => 
              c.id === comment.id 
                ? { ...c, status: 'submitted' as const, isSubmitted: true }
                : c
            )
          );

          // Small delay between comments to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          console.error(`Error submitting comment ${comment.id}:`, error);
          errorCount++;
          errors.push(`General comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Show appropriate success/error message
      if (successCount > 0 && errorCount === 0) {
        setSubmitMessage({
          type: 'success',
          text: `✅ Successfully submitted ${successCount} comment${successCount !== 1 ? 's' : ''} to GitHub!`
        });
      } else if (successCount > 0 && errorCount > 0) {
        setSubmitMessage({
          type: 'error',
          text: `⚠️ Submitted ${successCount} comments, but ${errorCount} failed. ${errors.join('; ')}`
        });
      } else {
        setSubmitMessage({
          type: 'error',
          text: `❌ Failed to submit comments. ${errors.join('; ')}`
        });
      }
      
      // Clear message after 8 seconds
      setTimeout(() => setSubmitMessage(null), 8000);
      
    } catch (error) {
      console.error('Error in submit process:', error);
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to submit comments. Please try again.'
      });
      setTimeout(() => setSubmitMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFileCollapse = (filename: string) => {
    setCollapsedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  const toggleCommentFileCollapse = (filePath: string) => {
    setCollapsedCommentFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const renderDiff = (patch?: string) => {
    if (!patch) return null;
    
    const lines = patch.split('\n');
    return lines.map((line, index) => {
      let className = 'px-3 py-1 text-xs font-mono border-l-2 ';
      if (line.startsWith('+')) {
        className += ' bg-green-50 border-green-400 text-green-900';
      } else if (line.startsWith('-')) {
        className += ' bg-red-50 border-red-400 text-red-900';
      } else if (line.startsWith('@')) {
        className += ' bg-blue-50 border-blue-400 text-blue-900 font-medium';
      } else {
        className += ' bg-gray-50 border-gray-300 text-gray-700';
      }
      return (
        <div key={index} className={className}>
          <code>{line}</code>
        </div>
      );
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added': return <Plus className="h-3 w-3 text-green-600" />;
      case 'removed': return <Minus className="h-3 w-3 text-red-600" />;
      case 'modified': return <FileText className="h-3 w-3 text-blue-600" />;
      default: return <FileText className="h-3 w-3 text-gray-600" />;
    }
  };

  if (isLoadingPR) {
    return (
      <SidebarLayout 
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pull Request" },
          { label: "Review" },
          { label: "Loading..." }
        ]}
      >
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </SidebarLayout>
    );
  }

  if (error && !pullRequest) {
    return (
      <SidebarLayout 
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pull Request" },
          { label: "Review" },
          { label: "Error" }
        ]}
      >
        <div className="flex items-center justify-center min-h-[300px]">
          <Card className="max-w-md w-full border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">Error</h3>
                  <p className="text-sm text-gray-600">{error || 'Pull request not found'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  const approvedCommentsCount = reviewComments.filter(c => c.status === 'approved').length;
  const submittedCommentsCount = reviewComments.filter(c => c.status === 'submitted').length;

  return (
    <SidebarLayout 
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Pull Requests", href: "/pull-request" },
        { label: "Review", href: `/pull-request/review/${params.owner}/${params.repo}/${params.number}` },
        { label: `#${pullRequest?.number}` }
      ]}
    >
      <div className="w-full">
        {/* Compact Header */}
        <div className="border-b border-gray-200 bg-white px-4 py-6 rounded-t-lg mb-6">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {pullRequest?.title}
                </h1>
                <Badge variant={pullRequest?.state === 'open' ? 'default' : 'secondary'} className="text-xs">
                  {pullRequest?.state}
                </Badge>
                {pullRequest?.draft && (
                  <Badge variant="outline" className="text-xs">Draft</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={pullRequest?.user.avatar_url} alt={pullRequest?.user.login} />
                    <AvatarFallback className="text-xs">{pullRequest?.user.login[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>#{pullRequest?.number} by {pullRequest?.user.login}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span>{params.owner}/{params.repo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{pullRequest && new Date(pullRequest.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Stats */}
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded border text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>{pullRequest?.changed_files} files</span>
            </div>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-green-600" />
              <span className="text-green-600">{pullRequest?.additions}</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-red-600" />
              <span className="text-red-600">{pullRequest?.deletions}</span>
            </div>
          </div>
        </div>

        {/* Submit Message */}
        {submitMessage && (
          <Alert variant={submitMessage.type === 'error' ? 'destructive' : 'default'} className="mb-6">
            <div className="flex items-center gap-3">
              {submitMessage.type === 'success' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{submitMessage.text}</AlertDescription>
            </div>
          </Alert>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="ai-review" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Code Review
            </TabsTrigger>
            <TabsTrigger value="changed-files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Changed Files ({fileChanges.length})
            </TabsTrigger>
          </TabsList>

          {/* AI Code Review Tab */}
          <TabsContent value="ai-review">
            <Card className="border border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-purple-600" />
                    AI Code Review
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Select value={selectedProvider} onValueChange={(value) => setCachedProvider(value as 'openai' | 'gemini')}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai" disabled={!isProviderConfigured('openai')}>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-gray-700" />
                            OpenAI
                            {!isProviderConfigured('openai') && <span className="text-red-500 text-xs">(Not configured)</span>}
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini" disabled={!isProviderConfigured('gemini')}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            Gemini
                            {!isProviderConfigured('gemini') && <span className="text-red-500 text-xs">(Not configured)</span>}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateReview} disabled={isGenerating || !isProviderConfigured(selectedProvider)} size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
                      {isGenerating ? (
                        <div className="flex items-center gap-1">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          Generating...
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          Generate Review
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
                {!isProviderConfigured(selectedProvider) && (
                  <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-800">
                        ⚠️ LLM provider not configured. Add API key and model to generate reviews.
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open('/settings', '_blank')}
                        className="text-xs border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                      >
                        Configure LLM
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {reviewComments.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-center">
                    <div>
                      <Brain className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      {isProviderConfigured(selectedProvider) ? (
                        <p className="text-sm text-gray-600">
                          Click &ldquo;Generate Review&rdquo; to get AI insights
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Configure LLM provider to get intelligent reviews
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Select All Controls */}
                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded border">
                      <div className="text-sm text-gray-700">
                        {reviewComments.length} review comment{reviewComments.length !== 1 ? 's' : ''}
                        {reviewComments.length > 0 && (
                          <>
                            {approvedCommentsCount > 0 && <span className="text-orange-600"> • {approvedCommentsCount} approved</span>}
                            {submittedCommentsCount > 0 && <span className="text-green-600"> • {submittedCommentsCount} submitted</span>}
                            {reviewComments.filter(c => c.status === 'pending').length > 0 && (
                              <span className="text-gray-600"> • {reviewComments.filter(c => c.status === 'pending').length} pending</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {submittedCommentsCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReviewComments([]);
                              setSubmitMessage(null);
                            }}
                            className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50"
                          >
                            <Brain className="h-3 w-3 mr-1" />
                            Generate New Review
                          </Button>
                        )}
                        {reviewComments.length > 0 && submittedCommentsCount === 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRejectAll}
                              className="text-xs border-red-600 text-red-600 hover:bg-red-50"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject All
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSelectAllApprove}
                              className="text-xs border-green-600 text-green-600 hover:bg-green-50"
                            >
                              <CheckCheck className="h-3 w-3 mr-1" />
                              Approve All
                            </Button>
                          </>
                        )}
                        {approvedCommentsCount > 0 && submittedCommentsCount === 0 && (
                          <Button 
                            onClick={handleSubmitComments} 
                            disabled={isSubmitting}
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-xs"
                          >
                            {isSubmitting ? (
                              <div className="flex items-center gap-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Submitting...
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Send className="h-3 w-3" />
                                Submit {approvedCommentsCount} Comment{approvedCommentsCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </Button>
                        )}
                        {submittedCommentsCount > 0 && approvedCommentsCount === 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1 rounded border border-green-200">
                            <Check className="h-3 w-3" />
                            All Comments Submitted
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Group comments by file */}
                      {(() => {
                        const commentsByFile = reviewComments.reduce((acc, comment) => {
                          const key = comment.filePath || 'general';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(comment);
                          return acc;
                        }, {} as Record<string, AIReviewComment[]>);

                        return Object.entries(commentsByFile).map(([filePath, comments]) => (
                          <div key={filePath}>
                            {filePath !== 'general' && (
                              <div 
                                className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100"
                                onClick={() => toggleCommentFileCollapse(filePath)}
                              >
                                {collapsedCommentFiles.has(filePath) ? (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                                <FileText className="h-4 w-4" />
                                <code className="bg-white px-2 py-1 rounded text-sm">{filePath}</code>
                                <Badge variant="outline" className="text-xs">{comments.length} comment{comments.length !== 1 ? 's' : ''}</Badge>
                              </div>
                            )}
                            {(filePath === 'general' || !collapsedCommentFiles.has(filePath)) && (
                              <div className="space-y-3 pl-6">
                                {comments.map((comment) => (
                                  <Card key={comment.id} className="border-l-4 border-l-purple-500">
                                    <CardContent className="p-3">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <Eye className="h-3 w-3" />
                                          <span>AI Review</span>
                                          {comment.startLine > 0 && (
                                            <>
                                              <span>•</span>
                                              <span className="text-purple-600 font-medium">Line {comment.startLine}</span>
                                            </>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                                                                <Badge 
                                        variant={
                                          comment.status === 'approved' ? 'default' : 
                                          comment.status === 'rejected' ? 'destructive' : 
                                          comment.status === 'submitted' ? 'default' :
                                          'secondary'
                                        }
                                        className={`text-xs ${
                                          comment.status === 'submitted' ? 'bg-green-100 text-green-800 border-green-200' : ''
                                        }`}
                                      >
                                        {comment.status}
                                      </Badge>
                                          {!comment.isEditing && comment.status !== 'submitted' && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleEditComment(comment.id)}
                                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                            >
                                              <Edit3 className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Show code line if available */}
                                      {comment.lineContent && (
                                        <div className="mb-3 border border-gray-300 rounded-lg shadow-sm">
                                          <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-lg">
                                            <div className="flex items-center gap-2">
                                              <Code className="h-4 w-4 text-gray-500" />
                                              <span className="text-sm font-semibold text-gray-700">Line {comment.startLine}</span>
                                              <Badge variant="outline" className={`text-xs ${
                                                comment.lineType === 'added' ? 'border-green-500 text-green-700 bg-green-50' :
                                                comment.lineType === 'removed' ? 'border-red-500 text-red-700 bg-red-50' :
                                                'border-gray-500 text-gray-700 bg-gray-50'
                                              }`}>
                                                {comment.lineType === 'added' ? 'Added' : comment.lineType === 'removed' ? 'Removed' : 'Modified'}
                                              </Badge>
                                            </div>
                                          </div>
                                          <div className={`relative group ${
                                            comment.lineType === 'added' ? 'bg-green-50' :
                                            comment.lineType === 'removed' ? 'bg-red-50' :
                                            'bg-gray-50'
                                          }`}>
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                              comment.lineType === 'added' ? 'bg-green-400' :
                                              comment.lineType === 'removed' ? 'bg-red-400' :
                                              'bg-gray-400'
                                            }`}></div>
                                            <div className="px-4 py-3 pl-6">
                                              <div className="flex items-start gap-3">
                                                <span className={`flex-shrink-0 w-6 h-6 rounded text-xs font-mono flex items-center justify-center ${
                                                  comment.lineType === 'added' ? 'bg-green-200 text-green-800' :
                                                  comment.lineType === 'removed' ? 'bg-red-200 text-red-800' :
                                                  'bg-gray-200 text-gray-800'
                                                }`}>
                                                  {comment.lineType === 'added' ? '+' : comment.lineType === 'removed' ? '-' : '~'}
                                                </span>
                                                <code className={`flex-1 font-mono text-sm break-all select-all cursor-text ${
                                                  comment.lineType === 'added' ? 'text-green-900' :
                                                  comment.lineType === 'removed' ? 'text-red-900' :
                                                  'text-gray-900'
                                                }`}>
                                                  {comment.lineContent}
                                                </code>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      <div className="prose prose-sm max-w-none mb-3">
                                        <div className="text-sm text-gray-700">
                                          {comment.isEditing ? (
                                            <div className="space-y-3">
                                              <Textarea
                                                value={editingComments[comment.id] || comment.content}
                                                onChange={(e) => handleEditContentChange(comment.id, e.target.value)}
                                                className="min-h-[120px]"
                                                placeholder="Edit your comment..."
                                              />
                                              <div className="flex gap-2">
                                                <Button
                                                  size="sm"
                                                  onClick={() => handleSaveComment(comment.id)}
                                                  className="text-xs"
                                                >
                                                  <Save className="h-3 w-3 mr-1" />
                                                  Save
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => handleCancelEdit(comment.id)}
                                                  className="text-xs"
                                                >
                                                  <RotateCcw className="h-3 w-3 mr-1" />
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <ReactMarkdown 
                                              remarkPlugins={[remarkGfm]}
                                              components={{
                                                h1: ({children}) => <h1 className="text-lg font-bold text-gray-900 mb-2">{children}</h1>,
                                                h2: ({children}) => <h2 className="text-base font-semibold text-gray-900 mb-2">{children}</h2>,
                                                h3: ({children}) => <h3 className="text-sm font-semibold text-gray-900 mb-1">{children}</h3>,
                                                p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                                                ul: ({children}) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                                ol: ({children}) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                                                li: ({children}) => <li className="mb-1">{children}</li>,
                                                code: ({children, className}) => {
                                                  const isInline = !className;
                                                  return isInline ? (
                                                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                                  ) : (
                                                    <code className="block bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</code>
                                                  );
                                                },
                                                strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                              }}
                                            >
                                              {comment.content}
                                            </ReactMarkdown>
                                          )}
                                        </div>
                                      </div>
                                      {comment.status !== 'submitted' && (
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            size="sm"
                                            variant={comment.status === 'approved' ? 'default' : 'outline'}
                                            onClick={() => handleCommentStatusChange(comment.id, 'approved')}
                                            className="text-xs"
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={comment.status === 'rejected' ? 'destructive' : 'outline'}
                                            onClick={() => handleCommentStatusChange(comment.id, 'rejected')}
                                            className="text-xs"
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Reject
                                          </Button>
                                        </div>
                                      )}
                                      {comment.status === 'submitted' && (
                                        <div className="flex justify-end">
                                          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1 rounded border border-green-200">
                                            <Check className="h-3 w-3" />
                                            Submitted to GitHub
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Changed Files Tab */}
          <TabsContent value="changed-files">
            <Card className="border border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Code className="h-5 w-5" />
                  Changed Files ({fileChanges.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingChanges ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading files...</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {fileChanges.map((file) => (
                      <div key={file.filename}>
                        <div 
                          className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleFileCollapse(file.filename)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {collapsedFiles.has(file.filename) ? (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                            {getStatusIcon(file.status)}
                            <span className="font-mono text-sm truncate">{file.filename}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                              +{file.additions}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                              -{file.deletions}
                            </Badge>
                          </div>
                        </div>
                        {!collapsedFiles.has(file.filename) && file.patch && (
                          <div className="border-t border-gray-100 bg-gray-50">
                            <ScrollArea className="max-h-96">
                              {renderDiff(file.patch)}
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
} 