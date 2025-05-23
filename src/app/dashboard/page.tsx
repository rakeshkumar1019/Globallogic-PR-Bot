'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GitHubClient, Repository, UserProfile, PullRequest, PullRequestFilters } from '@/lib/github/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoSearchOpen, setRepoSearchOpen] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  
  // PR filters and pagination
  const [prFilters, setPrFilters] = useState<PullRequestFilters>({
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 10,
    page: 1
  });
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    hasNext: false,
    hasPrev: false,
    totalCount: 0
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }

    if (status === 'authenticated' && session?.accessToken) {
      const loadData = async () => {
        try {
          const github = new GitHubClient(session.accessToken);
          const [userProfileData, reposData] = await Promise.all([
            github.getUserProfile(),
            github.getUserRepositories(),
          ]);
          
          setUserProfile(userProfileData);
          setRepositories(reposData);
          setLoading(false);
        } catch (err) {
          console.error('Error loading GitHub data:', err);
          setError('Failed to load data from GitHub. Please try again later.');
          setLoading(false);
        }
      };

      loadData();
    }
  }, [status, session, router]);

  const loadPullRequests = async (repo: Repository, filters: PullRequestFilters) => {
    if (!session?.accessToken) return;
    
    setLoadingPRs(true);
    try {
      const github = new GitHubClient(session.accessToken);
      const [owner, repoName] = repo.full_name.split('/');
      const result = await github.getRepositoryPullRequests(owner, repoName, filters);
      
      setPullRequests(result.pullRequests);
      setPagination({
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        totalCount: result.totalCount
      });
    } catch (err) {
      console.error('Error loading pull requests:', err);
      setError('Failed to load pull requests. Please try again.');
    } finally {
      setLoadingPRs(false);
    }
  };

  useEffect(() => {
    if (selectedRepo) {
      loadPullRequests(selectedRepo, prFilters);
    }
  }, [selectedRepo, prFilters]);

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo);
    setRepoSearchOpen(false);
    setPrFilters(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleFilterChange = (key: keyof PullRequestFilters, value: string | number) => {
    setPrFilters(prev => ({ ...prev, [key]: value, page: 1 })); // Reset to first page on filter change
  };

  const handlePageChange = (page: number) => {
    setPrFilters(prev => ({ ...prev, page }));
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(repoSearchQuery.toLowerCase())
  );

  const filteredPullRequests = pullRequests.filter(pr => {
    if (!prSearchQuery) return true;
    return (
      pr.title.toLowerCase().includes(prSearchQuery.toLowerCase()) ||
      pr.number.toString().includes(prSearchQuery) ||
      pr.user.login.toLowerCase().includes(prSearchQuery.toLowerCase())
    );
  });

  if (status === 'loading' || loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-center">
                <Skeleton className="h-20 w-20 rounded-full" />
              </div>
              <div className="text-center space-y-2">
                <Skeleton className="h-5 w-32 mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center p-4 text-red-800 rounded-lg bg-red-50 border border-red-200" role="alert">
        <svg className="flex-shrink-0 w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
        </svg>
        <span className="sr-only">Error</span>
        <div className="ms-3">
          <span className="font-medium">Error:</span> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* User Profile */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex justify-center">
              <Avatar className="h-20 w-20 mb-2">
                <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.name || userProfile?.login || 'User'} />
                <AvatarFallback>{userProfile?.name?.charAt(0) || userProfile?.login?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <CardTitle className="text-lg">{userProfile?.name}</CardTitle>
              <CardDescription>@{userProfile?.login}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {userProfile?.bio && (
              <p className="text-center text-muted-foreground text-sm mb-4">
                {userProfile.bio}
              </p>
            )}
            
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-md bg-secondary p-3 text-center">
                <p className="text-xs text-muted-foreground">Repos</p>
                <p className="font-medium text-sm">{userProfile?.public_repos}</p>
              </div>
              <div className="rounded-md bg-secondary p-3 text-center">
                <p className="text-xs text-muted-foreground">Followers</p>
                <p className="font-medium text-sm">{userProfile?.followers}</p>
              </div>
              <div className="rounded-md bg-secondary p-3 text-center">
                <p className="text-xs text-muted-foreground">Following</p>
                <p className="font-medium text-sm">{userProfile?.following}</p>
              </div>
            </div>
            
            {userProfile?.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {userProfile.location}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0">
            <a
              href={userProfile?.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline w-full text-center"
            >
              View GitHub Profile
            </a>
          </CardFooter>
        </Card>

        {/* Repository and Pull Requests */}
        <div className="lg:col-span-3">
          <div className="space-y-6">
            {/* Repository Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Pull Request Management</h2>
                <Badge variant="outline" className="text-xs">
                  {repositories.length} repositories
                </Badge>
              </div>
              
              <Popover open={repoSearchOpen} onOpenChange={setRepoSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={repoSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedRepo ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        {selectedRepo.name}
                        <Badge variant="secondary" className="text-xs">
                          {selectedRepo.language || 'No language'}
                        </Badge>
                      </div>
                    ) : (
                      "Select repository..."
                    )}
                    <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput 
                      placeholder="Search repositories..." 
                      value={repoSearchQuery}
                      onValueChange={setRepoSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No repositories found.</CommandEmpty>
                      <CommandGroup>
                        {filteredRepositories.map((repo) => (
                          <CommandItem
                            key={repo.id}
                            value={repo.name}
                            onSelect={() => handleRepoSelect(repo)}
                            className="flex items-center gap-2"
                          >
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <div className="flex-1">
                              <div className="font-medium">{repo.name}</div>
                              {repo.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {repo.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {repo.language && (
                                <Badge variant="outline" className="text-xs">
                                  {repo.language}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                ⭐ {repo.stargazers_count}
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Pull Requests Section */}
            {selectedRepo && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Pull Requests
                      <Badge variant="outline" className="text-xs">
                        {selectedRepo.name}
                      </Badge>
                    </CardTitle>
                  </div>
                  
                  {/* Filters and Search */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search PRs by title, number, or author..."
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select 
                        value={prFilters.state} 
                        onValueChange={(value) => handleFilterChange('state', value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={prFilters.sort} 
                        onValueChange={(value) => handleFilterChange('sort', value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="updated">Updated</SelectItem>
                          <SelectItem value="created">Created</SelectItem>
                          <SelectItem value="popularity">Popular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {loadingPRs ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : filteredPullRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="mt-2">No pull requests found</p>
                      <p className="text-sm">Try adjusting your filters or search query</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredPullRequests.map((pr) => (
                        <div key={pr.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
                            <AvatarFallback>{pr.user.login.charAt(0)}</AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                {pr.title}
                              </a>
                              <Badge variant="outline" className="text-xs">
                                #{pr.number}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              by {pr.user.login} • {new Date(pr.updated_at).toLocaleDateString()}
                              {pr.head.ref !== pr.base.ref && (
                                <span className="ml-2">
                                  {pr.head.ref} → {pr.base.ref}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={pr.state === 'open' ? 'default' : 'secondary'}
                              className={pr.state === 'open' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                            >
                              {pr.state}
                            </Badge>
                            {pr.draft && (
                              <Badge variant="outline" className="text-xs">
                                Draft
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                {/* Pagination */}
                {!loadingPRs && filteredPullRequests.length > 0 && (
                  <CardFooter className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Page {prFilters.page} • Showing {filteredPullRequests.length} results
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => handlePageChange((prFilters.page || 1) - 1)}
                            className={!pagination.hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink onClick={() => handlePageChange(1)}>
                            1
                          </PaginationLink>
                        </PaginationItem>
                        {(prFilters.page || 1) > 2 && <PaginationEllipsis />}
                        {(prFilters.page || 1) > 1 && (prFilters.page || 1) !== 2 && (
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageChange((prFilters.page || 1))}>
                              {prFilters.page}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => handlePageChange((prFilters.page || 1) + 1)}
                            className={!pagination.hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </CardFooter>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 