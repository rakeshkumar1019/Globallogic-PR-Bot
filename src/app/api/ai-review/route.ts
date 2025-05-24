import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/llm-providers/mongo';
import { Collection, Document } from 'mongodb';
import { AIReviewComment } from '@/lib/types';

interface LLMSettings {
  selectedProvider: 'openai' | 'gemini' | 'ollama';
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
}



interface FileAnalysis {
  filename: string;
  patch: string;
  addedLines: Array<{ lineNumber: number; content: string }>;
  modifiedLines: Array<{ lineNumber: number; content: string; context: string }>;
}

function parseDiffForAnalysis(filename: string, patch: string): FileAnalysis {
  const lines = patch.split('\n');
  const addedLines: Array<{ lineNumber: number; content: string }> = [];
  const modifiedLines: Array<{ lineNumber: number; content: string; context: string }> = [];
  
  let currentLine = 0;
  const contextLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('@@')) {
      // Parse hunk header to get line numbers
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentLine = parseInt(match[2], 10);
      }
      continue;
    }
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Added line
      const content = line.substring(1);
      addedLines.push({
        lineNumber: currentLine,
        content
      });
      currentLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Deleted line (don't increment currentLine)
      continue;
    } else if (line.startsWith(' ')) {
      // Context line
      contextLines.push(line.substring(1));
      if (contextLines.length > 3) {
        contextLines.shift();
      }
      currentLine++;
    }
    
    // For modified sections (add + remove together), capture context
    if (line.startsWith('+') && i > 0 && lines[i-1]?.startsWith('-')) {
      const content = line.substring(1);
      modifiedLines.push({
        lineNumber: currentLine - 1,
        content,
        context: contextLines.join('\n')
      });
    }
  }
  
  return {
    filename,
    patch,
    addedLines,
    modifiedLines
  };
}

async function generateLineComments(settings: LLMSettings, fileAnalysis: FileAnalysis[]): Promise<AIReviewComment[]> {
  const allComments: AIReviewComment[] = [];
  
  for (const file of fileAnalysis) {
    if (file.addedLines.length === 0 && file.modifiedLines.length === 0) {
      continue; // Skip files with no meaningful changes
    }
    
    const fileComments = await analyzeFileChanges(settings, file);
    allComments.push(...fileComments);
  }
  
  return allComments;
}

async function analyzeFileChanges(settings: LLMSettings, file: FileAnalysis): Promise<AIReviewComment[]> {
  const prompt = `You are an expert code reviewer. Analyze the following code changes and provide specific, actionable line-by-line feedback.

File: ${file.filename}

IMPORTANT: Only comment on issues you find. Respond in this EXACT format for each issue:
LINE:<line_number>|ISSUE:<brief_issue_description>|SUGGESTION:<specific_fix_or_improvement>

Example:
LINE:15|ISSUE:Missing null check|SUGGESTION:Add null check: if (user?.email)
LINE:23|ISSUE:Potential memory leak|SUGGESTION:Add cleanup: return () => { clearInterval(timer); }

Added/Modified Lines to Review:
${file.addedLines.map(line => `Line ${line.lineNumber}: ${line.content}`).join('\n')}
${file.modifiedLines.map(line => `Line ${line.lineNumber}: ${line.content}`).join('\n')}

Focus on:
- Code quality issues
- Potential bugs
- Performance problems
- Security vulnerabilities
- Best practices violations
- Missing error handling

Only provide comments for actual issues found. If no issues, respond with "NO_ISSUES_FOUND".`;

  try {
    const response = await callLLMProvider(settings, prompt);
    return parseLineComments(response, file.filename, settings.selectedProvider, file);
  } catch (error) {
    console.error(`Error analyzing ${file.filename}:`, error);
    return [];
  }
}

async function callLLMProvider(settings: LLMSettings, prompt: string): Promise<string> {
  switch (settings.selectedProvider) {
    case 'openai':
      return await callOpenAI(settings, prompt);
    case 'gemini':
      return await callGemini(settings, prompt);
    case 'ollama':
      return await callOllama(settings, prompt);
    default:
      throw new Error('Invalid LLM provider');
  }
}

async function callOpenAI(settings: LLMSettings, prompt: string): Promise<string> {
  if (!settings.openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.openaiModel || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a senior code reviewer. Provide concise, actionable feedback on code changes. Focus only on real issues.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3, // Lower temperature for more consistent output
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'NO_ISSUES_FOUND';
}

async function callGemini(settings: LLMSettings, prompt: string): Promise<string> {
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const model = settings.geminiModel || 'gemini-pro';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'NO_ISSUES_FOUND';
}

async function callOllama(settings: LLMSettings, prompt: string): Promise<string> {
  if (!settings.ollamaEndpoint) {
    throw new Error('Ollama endpoint not configured');
  }

  const endpoint = settings.ollamaEndpoint.endsWith('/') 
    ? settings.ollamaEndpoint 
    : settings.ollamaEndpoint + '/';

  const response = await fetch(`${endpoint}api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.ollamaModel || 'codellama',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1500,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${error}`);
  }

  const data = await response.json();
  return data.response || 'NO_ISSUES_FOUND';
}

