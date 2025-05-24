import { Suspense } from 'react';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { RepositoriesContent } from '@/components/repositories/repositories-content';

function RepositoriesFallback() {
  return (
    <SidebarLayout title="Repositories">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Loading Repositories</h3>
            <p className="text-sm text-gray-600">Fetching your repositories...</p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense fallback={<RepositoriesFallback />}>
      <RepositoriesContent />
    </Suspense>
  );
} 