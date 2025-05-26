"use client"

import { useState, useEffect, useMemo, memo, Suspense } from "react"
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Bot, CheckCircle, Zap, Shield, Clock, ArrowRight, Github, MessageSquare, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Memoized static data
const steps = [
  {
    id: 1,
    title: "AI Analyzes Your PR",
    description: "Scans code changes for issues, patterns & improvements",
    icon: Eye,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: 2,
    title: "Generates Smart Comments",
    description: "Context-aware suggestions with quick fixes",
    icon: MessageSquare,
    color: "from-purple-500 to-pink-500",
    example: '"Consider using const instead of let here"',
  },
  {
    id: 3,
    title: "One-Click Publish",
    description: "Review, approve & publish to GitHub instantly",
    icon: CheckCircle,
    color: "from-green-500 to-emerald-500",
  },
];

// Memoized header component
const Header = memo(({ status, router, onSignIn }: { 
  status: string; 
  router: AppRouterInstance; 
  onSignIn: () => void; 
}) => (
  <header className="p-6 flex justify-between items-center">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
        <Bot className="w-6 h-6" />
      </div>
      <div>
        <div className="text-xl font-bold">PR.AI</div>
        <div className="text-xs text-gray-400">by Velocity AI</div>
      </div>
    </div>

    <div>
      {status === 'loading' ? (
        <div className="animate-pulse">
          <div className="h-10 w-36 bg-gray-700 rounded"></div>
        </div>
      ) : status === 'authenticated' ? (
        <Button 
          onClick={() => router.push('/dashboard')} 
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      ) : (
        <Button 
          onClick={onSignIn}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
        >
          <Github className="w-4 h-4 mr-2" />
          Start with GitHub
        </Button>
      )}
    </div>
  </header>
));
Header.displayName = 'Header';

// Memoized static content component
const StaticContent = memo(({ status, router, onSignIn }: { 
  status: string; 
  router: AppRouterInstance; 
  onSignIn: () => void; 
}) => (
  <div className="space-y-8">
    <div className="space-y-6">
      <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
        <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Ship Faster with
        </span>
        <br />
        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
          Smart Code Reviews
        </span>
      </h1>

      <p className="text-xl text-gray-300 leading-relaxed">
        Your second pair of eyes. Get context-aware comments on your PRs with quick fix suggestions. Just push
        one comment to publish.
      </p>

      {/* Key Features */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3 text-gray-300">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span>Quick fix suggestions with 95% accuracy</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-300">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span>Context-aware comments that understand your code</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-300">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span>One-click publishing to GitHub PRs</span>
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row gap-4">
      {status === 'loading' ? (
        <div className="animate-pulse">
          <div className="h-12 w-44 bg-gray-700 rounded"></div>
        </div>
      ) : status === 'authenticated' ? (
        <Button
          size="lg"
          onClick={() => router.push('/dashboard')}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
        >
          <ArrowRight className="w-5 h-5 mr-2" />
          Go to Dashboard
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={onSignIn}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
        >
          <Github className="w-5 h-5 mr-2" />
          Start with GitHub
        </Button>
      )}
    </div>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-6 pt-8">
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-400">2x</div>
        <div className="text-sm text-gray-400">Faster</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-pink-400">95%</div>
        <div className="text-sm text-gray-400">Accurate</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-400">1-Click</div>
        <div className="text-sm text-gray-400">Publish</div>
      </div>
    </div>
  </div>
));
StaticContent.displayName = 'StaticContent';

// Simplified animation component with reduced complexity
const SimpleAnimatedProcess = memo(({ currentStep, isAnimating }: { 
  currentStep: number; 
  isAnimating: boolean; 
}) => (
  <div className="relative w-full max-w-md mx-auto">
    {/* Central Hub - Simplified */}
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
      <div
        className={`w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-500 ${
          isAnimating ? 'scale-110' : 'scale-100'
        }`}
        style={{ transform: `rotate(${currentStep * 120}deg)` }}
      >
        <Bot className="w-10 h-10 text-white" />
      </div>
    </div>

    {/* Process Steps - Simplified */}
    {steps.map((step, index) => {
      const angle = index * 120 - 90;
      const radius = 120;
      const x = Math.cos((angle * Math.PI) / 180) * radius;
      const y = Math.sin((angle * Math.PI) / 180) * radius;

      return (
        <div
          key={step.id}
          className="absolute top-1/2 left-1/2"
          style={{
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
          }}
        >
          <div
            className={`relative p-4 rounded-xl bg-gradient-to-r ${step.color} transition-all duration-300 ${
              currentStep === index ? "shadow-2xl scale-120" : "opacity-60 scale-100"
            }`}
          >
            <step.icon className="w-8 h-8 text-white" />

            {/* Step Info - Only for current step */}
            {currentStep === index && (
              <div className="absolute top-full mt-4 left-1/2 transform -translate-x-1/2 text-center min-w-max">
                <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 max-w-xs">
                  <div className="font-semibold text-sm mb-1">{step.title}</div>
                  <div className="text-xs text-gray-400 mb-2">{step.description}</div>
                  {step.example && (
                    <div className="text-xs text-purple-300 italic bg-gray-900/50 rounded px-2 py-1">
                      {step.example}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })}

    {/* Simplified pulse effect */}
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="w-40 h-40 border border-purple-500/30 rounded-full animate-pulse" />
    </div>
  </div>
));
SimpleAnimatedProcess.displayName = 'SimpleAnimatedProcess';

// Memoized footer
const Footer = memo(() => (
  <footer className="p-6 border-t border-gray-800">
    <div className="max-w-6xl mx-auto text-center">
      <div className="text-sm text-gray-400 mb-4">Trusted by developers at top companies</div>
      <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-green-400" />
          <span>Enterprise Security</span>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Real-time Analysis</span>
        </div>
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span>Lightning Fast</span>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-purple-400" />
          <span>95% Accuracy</span>
        </div>
      </div>
    </div>
  </footer>
));
Footer.displayName = 'Footer';

export default function LandingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Optimized session handling with caching
  const { status } = useSession({
    required: false,
    onUnauthenticated() {
      setSessionChecked(true);
    },
  });

  // Memoized sign in handler
  const handleGitHubSignIn = useMemo(() => () => {
    signIn('github');
  }, []);

  // Optimized redirect logic
  useEffect(() => {
    if (status === 'authenticated' && !sessionChecked) {
      router.prefetch('/dashboard'); // Prefetch dashboard
      router.push('/dashboard');
    } else if (status !== 'loading') {
      setSessionChecked(true);
    }
  }, [status, router, sessionChecked]);

  // Simplified animation timer
  useEffect(() => {
    if (!sessionChecked) return; // Don't start animations until session is checked

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => (prev + 1) % steps.length);
        setIsAnimating(false);
      }, 300); // Reduced animation time
    }, 3000); // Reduced interval

    return () => clearInterval(interval);
  }, [sessionChecked]);

  // Show loading only for initial session check
  if (status === 'loading' && !sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Simplified Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

      {/* Static Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <Header status={status} router={router} onSignIn={handleGitHubSignIn} />

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Static Content */}
            <StaticContent status={status} router={router} onSignIn={handleGitHubSignIn} />

            {/* Right Side - Simplified Animated Process */}
            <div className="relative">
              <Suspense fallback={<div className="w-full h-64 bg-gray-800 rounded animate-pulse" />}>
                <SimpleAnimatedProcess currentStep={currentStep} isAnimating={isAnimating} />
              </Suspense>
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

