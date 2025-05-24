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
  title: 'PR.AI - Intelligent PR Assistant',
  description: 'AI-powered pull request review and analysis platform',
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
