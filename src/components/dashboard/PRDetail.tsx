import { useState, useCallback, useEffect } from 'react';
import { PullRequest } from '@/lib/github/api';
import { LLMProvider, AIReviewComment } from '@/lib/types';
import { generateReview } from '@/lib/ai/review';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';

interface PRDetailProps {
  pullRequest: PullRequest;
  onClose: () => void;
  onSubmitComments: (comments: AIReviewComment[]) => Promise<void>;
}

interface FileChange {
  filename: string;
  patch?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export function PRDetail({ pullRequest, onClose, onSubmitComments }: PRDetailProps) {
  const { data: session } = useSession();
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('ollama');
  const [reviewComments, setReviewComments] = useState<AIReviewComment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'files'>('diff');
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFileChanges = async () => {
      if (!session?.accessToken) return;

      try {
        setIsLoadingChanges(true);
        const response = await fetch(`https://api.github.com/repos/${pullRequest.base.repo.full_name}/pulls/${pullRequest.number}/files`, {
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
      } catch (err) {
        console.error('Error loading PR changes:', err);
        setError('Failed to load PR changes. Please try again.');
      } finally {
        setIsLoadingChanges(false);
      }
    };

    loadFileChanges();
  }, [pullRequest, session]);

  const handleGenerateReview = useCallback(async () => {
    if (!session?.accessToken) return;

    setIsGenerating(true);
    try {
      const comments = await generateReview({
        provider: selectedProvider,
        pullRequest,
        accessToken: session.accessToken
      });
      setReviewComments(comments);
    } catch (err) {
      console.error('Error generating review:', err);
      setError('Failed to generate review. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProvider, pullRequest, session]);

  const handleCommentStatusChange = useCallback((commentId: string, status: AIReviewComment['status']) => {
    setReviewComments(comments =>
      comments.map(comment =>
        comment.id === commentId ? { ...comment, status } : comment
      )
    );
  }, []);

  const handleSubmitComments = useCallback(async () => {
    if (!session?.accessToken) return;

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

      await onSubmitComments(approvedComments);
      onClose();
    } catch (err) {
      console.error('Error submitting comments:', err);
      setError('Failed to submit comments. Please try again.');
    }
  }, [reviewComments, pullRequest, session, onSubmitComments, onClose]);

  const renderDiff = (patch?: string) => {
    if (!patch) return null;

    return patch.split('\n').map((line, index) => {
      let className = 'pl-2';
      if (line.startsWith('+')) {
        className += ' bg-green-100 dark:bg-green-900/20';
      } else if (line.startsWith('-')) {
        className += ' bg-red-100 dark:bg-red-900/20';
      } else if (line.startsWith('@')) {
        className += ' bg-blue-100 dark:bg-blue-900/20';
      }
      return (
        <div key={index} className={className}>
          <code>{line}</code>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm">
      <div className="container flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold">
                {pullRequest.title}
                <Badge className="ml-2" variant={pullRequest.state === 'open' ? 'default' : 'secondary'}>
                  {pullRequest.state}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                #{pullRequest.number} opened by {pullRequest.user.login}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden">
            {error && (
              <div className="mb-4 p-4 text-red-800 bg-red-100 dark:bg-red-900/20 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="flex h-full space-x-4">
              <div className="w-2/3 flex flex-col">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'diff' | 'files')}>
                  <TabsList>
                    <TabsTrigger value="diff">Diff View</TabsTrigger>
                    <TabsTrigger value="files">Changed Files</TabsTrigger>
                  </TabsList>
                  <TabsContent value="diff" className="flex-1">
                    <ScrollArea className="h-[calc(90vh-12rem)] border rounded-md">
                      {isLoadingChanges ? (
                        <div className="p-4 text-center">Loading diff...</div>
                      ) : (
                        <div className="p-4 space-y-6">
                          {fileChanges.map((file) => (
                            <div key={file.filename} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">{file.filename}</h3>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-green-600">+{file.additions}</Badge>
                                  <Badge variant="outline" className="text-red-600">-{file.deletions}</Badge>
                                </div>
                              </div>
                              <div className="font-mono text-sm overflow-x-auto">
                                {renderDiff(file.patch)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="files" className="flex-1">
                    <ScrollArea className="h-[calc(90vh-12rem)] border rounded-md">
                      {isLoadingChanges ? (
                        <div className="p-4 text-center">Loading files...</div>
                      ) : (
                        <div className="p-4 space-y-2">
                          {fileChanges.map((file) => (
                            <div key={file.filename} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                              <span className="font-medium">{file.filename}</span>
                              <div className="flex items-center space-x-2">
                                <Badge>{file.status}</Badge>
                                <span className="text-sm text-muted-foreground">
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
              </div>

              <Separator orientation="vertical" />

              <div className="w-1/3 flex flex-col">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as LLMProvider)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateReview} disabled={isGenerating}>
                      {isGenerating ? 'Generating...' : 'Generate Review'}
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(90vh-16rem)] border rounded-md">
                    <div className="p-4 space-y-4">
                      {reviewComments.map((comment) => (
                        <Card key={comment.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{comment.filePath}</p>
                              <p className="text-sm text-muted-foreground">Line {comment.startLine}</p>
                            </div>
                            <Badge variant={comment.status === 'approved' ? 'default' : 'secondary'}>
                              {comment.status}
                            </Badge>
                          </div>
                          <p className="mt-2">{comment.content}</p>
                          <div className="mt-4 flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant={comment.status === 'approved' ? 'default' : 'outline'}
                              onClick={() => handleCommentStatusChange(comment.id, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant={comment.status === 'rejected' ? 'destructive' : 'outline'}
                              onClick={() => handleCommentStatusChange(comment.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  {reviewComments.length > 0 && (
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitComments}>
                        Submit Approved Comments
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 