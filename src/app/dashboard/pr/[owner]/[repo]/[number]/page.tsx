'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { PullRequest } from '@/lib/github/api';
import { LLMProvider, AIReviewComment } from '@/lib/types';
import { generateReview } from '@/lib/ai/review';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, GitBranch, Clock, FileText, Plus, Minus, Brain, Check, X, Send, AlertCircle } from 'lucide-react';
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
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('ollama');
  const [reviewComments, setReviewComments] = useState<AIReviewComment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'files'>('diff');
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(true);
  const [isLoadingPR, setIsLoadingPR] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.accessToken && params.owner && params.repo && params.number) {
      loadPullRequest();
    }
  }, [session, params]);

  useEffect(() => {
    if (pullRequest && session?.accessToken) {
      loadFileChanges();
    }
  }, [pullRequest, session]);

  const loadPullRequest = async () => {
    if (!session?.accessToken) return;

    const cacheKey = `pr_details:${params.owner}:${params.repo}:${params.number}:${session.accessToken.slice(-8)}`;
    
    // Check cache first
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
    
    // Check cache first
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
    if (!pullRequest) return;

    setIsGenerating(true);
    setError(null);
    try {
      const comments = await generateReview({
        provider: selectedProvider,
        pullRequest,
        accessToken: session?.accessToken,
        isDemo: !session?.accessToken
      });
      setReviewComments(comments);
    } catch (err) {
      console.error('Error generating review:', err);
      setError('Failed to generate review. Please try again.');
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

      // Redirect back to dashboard after successful submission
      router.push('/dashboard');
    } catch (err) {
      console.error('Error submitting comments:', err);
      setError('Failed to submit comments. Please try again.');
    }
  };

  const renderDiff = (patch?: string) => {
    if (!patch) return null;

    return patch.split('\n').map((line, index) => {
      let className = 'px-6 py-2 font-mono text-sm border-l-4';
      if (line.startsWith('+')) {
        className += ' bg-green-50 border-green-500 text-green-900';
      } else if (line.startsWith('-')) {
        className += ' bg-red-50 border-red-500 text-red-900';
      } else if (line.startsWith('@')) {
        className += ' bg-blue-50 border-blue-500 text-blue-900 font-semibold';
      } else {
        className += ' bg-gray-50 border-gray-300 text-gray-800';
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
      case 'added': return <Plus className="h-4 w-4 text-green-600" />;
      case 'removed': return <Minus className="h-4 w-4 text-red-600" />;
      case 'modified': return <FileText className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoadingPR) {
    return (
      <div className="min-h-screen bg-white">
        <div className="w-full px-8 py-6">
          <div className="space-y-6">
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pullRequest) {
    return (
      <div className="min-h-screen bg-white">
        <div className="w-full px-8 py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 text-red-600">
                  <AlertCircle className="h-6 w-6" />
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
    <div className="min-h-screen bg-white">
      <div className="w-full">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center gap-6 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-4xl font-bold text-gray-900">
                  {pullRequest.title}
                </h1>
                <Badge variant={pullRequest.state === 'open' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                  {pullRequest.state}
                </Badge>
                {pullRequest.draft && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    Draft
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-6 text-gray-600">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={pullRequest.user.avatar_url} alt={pullRequest.user.login} />
                    <AvatarFallback>{pullRequest.user.login[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-lg">#{pullRequest.number} opened by <span className="font-medium">{pullRequest.user.login}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  <span>{params.owner}/{params.repo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(pullRequest.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 p-6 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-medium">{pullRequest.changed_files} files changed</span>
            </div>
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-green-600" />
              <span className="text-lg font-medium text-green-600">{pullRequest.additions} additions</span>
            </div>
            <div className="flex items-center gap-3">
              <Minus className="h-5 w-5 text-red-600" />
              <span className="text-lg font-medium text-red-600">{pullRequest.deletions} deletions</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Main Content - Full Width */}
        <div className="px-8 py-6 space-y-8">
          {/* Code Changes Section */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <FileText className="h-6 w-6" />
                Code Changes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'diff' | 'files')}>
                <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
                  <TabsTrigger value="diff" className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Diff View
                  </TabsTrigger>
                  <TabsTrigger value="files" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Changed Files ({fileChanges.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="diff">
                  <ScrollArea className="h-[600px] border rounded-lg bg-white">
                    {isLoadingChanges ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Loading diff...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8 p-4">
                        {fileChanges.map((file) => (
                          <div key={file.filename} className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(file.status)}
                                <h3 className="font-semibold text-gray-900 text-lg">{file.filename}</h3>
                              </div>
                              <div className="flex items-center space-x-4">
                                <Badge variant="outline" className="text-green-600 border-green-600 px-3 py-1">
                                  +{file.additions}
                                </Badge>
                                <Badge variant="outline" className="text-red-600 border-red-600 px-3 py-1">
                                  -{file.deletions}
                                </Badge>
                              </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                              {renderDiff(file.patch)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="files">
                  <ScrollArea className="h-[600px] border rounded-lg bg-white">
                    {isLoadingChanges ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Loading files...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {fileChanges.map((file) => (
                          <div key={file.filename} className="flex items-center justify-between p-6 hover:bg-gray-50 rounded-lg transition-colors border">
                            <div className="flex items-center gap-4">
                              {getStatusIcon(file.status)}
                              <span className="font-medium text-lg">{file.filename}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <Badge variant="secondary" className="px-3 py-1">{file.status}</Badge>
                              <span className="text-gray-600">
                                {file.changes} changes
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* AI Review Section - Full Width */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Brain className="h-6 w-6 text-purple-600" />
                  AI Code Review
                </CardTitle>
                <div className="flex items-center space-x-4">
                  <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as LLMProvider)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select AI Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">🦙 Ollama</SelectItem>
                      <SelectItem value="gemini">✨ Google Gemini</SelectItem>
                      <SelectItem value="openai">🤖 OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleGenerateReview} disabled={isGenerating} size="lg" className="bg-purple-600 hover:bg-purple-700">
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Generate Review
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {reviewComments.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center">
                  <div>
                    <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">
                      Select an AI provider and click &ldquo;Generate Review&rdquo; to get code review suggestions
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-8">
                    {reviewComments.map((comment) => (
                      <Card key={comment.id} className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="space-y-2">
                              <p className="text-lg font-semibold text-purple-700">{comment.filePath}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Line {comment.startLine}
                              </p>
                            </div>
                            <Badge 
                              variant={comment.status === 'approved' ? 'default' : comment.status === 'rejected' ? 'destructive' : 'secondary'}
                              className="px-3 py-1"
                            >
                              {comment.status}
                            </Badge>
                          </div>
                          <p className="text-base text-gray-700 mb-6 leading-relaxed bg-gray-50 p-4 rounded-lg border">
                            {comment.content}
                          </p>
                          <div className="flex justify-end space-x-3">
                            <Button
                              size="lg"
                              variant={comment.status === 'approved' ? 'default' : 'outline'}
                              onClick={() => handleCommentStatusChange(comment.id, 'approved')}
                              className="flex items-center gap-2 px-6"
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="lg"
                              variant={comment.status === 'rejected' ? 'destructive' : 'outline'}
                              onClick={() => handleCommentStatusChange(comment.id, 'rejected')}
                              className="flex items-center gap-2 px-6"
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {reviewComments.filter(c => c.status === 'approved').length > 0 && (
                    <div className="pt-6 border-t border-gray-200 flex justify-center">
                      <Button onClick={handleSubmitComments} size="lg" className="bg-green-600 hover:bg-green-700 px-8 py-3">
                        <div className="flex items-center gap-2">
                          <Send className="h-5 w-5" />
                          Submit {reviewComments.filter(c => c.status === 'approved').length} Approved Comments
                        </div>
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