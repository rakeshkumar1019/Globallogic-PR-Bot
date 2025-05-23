# GlobalLogic PR Review Agent

A professional web application for reviewing GitHub pull requests using AI-powered insights. This application allows users to connect their GitHub account, view their repositories, and configure different LLM providers for PR analysis.

## Features

- **GitHub Integration**: Login with GitHub and access your repositories
- **Repository Dashboard**: View all your GitHub repositories with detailed information
- **Multiple LLM Providers**: Configure and use OpenAI, Google Gemini, or Ollama for PR reviews
- **Customizable Settings**: Set API keys, models, and other provider-specific settings

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
