import './globals.css'
import type { Metadata } from 'next'
import { Inter as FontSans } from 'next/font/google'
import { NextAuthProvider } from '@/lib/auth/provider'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/toaster'

const fontSans = FontSans({ 
  subsets: ['latin'],
  variable: '--font-sans', 
})

export const metadata: Metadata = {
  title: 'GlobalLogic PR Review Agent',
  description: 'AI-powered PR review and analysis',
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
            {/* <Header /> */}
            <main className="flex-1">
              <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                {children}
              </div>
            </main>
            {/* <Footer /> */}
          </div>
          <Toaster />
        </NextAuthProvider>
      </body>
    </html>
  )
}
