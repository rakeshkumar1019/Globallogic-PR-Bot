import { useRouter } from 'next/navigation';
import { PullRequest, Repository } from '@/lib/github/api';
import { PRFilters, PaginationState } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface PRListProps {
  pullRequests: PullRequest[];
  repositories: Repository[];
  filters: PRFilters;
  pagination: PaginationState;
  onFilterChange: (filters: PRFilters) => void;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function PRList({
  pullRequests,
  repositories,
  filters,
  pagination,
  onFilterChange,
  onPageChange,
  loading = false,
}: PRListProps) {
  const router = useRouter();

  const handleRepositoryChange = (value: string) => {
    onFilterChange({ ...filters, repository: value });
  };

  const handleStatusChange = (value: string) => {
    onFilterChange({ ...filters, status: value as PRFilters['status'] });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchQuery: event.target.value });
  };

  const handlePRClick = (pr: PullRequest) => {
    const [owner, repo] = pr.base?.repo?.full_name?.split('/') || ['', ''];
    if (owner && repo) {
      router.push(`/pull-request/review/${owner}/${repo}/${pr.number}`);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-200 bg-gray-50">
        <CardTitle className="text-2xl font-bold mb-6">Pull Requests</CardTitle>
        <div className="flex flex-col space-y-4 lg:flex-row lg:space-x-6 lg:space-y-0">
          <Select value={filters.repository} onValueChange={handleRepositoryChange}>
            <SelectTrigger className="w-full lg:w-[280px] bg-white">
              <SelectValue placeholder="Select Repository" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Repositories</SelectItem>
              {repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.full_name}>
                  {repo.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={filters.status} onValueChange={handleStatusChange} className="w-full lg:w-auto">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="all" className="px-6">All</TabsTrigger>
              <TabsTrigger value="pending" className="px-6">Pending Review</TabsTrigger>
              <TabsTrigger value="reviewed" className="px-6">Reviewed</TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            placeholder="Search pull requests..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-full lg:w-[350px] bg-white"
          />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 rounded-lg border bg-gray-50 animate-pulse">
                  <div className="flex items-start space-x-4">
                    <div className="h-12 w-12 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : pullRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 mb-4">
                <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No pull requests found</h3>
              <p className="text-gray-600 text-lg">
                No pull requests match your current criteria
              </p>
            </div>
          ) : (
            pullRequests.map((pr) => (
              <div
                key={pr.id}
                className="flex items-start space-x-4 p-6 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300"
                onClick={() => handlePRClick(pr)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                  <AvatarFallback className="text-lg">{pr.user.login[0].toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-lg">
                      {pr.title}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <Badge variant={pr.state === 'open' ? 'default' : 'secondary'} className="px-3 py-1">
                        {pr.state}
                      </Badge>
                      {pr.draft && (
                        <Badge variant="outline" className="px-3 py-1">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-600 text-base">
                    #{pr.number} opened by <span className="font-medium">{pr.user.login}</span>
                  </p>

                  <div className="flex items-center space-x-6 text-base text-gray-600">
                    <span className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                      </svg>
                      <span>{pr.base?.repo?.full_name || 'Unknown repo'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                    </span>
                    {pr.changed_files > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-2">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <span>{pr.changed_files} files changed</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {!loading && pullRequests.length > 0 && (
            <div className="flex items-center justify-center space-x-4 pt-8 border-t border-gray-200">
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="bg-white border-gray-300 px-6"
              >
                Previous
              </Button>
              <span className="text-base text-gray-600 px-4 font-medium">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
              </span>
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.perPage)}
                className="bg-white border-gray-300 px-6"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 