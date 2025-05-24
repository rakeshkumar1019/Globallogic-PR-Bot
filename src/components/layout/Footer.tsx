import { GitPullRequest, Github, Twitter, Linkedin } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
              <GitPullRequest className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900">PR Dashboard</span>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Documentation
            </Link>
            <Link href="/support" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Support
            </Link>
            <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Privacy
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-4">
            <Link href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
              <Github className="h-4 w-4" />
            </Link>
            <Link href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
              <Twitter className="h-4 w-4" />
            </Link>
            <Link href="#" className="text-gray-400 hover:text-gray-600 transition-colors">
              <Linkedin className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            © 2024 PR Dashboard. Built with Next.js and powered by GitHub API.
          </p>
        </div>
      </div>
    </footer>
  );
} 