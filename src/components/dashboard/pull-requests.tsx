"use client"

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PullRequest } from '@/lib/github/api';
import { 
  Search, 
  ExternalLink,
  Calendar,
  FileText
} from 'lucide-react';

type FilterType = 'all' | 'ready' | 'draft' | 'my-prs';

interface PullRequestsProps {
  pullRequests: PullRequest[];
  userLogin?: string;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function PullRequests({
  pullRequests,
  userLogin,
  loading,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange
}: PullRequestsProps) {
  const router = useRouter();

  const filteredPRs = useMemo(() => {
    let filtered = pullRequests;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.title.toLowerCase().includes(query) ||
        pr.user.login.toLowerCase().includes(query) ||
        pr.number.toString().includes(query) ||
        pr.base?.repo?.full_name?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    switch (activeFilter) {
      case 'ready':
        filtered = filtered.filter(pr => !pr.draft && pr.state === 'open');
        break;
      case 'draft':
        filtered = filtered.filter(pr => pr.draft);
        break;
      case 'my-prs':
        filtered = filtered.filter(pr => pr.user.login === userLogin);
        break;
      default:
        break;
    }
    
    return filtered;
  }, [pullRequests, searchQuery, activeFilter, userLogin]);

  const stats = useMemo(() => {
    const totalPRs = pullRequests.length;
    const readyForReview = pullRequests.filter(pr => !pr.draft && pr.state === 'open').length;
    const draftPRs = pullRequests.filter(pr => pr.draft).length;
    const myPRs = pullRequests.filter(pr => pr.user.login === userLogin).length;
    
    return { totalPRs, readyForReview, draftPRs, myPRs };
  }, [pullRequests, userLogin]);

  const handlePRClick = (pr: PullRequest) => {
    const [owner, repo] = pr.base?.repo?.full_name?.split('/') || ['', ''];
    if (owner && repo) {
      router.push(`/dashboard/pr/${owner}/${repo}/${pr.number}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pull Requests</h1>
        <p className="text-gray-600">Review and manage pull requests across your repositories</p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-1">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('all')}
            className={activeFilter === 'all' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
          >
            All ({stats.totalPRs})
          </Button>
          <Button
            variant={activeFilter === 'ready' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('ready')}
            className={activeFilter === 'ready' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
          >
            Ready ({stats.readyForReview})
          </Button>
          <Button
            variant={activeFilter === 'draft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('draft')}
            className={activeFilter === 'draft' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
          >
            Draft ({stats.draftPRs})
          </Button>
          <Button
            variant={activeFilter === 'my-prs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('my-prs')}
            className={activeFilter === 'my-prs' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
          >
            Mine ({stats.myPRs})
          </Button>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search pull requests..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Pull Requests List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPRs.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <FileText className="h-8 w-8 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pull requests found</h3>
            <p className="text-gray-600">
              {searchQuery.trim() 
                ? 'No pull requests match your search criteria.'
                : 'No open pull requests found in selected repositories.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPRs.map((pr) => (
            <Card 
              key={pr.id} 
              className="border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer group"
              onClick={() => handlePRClick(pr)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 group-hover:text-black transition-colors line-clamp-1">
                        {pr.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={pr.state === 'open' ? 'outline' : 'secondary'}>
                          {pr.state}
                        </Badge>
                        {pr.draft && (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span>#{pr.number}</span>
                      <span>•</span>
                      <span className="truncate">{pr.base?.repo?.full_name}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <img 
                          src={pr.user.avatar_url} 
                          alt={pr.user.login}
                          className="h-4 w-4 rounded-full"
                        />
                        <span>{pr.user.login}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {(pr.changed_files ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {pr.changed_files} files
                        </span>
                      )}
                      {((pr.additions ?? 0) > 0 || (pr.deletions ?? 0) > 0) && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">+{pr.additions ?? 0}</span>
                          <span className="text-red-600">-{pr.deletions ?? 0}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 