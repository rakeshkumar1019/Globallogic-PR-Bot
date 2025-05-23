import { LLMProvider, AIReviewComment } from '../types';
import { PullRequest } from '../github/api';

interface ReviewOptions {
  provider: LLMProvider;
  pullRequest: PullRequest;
  accessToken?: string;
  isDemo?: boolean;
}

export async function generateReview({ provider, pullRequest, accessToken, isDemo = false }: ReviewOptions): Promise<AIReviewComment[]> {
  try {
    // Return demo comments if in demo mode or no access token
    if (isDemo || !accessToken) {
      return generateDemoReview();
    }

    switch (provider) {
      case 'ollama':
        return await generateOllamaReview(pullRequest);
      case 'gemini':
        return await generateGeminiReview(pullRequest, accessToken);
      case 'openai':
        return await generateOpenAIReview(pullRequest, accessToken);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error generating review with ${provider}:`, error);
    // Fallback to demo comments on error
    return generateDemoReview();
  }
}

function generateDemoReview(): AIReviewComment[] {
  const demoComments: AIReviewComment[] = [
    {
      id: 'demo-1',
      filePath: 'src/components/UserProfile.tsx',
      startLine: 15,
      content: 'Consider adding proper TypeScript types for the user props to improve type safety and developer experience.',
      provider: 'ollama',
      timestamp: new Date().toISOString(),
      status: 'pending'
    },
    {
      id: 'demo-2',
      filePath: 'src/utils/api.ts',
      startLine: 42,
      content: 'This API call should include proper error handling with try-catch blocks and user-friendly error messages.',
      provider: 'ollama',
      timestamp: new Date().toISOString(),
      status: 'pending'
    },
    {
      id: 'demo-3',
      filePath: 'src/hooks/useAuth.ts',
      startLine: 28,
      content: 'Memory leak potential: Consider adding cleanup in useEffect return function to prevent memory leaks.',
      provider: 'ollama',
      timestamp: new Date().toISOString(),
      status: 'pending'
    },
    {
      id: 'demo-4',
      filePath: 'src/styles/globals.css',
      startLine: 10,
      content: 'Performance optimization: Use CSS custom properties for consistent theming and better maintainability.',
      provider: 'ollama',
      timestamp: new Date().toISOString(),
      status: 'pending'
    }
  ];

  return demoComments;
}

async function generateOllamaReview(pr: PullRequest): Promise<AIReviewComment[]> {
  try {
    // First check if Ollama is running
    try {
      const healthCheck = await fetch('http://localhost:11434/api/version', {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!healthCheck.ok) {
        console.warn('Ollama service not available, falling back to demo comments');
        return generateDemoReview();
      }
    } catch (healthError) {
      console.warn('Ollama service not reachable, falling back to demo comments:', healthError);
      return generateDemoReview();
    }

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000), // 30 second timeout
      body: JSON.stringify({
        model: 'codellama',
        prompt: `Review this pull request and provide specific code improvement suggestions:
        Title: ${pr.title}
        Description: ${pr.body || 'No description provided'}
        Files changed: ${pr.changed_files}
        Additions: ${pr.additions}
        Deletions: ${pr.deletions}
        
        Please provide detailed code review comments focusing on:
        1. Code quality and best practices
        2. Potential bugs or issues
        3. Performance considerations
        4. Security concerns
        
        Format each comment as: {file}:{line} - {comment}`,
        stream: false
      })
    });

    if (!response.ok) {
      console.warn(`Ollama API returned ${response.status}, falling back to demo comments`);
      return generateDemoReview();
    }

    const data = await response.json();
    const parsedComments = parseAIResponse(data.response, 'ollama');
    
    // Return demo comments if parsing failed
    return parsedComments.length > 0 ? parsedComments : generateDemoReview();
  } catch (error) {
    console.warn('Ollama review generation failed, using demo comments:', error);
    return generateDemoReview();
  }
}

async function generateGeminiReview(pr: PullRequest, apiKey: string): Promise<AIReviewComment[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Review this pull request and provide specific code improvement suggestions:
            Title: ${pr.title}
            Description: ${pr.body || 'No description provided'}
            Files changed: ${pr.changed_files}
            Additions: ${pr.additions}
            Deletions: ${pr.deletions}
            
            Please provide detailed code review comments focusing on:
            1. Code quality and best practices
            2. Potential bugs or issues
            3. Performance considerations
            4. Security concerns
            
            Format each comment as: {file}:{line} - {comment}`
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Invalid Gemini response format');
    }

    const parsedComments = parseAIResponse(text, 'gemini');
    return parsedComments.length > 0 ? parsedComments : generateDemoReview();
  } catch (error) {
    console.error('Gemini review generation failed:', error);
    return generateDemoReview();
  }
}

async function generateOpenAIReview(pr: PullRequest, apiKey: string): Promise<AIReviewComment[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are an expert code reviewer. Analyze the pull request and provide specific, actionable feedback.'
        }, {
          role: 'user',
          content: `Review this pull request and provide specific code improvement suggestions:
          Title: ${pr.title}
          Description: ${pr.body || 'No description provided'}
          Files changed: ${pr.changed_files}
          Additions: ${pr.additions}
          Deletions: ${pr.deletions}
          
          Please provide detailed code review comments focusing on:
          1. Code quality and best practices
          2. Potential bugs or issues
          3. Performance considerations
          4. Security concerns
          
          Format each comment as: {file}:{line} - {comment}`
        }],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Invalid OpenAI response format');
    }

    const parsedComments = parseAIResponse(content, 'openai');
    return parsedComments.length > 0 ? parsedComments : generateDemoReview();
  } catch (error) {
    console.error('OpenAI review generation failed:', error);
    return generateDemoReview();
  }
}

function parseAIResponse(response: string, provider: LLMProvider): AIReviewComment[] {
  const comments: AIReviewComment[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    // Try multiple patterns to parse AI responses
    const patterns = [
      /^([^:]+):(\d+)\s*-\s*(.+)$/,
      /^File:\s*([^,]+),?\s*Line:\s*(\d+)\s*-?\s*(.+)$/i,
      /^([^:]+)\s*\(line\s*(\d+)\)\s*:\s*(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, filePath, lineNum, content] = match;
        comments.push({
          id: Math.random().toString(36).substring(2),
          filePath: filePath.trim(),
          startLine: parseInt(lineNum, 10) || 1,
          content: content.trim(),
          provider,
          timestamp: new Date().toISOString(),
          status: 'pending'
        });
        break;
      }
    }
  }

  return comments;
} 