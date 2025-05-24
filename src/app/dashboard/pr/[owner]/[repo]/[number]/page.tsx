'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PullRequest } from '@/lib/github/api';
import { AIReviewComment } from '@/lib/types';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, GitBranch, Clock, FileText, Plus, Minus, Brain, Check, X, Send, 
  AlertCircle, Settings, ChevronDown, ChevronRight, Eye, Code, Edit3, Save, RotateCcw 
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
  const router = useRouter();
  const params = useParams();
  
  const [pullRequest, setPullRequest] = useState<PullRequest | null>(null);
  const [reviewComments, setReviewComments] = useState<AIReviewComment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini' | 'ollama'>('openai');
  const [hasConfiguredSettings, setHasConfiguredSettings] = useState<boolean | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(true);
  const [isLoadingPR, setIsLoadingPR] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [editingComments, setEditingComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (session?.accessToken && params.owner && params.repo && params.number) {
      loadPullRequest();
      checkUserSettings();
    }
  }, [session, params]);

  useEffect(() => {
    if (pullRequest && session?.accessToken) {
      loadFileChanges();
    }
  }, [pullRequest, session]);

  const checkUserSettings = async () => {
    if (!session?.user?.email) return;
    
    try {
      const response = await fetch(`/api/settings?user=${encodeURIComponent(session.user.email)}`);
      if (response.ok) {
        const settings = await response.json();
        const hasProvider = settings?.selectedProvider && (
          (settings.selectedProvider === 'openai' && settings.openaiApiKey) ||
          (settings.selectedProvider === 'gemini' && settings.geminiApiKey) ||
          (settings.selectedProvider === 'ollama' && settings.ollamaEndpoint)
        );
        setHasConfiguredSettings(hasProvider);
      } else {
        setHasConfiguredSettings(false);
      }
    } catch (error) {
      console.error('Error checking settings:', error);
      setHasConfiguredSettings(false);
    }
  };

  const loadPullRequest = async () => {
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
  };

  const loadFileChanges = async () => {
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
  };

  const handleGenerateReview = async () => {
    if (!pullRequest || !session?.user?.email) return;

    setIsGenerating(true);
    setError(null);
    
    try {
      if (hasConfiguredSettings) {
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
            prData
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate AI review');
        }

        const { comments, provider } = await response.json();

        if (comments && comments.length > 0) {
          setReviewComments(comments);
        } else {
          // No issues found
          const noIssuesComment: AIReviewComment = {
            id: `no-issues-${Date.now()}`,
            content: `## ✅ No Issues Found

The AI review did not identify any significant issues in the code changes. The changes appear to follow good practices and coding standards.

**Files Analyzed:** ${fileChanges.length} files  
**Provider:** ${provider}

Great work! The code looks clean and well-structured.`,
            filePath: '',
            startLine: 0,
            provider: provider,
            status: 'pending',
            timestamp: new Date().toISOString()
          };
          setReviewComments([noIssuesComment]);
        }
      } else {
        const settingsComment: AIReviewComment = {
          id: `settings-required-${Date.now()}`,
          content: `## 🔧 AI Configuration Required

To generate intelligent code reviews, you need to configure your AI provider first.

### Quick Setup:
1. Click the **"Configure AI Settings"** button below
2. Choose your preferred AI provider (OpenAI, Google Gemini, or Ollama)
3. Enter your API key or endpoint details
4. Save your configuration
5. Return here and try again!

### Supported Providers:
- **OpenAI GPT-4**: Industry-leading code analysis
- **Google Gemini**: Fast and efficient multimodal AI  
- **Ollama**: Self-hosted open source models for privacy

Configure your settings now to unlock AI-powered code reviews!`,
          filePath: '',
          startLine: 0,
          provider: selectedProvider,
          status: 'pending',
          timestamp: new Date().toISOString()
        };
        
        setReviewComments([settingsComment]);
      }
      
    } catch (err) {
      console.error('Error generating AI review:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate review. Please try again.');
      
      const fallbackComment: AIReviewComment = {
        id: `fallback-${Date.now()}`,
        content: `## ⚠️ AI Review Unavailable

Unable to generate AI review at this time.

### Possible Issues:
- LLM provider not configured properly
- API keys invalid or expired  
- Network connectivity issues
- Selected provider service is down

### Next Steps:
1. Visit the Settings page to configure your AI provider
2. Verify your API keys are correct and active
3. Check your network connection
4. Try again with a different provider

Please configure your AI settings and try again.`,
        filePath: '',
        startLine: 0,
        provider: selectedProvider,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      setReviewComments([fallbackComment]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommentStatusChange = (commentId: string, status: AIReviewComment['status']) => {
    setReviewComments(comments =>
      comments.map(comment =>
        comment.id === commentId ? { ...comment, status } : comment
      )
    );
  };

  const handleEditComment = (commentId: string) => {
    const comment = reviewComments.find(c => c.id === commentId);
    if (comment) {
      setEditingComments(prev => ({
        ...prev,
        [commentId]: comment.content
      }));
      setReviewComments(comments =>
        comments.map(comment =>
          comment.id === commentId ? { ...comment, isEditing: true } : comment
        )
      );
    }
  };

  const handleSaveComment = (commentId: string) => {
    const editedContent = editingComments[commentId];
    if (editedContent !== undefined) {
      setReviewComments(comments =>
        comments.map(comment =>
          comment.id === commentId 
            ? { ...comment, content: editedContent, isEditing: false }
            : comment
        )
      );
      setEditingComments(prev => {
        const newState = { ...prev };
        delete newState[commentId];
        return newState;
      });
    }
  };

  const handleCancelEdit = (commentId: string) => {
    setReviewComments(comments =>
      comments.map(comment =>
        comment.id === commentId ? { ...comment, isEditing: false } : comment
      )
    );
    setEditingComments(prev => {
      const newState = { ...prev };
      delete newState[commentId];
      return newState;
    });
  };

  const handleEditContentChange = (commentId: string, content: string) => {
    setEditingComments(prev => ({
      ...prev,
      [commentId]: content
    }));
  };

  const handleSubmitComments = async () => {
    if (!pullRequest) return;

    const approvedComments = reviewComments.filter(comment => comment.status === 'approved');
    
    try {
      const response = await fetch('/api/github/submit-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pullRequest,
          comments: approvedComments
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Error submitting comments:', err);
      setError('Failed to submit comments. Please try again.');
    }
  };

  const toggleFileCollapse = (filename: string) => {
    const newCollapsed = new Set(collapsedFiles);
    if (newCollapsed.has(filename)) {
      newCollapsed.delete(filename);
    } else {
      newCollapsed.add(filename);
    }
    setCollapsedFiles(newCollapsed);
  };

  const renderDiff = (patch?: string) => {
    if (!patch) return null;

    return patch.split('\n').map((line, index) => {
      let className = 'px-3 py-1 font-mono text-xs border-l-2';
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
      <div className="min-h-screen bg-gray-50">
        <div className="w-full p-4">
          <div className="space-y-4">
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pullRequest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full p-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* Compact Header */}
        <div className="border-b border-gray-200 bg-white p-4">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {pullRequest.title}
                </h1>
                <Badge variant={pullRequest.state === 'open' ? 'default' : 'secondary'} className="text-xs">
                  {pullRequest.state}
                </Badge>
                {pullRequest.draft && (
                  <Badge variant="outline" className="text-xs">Draft</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={pullRequest.user.avatar_url} alt={pullRequest.user.login} />
                    <AvatarFallback className="text-xs">{pullRequest.user.login[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>#{pullRequest.number} by {pullRequest.user.login}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span>{params.owner}/{params.repo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(pullRequest.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Stats */}
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded border text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>{pullRequest.changed_files} files</span>
            </div>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-green-600" />
              <span className="text-green-600">{pullRequest.additions}</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-red-600" />
              <span className="text-red-600">{pullRequest.deletions}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Compact Main Content */}
        <div className="p-4 space-y-4">
          {/* Files Section */}
          <Card className="border border-gray-200">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-3">
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

          {/* AI Review Section */}
          <Card className="border border-gray-200">
            <CardHeader className="border-b border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Code Review
                </CardTitle>
                <div className="flex items-center gap-3">
                  {hasConfiguredSettings ? (
                    <div className="text-xs text-gray-600">
                      Using configured provider
                    </div>
                  ) : (
                    <>
                      <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as 'openai' | 'gemini' | 'ollama')}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">🤖 OpenAI</SelectItem>
                          <SelectItem value="gemini">✨ Gemini</SelectItem>
                          <SelectItem value="ollama">🦙 Ollama</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="text-xs"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    </>
                  )}
                  <Button onClick={handleGenerateReview} disabled={isGenerating} size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
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
            </CardHeader>
            <CardContent className="p-3">
              {reviewComments.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-center">
                  <div>
                    <Brain className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    {hasConfiguredSettings ? (
                      <p className="text-sm text-gray-600">
                        Click &ldquo;Generate Review&rdquo; to get AI insights
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Configure AI provider to get intelligent reviews
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
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
                            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                              <FileText className="h-4 w-4" />
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm">{filePath}</code>
                              <Badge variant="outline" className="text-xs">{comments.length} issue{comments.length !== 1 ? 's' : ''}</Badge>
                            </div>
                          )}
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
                                        variant={comment.status === 'approved' ? 'default' : comment.status === 'rejected' ? 'destructive' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {comment.status}
                                      </Badge>
                                      {!comment.isEditing && (
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
                                    <div className="mb-3 border border-gray-200 rounded">
                                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                        <span className="text-xs font-medium text-gray-600">Code at line {comment.startLine}:</span>
                                      </div>
                                      <div className={`px-3 py-2 font-mono text-xs ${
                                        comment.lineType === 'added' ? 'bg-green-50 border-l-4 border-green-400' :
                                        comment.lineType === 'removed' ? 'bg-red-50 border-l-4 border-red-400' :
                                        'bg-gray-50 border-l-4 border-gray-300'
                                      }`}>
                                        <span className={
                                          comment.lineType === 'added' ? 'text-green-800' :
                                          comment.lineType === 'removed' ? 'text-red-800' :
                                          'text-gray-700'
                                        }>
                                          {comment.lineType === 'added' ? '+' : comment.lineType === 'removed' ? '-' : ' '}
                                          {comment.lineContent}
                                        </span>
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
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {reviewComments.filter(c => c.status === 'approved').length > 0 && (
                    <div className="pt-3 border-t border-gray-200 flex justify-center">
                      <Button onClick={handleSubmitComments} size="sm" className="bg-green-600 hover:bg-green-700 text-xs">
                        <Send className="h-3 w-3 mr-1" />
                        Submit {reviewComments.filter(c => c.status === 'approved').length} Comments
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 