function parseLineComments(response: string, filename: string, provider: string, fileAnalysis: FileAnalysis): AIReviewComment[] {
  const comments: AIReviewComment[] = [];
  
  if (response.trim() === 'NO_ISSUES_FOUND') {
    return comments;
  }
  
  const lines = response.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^LINE:(\d+)\|ISSUE:([^|]+)\|SUGGESTION:(.+)$/);
    if (match) {
      const [, lineNum, issue, suggestion] = match;
      const lineNumber = parseInt(lineNum, 10);
      
      // Find the actual line content and type from file analysis
      let lineContent = '';
      let lineType: 'added' | 'removed' | 'context' = 'context';
      
      const addedLine = fileAnalysis.addedLines.find(l => l.lineNumber === lineNumber);
      const modifiedLine = fileAnalysis.modifiedLines.find(l => l.lineNumber === lineNumber);
      
      if (addedLine) {
        lineContent = addedLine.content;
        lineType = 'added';
      } else if (modifiedLine) {
        lineContent = modifiedLine.content;
        lineType = 'added'; // Modified lines are shown as added in diff
      } else {
        // Try to extract from patch
        const patchLines = fileAnalysis.patch.split('\n');
        let currentLine = 0;
        
        for (const patchLine of patchLines) {
          if (patchLine.startsWith('@@')) {
            const match = patchLine.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
            if (match) {
              currentLine = parseInt(match[2], 10);
            }
            continue;
          }
          
          if (currentLine === lineNumber) {
            if (patchLine.startsWith('+')) {
              lineContent = patchLine.substring(1);
              lineType = 'added';
            } else if (patchLine.startsWith('-')) {
              lineContent = patchLine.substring(1);
              lineType = 'removed';
            } else if (patchLine.startsWith(' ')) {
              lineContent = patchLine.substring(1);
              lineType = 'context';
            }
            break;
          }
          
          if (patchLine.startsWith('+') || patchLine.startsWith(' ')) {
            currentLine++;
          }
        }
      }
      
      comments.push({
        id: `${filename}-${lineNum}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filePath: filename,
        startLine: lineNumber,
        content: `**${issue.trim()}**\n\n${suggestion.trim()}`,
        provider: provider as 'openai' | 'gemini' | 'ollama',
        timestamp: new Date().toISOString(),
        status: 'pending',
        isEditing: false,
        originalContent: `**${issue.trim()}**\n\n${suggestion.trim()}`,
        lineContent,
        lineType
      });
    }
  }
  
  return comments;
}

export async function POST(req: NextRequest) {
  try {
    const { user, prData } = await req.json();
    
    if (!user) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    if (!prData || !prData.files || prData.files.length === 0) {
      return NextResponse.json({ error: 'PR data with files required' }, { status: 400 });
    }

    // Get user's LLM settings from MongoDB
    const db = await getMongoDb();
    const collection: Collection<Document> = db.collection('llmsettings');
    const doc = await collection.findOne({ email: user });
    
    if (!doc) {
      return NextResponse.json({ 
        error: 'No LLM configuration found. Please configure your AI settings first.' 
      }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, email, ...settings } = doc;
    const llmSettings = settings as LLMSettings;

    if (!llmSettings.selectedProvider) {
      return NextResponse.json({ 
        error: 'No LLM provider selected. Please configure your AI settings.' 
      }, { status: 400 });
    }

    // Parse file diffs for analysis
    const fileAnalysis = prData.files
      .filter((file: { filename: string; patch: string }) => file.patch && file.patch.trim().length > 0)
      .map((file: { filename: string; patch: string }) => parseDiffForAnalysis(file.filename, file.patch));

    if (fileAnalysis.length === 0) {
      return NextResponse.json({ 
        comments: [],
        provider: llmSettings.selectedProvider,
        success: true,
        message: 'No meaningful changes found to review'
      });
    }

    // Generate line-specific comments
    const comments = await generateLineComments(llmSettings, fileAnalysis);

    return NextResponse.json({ 
      comments,
      provider: llmSettings.selectedProvider,
      success: true,
      filesAnalyzed: fileAnalysis.length
    });

  } catch (error) {
    console.error('Error in AI review API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate AI review',
      success: false 
    }, { status: 500 });
  }
} 