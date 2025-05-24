import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { AIReviewComment } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { pullRequest, comments } = await request.json() as {
      pullRequest: {
        number: number;
        base: {
          repo: {
            full_name: string;
          };
        };
      };
      comments: AIReviewComment[];
    };

    // Separate line comments and general comments
    const lineComments = comments.filter(comment => comment.filePath && comment.startLine > 0);
    const generalComments = comments.filter(comment => !comment.filePath || comment.startLine <= 0);

    const [owner, repo] = pullRequest.base.repo.full_name.split('/');
    
    // Prepare review body from general comments
    let reviewBody = '';
    if (generalComments.length > 0) {
      reviewBody = generalComments.map(comment => comment.content).join('\n\n---\n\n');
    }
    
    // Prepare line comments for GitHub API
    const githubLineComments = lineComments.map(comment => ({
      path: comment.filePath,
      line: comment.startLine,
      body: comment.content
    }));

    // Submit review to GitHub
    const reviewData: {
      event: string;
      body?: string;
      comments?: Array<{ path: string; line: number; body: string }>;
    } = {
      event: 'COMMENT'
    };
    
    // Only add body if there are general comments
    if (reviewBody) {
      reviewData.body = reviewBody;
    }
    
    if (githubLineComments.length > 0) {
      reviewData.comments = githubLineComments;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequest.number}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit review: ${error}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error submitting review:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal server error',
      { status: 500 }
    );
  }
} 