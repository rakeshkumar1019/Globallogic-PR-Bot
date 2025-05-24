import { Suspense } from 'react';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { PullRequestsContent } from '@/components/prs/prs-content';

function PRsFallback() {
  return (
    <SidebarLayout title="Pull Requests">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Loading Pull Requests</h3>
            <p className="text-sm text-gray-600">Fetching PRs from selected repositories...</p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

export default function PRsPage() {
  return (
    <Suspense fallback={<PRsFallback />}>
      <PullRequestsContent />
    </Suspense>
  );
} 