'use client';

import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  return (
    <div className="flex flex-col items-center min-h-screen">
      <div className="max-w-5xl w-full text-center py-16 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mx-auto max-w-3xl space-y-6 mb-16">
          <div className="space-y-2">
            <Badge variant="secondary" className="mb-2">AI-Powered Code Reviews</Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              GlobalLogic PR Review Agent
            </h1>
            <p className="text-xl text-muted-foreground max-w-prose mx-auto">
              Streamline your code reviews with AI-powered insights and suggestions.
              Connect with GitHub to get started.
            </p>
          </div>
          
          <div className="flex justify-center">
            {status === 'loading' ? (
              <div className="animate-pulse p-4 text-muted-foreground">Loading...</div>
            ) : status === 'authenticated' ? (
              <Button size="lg" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            ) : (
              <Button 
                size="lg"
                onClick={() => signIn('github')}
                className="flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" className="fill-current">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Sign in with GitHub
              </Button>
            )}
          </div>
        </div>
        
        {/* Features Section */}
        <div className="space-y-8">
          <h2 className="text-3xl font-bold">Key Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="rounded-full bg-primary/10 p-2.5 w-10 h-10 mb-2.5 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="text-primary"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="M12 17h.01"/>
                  </svg>
                </div>
                <CardTitle>Smart PR Reviews</CardTitle>
                <CardDescription>
                  Get instant feedback on your pull requests with AI-powered analysis
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="rounded-full bg-primary/10 p-2.5 w-10 h-10 mb-2.5 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="text-primary"
                  >
                    <path d="M12 2H2v10h10V2ZM22 2h-8v8h8V2ZM12 14H2v8h10v-8ZM22 14h-8v8h8v-8Z"/>
                  </svg>
                </div>
                <CardTitle>Code Quality</CardTitle>
                <CardDescription>
                  Improve your code quality with suggestions for best practices and potential bugs
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="rounded-full bg-primary/10 p-2.5 w-10 h-10 mb-2.5 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="text-primary"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </div>
                <CardTitle>Customizable</CardTitle>
                <CardDescription>
                  Choose from multiple LLM providers to power your code reviews
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          
          <div className="py-12">
            <div className="relative mx-auto max-w-2xl">
              <Tabs defaultValue="openai" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                  <TabsTrigger value="openai">OpenAI</TabsTrigger>
                  <TabsTrigger value="gemini">Google Gemini</TabsTrigger>
                  <TabsTrigger value="ollama">Ollama</TabsTrigger>
                </TabsList>
                <TabsContent value="openai" className="p-4 border rounded-lg bg-card text-left">
                  <code className="text-sm text-muted-foreground">
                    <div className="font-semibold">Using OpenAI for PR reviews</div>
                    <div>{`const reviewer = new PRReviewer('openai');`}</div>
                    <div>{`await reviewer.analyze(pullRequest);`}</div>
                  </code>
                </TabsContent>
                <TabsContent value="gemini" className="p-4 border rounded-lg bg-card text-left">
                  <code className="text-sm text-muted-foreground">
                    <div className="font-semibold">Using Google Gemini for PR reviews</div>
                    <div>{`const reviewer = new PRReviewer('gemini');`}</div>
                    <div>{`await reviewer.analyze(pullRequest);`}</div>
                  </code>
                </TabsContent>
                <TabsContent value="ollama" className="p-4 border rounded-lg bg-card text-left">
                  <code className="text-sm text-muted-foreground">
                    <div className="font-semibold">Using Ollama for PR reviews</div>
                    <div>{`const reviewer = new PRReviewer('ollama');`}</div>
                    <div>{`await reviewer.analyze(pullRequest);`}</div>
                  </code>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
