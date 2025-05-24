"use client"

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Repository } from '@/lib/github/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Search, 
  Plus,
  Star,
  GitBranch,
  Settings,
  Trash2
} from 'lucide-react';

interface ManageReposProps {
  repositories: Repository[];
  selectedRepos: Set<string>;
  onToggleRepo: (repoFullName: string) => void;
}

export function ManageRepos({
  repositories,
  selectedRepos,
  onToggleRepo
}: ManageReposProps) {
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');

  const displayedRepositories = repositories.filter(repo => selectedRepos.has(repo.full_name));
  
  const filteredRepositories = repositories.filter(repo => {
    if (!repoSearchQuery.trim()) return true;
    const query = repoSearchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.full_name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Repositories</h1>
        <p className="text-gray-600">Select and manage repositories to track their pull requests</p>
      </div>

      {/* Repository Selection */}
      {selectedRepos.size === 0 ? (
        <Card className="border border-gray-200 mb-8">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                <GitBranch className="h-6 w-6 text-gray-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">Select Repositories</h3>
                <p className="text-gray-600">
                  Choose repositories to track their pull requests. Your selection will be saved automatically.
                </p>
              </div>
              <Button 
                onClick={() => setShowRepoSelector(true)}
                disabled={repositories.length === 0}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {repositories.length === 0 ? 'Loading...' : 'Select Repositories'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Repository Management Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Selected Repositories ({selectedRepos.size})
            </h2>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowRepoSelector(true)}
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Selection
              </Button>
            </div>
          </div>
          
          {/* Repository Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedRepositories.map((repo) => (
              <Card key={repo.id} className="border border-gray-200 hover:border-gray-300 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{repo.name}</h4>
                        <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-2">{repo.full_name}</p>
                      {repo.description && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-3">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {repo.private !== undefined && (
                          <Badge variant={repo.private ? "secondary" : "outline"} className="text-xs">
                            {repo.private ? 'Private' : 'Public'}
                          </Badge>
                        )}
                        {repo.language && (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {repo.language}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleRepo(repo.full_name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Stats */}
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{selectedRepos.size}</span>
                    <span className="text-gray-600"> repositories selected</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{displayedRepositories.filter(r => !r.private).length}</span>
                    <span className="text-gray-600"> public</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{displayedRepositories.filter(r => r.private).length}</span>
                    <span className="text-gray-600"> private</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowRepoSelector(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Repository Selection Modal */}
      <Dialog open={showRepoSelector} onOpenChange={setShowRepoSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Repositories</DialogTitle>
            <DialogDescription>
              Choose repositories to track their pull requests on your dashboard.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search repositories..."
                value={repoSearchQuery}
                onChange={(e) => setRepoSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {filteredRepositories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No repositories found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRepositories.map((repo) => (
                    <Card 
                      key={repo.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedRepos.has(repo.full_name) 
                          ? 'border-black bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => onToggleRepo(repo.full_name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">{repo.name}</h4>
                              {selectedRepos.has(repo.full_name) && (
                                <Star className="h-3 w-3 text-black fill-current" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mb-2">{repo.full_name}</p>
                            {repo.description && (
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              {repo.private !== undefined && (
                                <Badge variant={repo.private ? "secondary" : "outline"} className="text-xs">
                                  {repo.private ? 'Private' : 'Public'}
                                </Badge>
                              )}
                              {repo.language && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  {repo.language}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRepos.size} repositories selected
              </span>
              <Button onClick={() => setShowRepoSelector(false)} className="bg-gray-900 hover:bg-gray-800">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 