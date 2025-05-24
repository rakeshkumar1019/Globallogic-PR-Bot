'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { GitHubClient, Repository } from '@/lib/github/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { Star } from 'lucide-react';

export default function TestRepos() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadRepositories = useCallback(async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    try {
      const github = new GitHubClient(session.accessToken);
      const repos = await github.getUserRepositories();
      console.log('Loaded repositories:', repos.length, repos);
      setRepositories(repos);
    } catch (error) {
      console.error('Error loading repositories:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken) {
      loadRepositories();
    }
  }, [session, loadRepositories]);

  const toggleRepo = (repoFullName: string) => {
    setSelectedRepos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repoFullName)) {
        newSet.delete(repoFullName);
      } else {
        newSet.add(repoFullName);
      }
      return newSet;
    });
  };

  return (
    <SidebarLayout 
      breadcrumbs={[
        { label: "Test Repositories", href: "/test-repos" },
        { label: "Repository Selection" }
      ]}
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Repository Selection Test</h1>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Session: {session?.accessToken ? 'Active' : 'None'}<br/>
            Repositories loaded: {repositories.length}<br/>
            Selected: {selectedRepos.size}
          </p>
          
          <Button onClick={() => setShowModal(true)} disabled={loading}>
            {loading ? 'Loading...' : 'Select Repositories'}
          </Button>
        </div>

        {selectedRepos.size > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Selected Repositories:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(selectedRepos).map(repoName => {
                const repo = repositories.find(r => r.full_name === repoName);
                if (!repo) return null;
                return (
                  <Card key={repo.id}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{repo.name}</h3>
                      <p className="text-sm text-gray-600">{repo.full_name}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Select Repositories ({repositories.length} available)</DialogTitle>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-96">
              {repositories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {loading ? 'Loading repositories...' : 'No repositories found'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                  {repositories.map((repo) => (
                    <Card 
                      key={repo.id} 
                      className={`border cursor-pointer transition-all ${
                        selectedRepos.has(repo.full_name) 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-200'
                      }`}
                      onClick={() => toggleRepo(repo.full_name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900 truncate">{repo.name}</h4>
                              {selectedRepos.has(repo.full_name) && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{repo.full_name}</p>
                            {repo.description && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                {repo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {selectedRepos.size} repositories selected
                </span>
                <Button onClick={() => setShowModal(false)}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarLayout>
  );
} 