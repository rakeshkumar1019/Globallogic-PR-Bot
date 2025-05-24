import './globals.css'
import type { Metadata } from 'next'
import { Inter as FontSans } from 'next/font/google'
import { NextAuthProvider } from '@/lib/auth/provider'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'

const fontSans = FontSans({ 
  subsets: ['latin'],
  variable: '--font-sans', 
})

export const metadata: Metadata = {
  title: 'PR.AI - Ship Faster with Smart Code Reviews',
  description: 'Your second pair of eyes. Get context-aware comments on your PRs with quick fix suggestions. Just push one comment to publish.',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
        sizes: '32x32',
      },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
    other: [
      {
        rel: 'icon',
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable
      )}>
        <NextAuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <main className="flex-1">
              {children}
            </main>
          </div>
          <Toaster />
        </NextAuthProvider>
      </body>
    </html>
  )
}
