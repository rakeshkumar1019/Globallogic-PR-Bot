# GlobalLogic PR Review Agent

A professional web application for reviewing GitHub pull requests using AI-powered insights. This application allows users to connect their GitHub account, view their repositories, and configure different LLM providers for PR analysis.

## AI Review Setup

The application supports multiple AI providers for code review generation:

### Ollama (Local AI)
1. Install Ollama from [https://ollama.ai](https://ollama.ai)
2. Pull the codellama model:
   ```bash
   ollama pull codellama
   ```
3. Start Ollama service:
   ```bash
   ollama serve
   ```
4. The service will run on `http://localhost:11434`

### Google Gemini
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Set the API key in your environment or use it directly in the app

### OpenAI
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set the API key in your environment or use it directly in the app

### Demo Mode
If no AI service is available, the application will automatically use demo review comments for demonstration purposes.

## Features

- 🎨 Modern UI/UX with gradient backgrounds and glass morphism effects
- ⚡ Performance optimized with Next.js caching (5-minute TTL for most data)
- 🤖 Multiple AI providers (Ollama, Gemini, OpenAI) with automatic fallbacks
- 📱 Responsive design that works on all screen sizes
- 🔍 Advanced PR filtering and search capabilities
- 💬 AI-powered code review with approval/rejection workflow
- 📊 Real-time GitHub integration with repository and organization support
- 🎯 Detailed PR view with syntax-highlighted diffs

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- A GitHub account
- GitHub OAuth App credentials (Client ID and Secret)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/globallogic-pr-bot.git
cd globallogic-pr-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file based on the example:

```bash
cp .env.local.example .env.local
```

4. Update the `.env.local` file with your GitHub OAuth credentials and NextAuth secret:

```
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
NEXTAUTH_SECRET=your_random_secret_key
NEXTAUTH_URL=http://localhost:3000
```

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Creating GitHub OAuth App

1. Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App
2. Fill in the application details:
   - Application name: GlobalLogic PR Review Agent
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3000/api/auth/callback/github
3. Register the application and copy the Client ID and Client Secret to your `.env.local` file

## LLM Provider Configuration

The application supports three LLM providers:

### OpenAI
- Requires an API key from [OpenAI Platform](https://platform.openai.com/)
- Supports various models including GPT-4

### Google Gemini
- Requires an API key from [Google AI Studio](https://ai.google.dev/)
- Supports Gemini models

### Ollama
- Self-hosted option for running models locally
- Configure the base URL (default: http://localhost:11434)
- Choose from available models in your Ollama instance

## License

This project is licensed under the MIT License - see the LICENSE file for details.
# Globallogic-PR-Bot
