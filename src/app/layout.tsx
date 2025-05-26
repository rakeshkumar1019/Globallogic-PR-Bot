import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextAuthProvider } from '@/lib/auth/provider'
import { QueryProvider } from '@/lib/query/provider'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'prview.ai - Smart Code Reviews',
  description: 'Get context-aware comments on your PRs with quick fix suggestions. Ship faster with AI-powered code reviews.',
  keywords: 'AI, code review, GitHub, pull requests, automation, development tools',
  authors: [{ name: 'Smart Code Reviews' }],
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'prview.ai - Smart Code Reviews',
    description: 'Get context-aware comments on your PRs with quick fix suggestions.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'prview.ai - Smart Code Reviews',
    description: 'Get context-aware comments on your PRs with quick fix suggestions.',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const dynamic = 'auto'
export const revalidate = 3600

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="preconnect" href="https://avatars.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
        
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#8B5CF6" />
        
        {/* Favicon links */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <NextAuthProvider>
          <QueryProvider>
            <div className="relative flex min-h-screen flex-col">
              <main className="flex-1">
                {children}
              </main>
            </div>
            <Toaster />
          </QueryProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
