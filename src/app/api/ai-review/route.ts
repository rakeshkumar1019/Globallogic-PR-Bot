import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/llm-providers/mongo';
import { Collection, Document } from 'mongodb';

interface LLMSettings {
  selectedProvider: 'openai' | 'gemini' | 'ollama';
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
}

interface PRData {
  title: string;
  body: string;
  diff?: string;
  files?: Array<{
    filename: string;
    patch: string;
  }>;
}

async function generateAIComment(settings: LLMSettings, prData: PRData): Promise<string> {
  const prompt = `You are an expert code reviewer. Please provide a thorough review of this Pull Request:

Title: ${prData.title}
Description: ${prData.body || 'No description provided'}

${prData.files ? `Files changed: ${prData.files.map(f => f.filename).join(', ')}` : ''}

Please provide:
1. Overall assessment
2. Code quality feedback
3. Potential issues or concerns
4. Suggestions for improvement
5. Security considerations if applicable

Keep your review constructive and professional.`;

  try {
    switch (settings.selectedProvider) {
      case 'openai':
        return await generateOpenAIComment(settings, prompt);
      case 'gemini':
        return await generateGeminiComment(settings, prompt);
      case 'ollama':
        return await generateOllamaComment(settings, prompt);
      default:
        throw new Error('Invalid LLM provider');
    }
  } catch (error) {
    console.error('Error generating AI comment:', error);
    return `I encountered an error while generating the review. Please check your ${settings.selectedProvider} configuration and try again.`;
  }
}

async function generateOpenAIComment(settings: LLMSettings, prompt: string): Promise<string> {
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
          content: 'You are an expert code reviewer providing constructive feedback on pull requests.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No response generated';
}

async function generateGeminiComment(settings: LLMSettings, prompt: string): Promise<string> {
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
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
}

async function generateOllamaComment(settings: LLMSettings, prompt: string): Promise<string> {
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
      model: settings.ollamaModel || 'llama2',
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 1000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${error}`);
  }

  const data = await response.json();
  return data.response || 'No response generated';
}

export async function POST(req: NextRequest) {
  try {
    const { user, prData } = await req.json();
    
    if (!user) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    if (!prData) {
      return NextResponse.json({ error: 'PR data required' }, { status: 400 });
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

    // Generate AI comment
    const comment = await generateAIComment(llmSettings, prData);

    return NextResponse.json({ 
      comment,
      provider: llmSettings.selectedProvider,
      success: true 
    });

  } catch (error) {
    console.error('Error in AI review API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate AI review',
      success: false 
    }, { status: 500 });
  }
} 