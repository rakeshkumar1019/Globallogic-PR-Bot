import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AIReviewComment } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
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

    // Group comments by file
    const commentsByFile = comments.reduce((acc, comment) => {
      if (!acc[comment.filePath]) {
        acc[comment.filePath] = [];
      }
      acc[comment.filePath].push(comment);
      return acc;
    }, {} as Record<string, AIReviewComment[]>);

    // Submit review comments to GitHub
    const [owner, repo] = pullRequest.base.repo.full_name.split('/');
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequest.number}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'COMMENT',
        comments: Object.entries(commentsByFile).flatMap(([filePath, fileComments]) =>
          fileComments.map(comment => ({
            path: filePath,
            line: comment.startLine,
            body: comment.content
          }))
        )
      })
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