"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Stale time - how long data is considered fresh (15 minutes)
          staleTime: 15 * 60 * 1000,
          // Cache time - how long inactive data stays in cache (1 hour)
          gcTime: 60 * 60 * 1000,
          // Retry failed requests 1 time only
          retry: 1,
          // Don't refetch on window focus for better UX
          refetchOnWindowFocus: false,
          // Don't refetch on mount if data exists and is not stale
          refetchOnMount: false,
          // Don't refetch on reconnect
          refetchOnReconnect: false,
          // Network mode online - only fetch when online
          networkMode: 'online',
          // Use data while refetching
          structuralSharing: true,
        },
        mutations: {
          retry: 1,
        },
      },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
} 