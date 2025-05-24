import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    unique: true,
  },
  starredRepositories: [{
    type: String,
    required: true,
  }],
  llmProvider: {
    type: String,
    enum: ['ollama', 'gemini', 'openai'],
    default: 'ollama',
  },
  llmConfig: {
    ollamaUrl: String,
    geminiApiKey: String,
    openaiApiKey: String,
  },
}, {
  timestamps: true,
});

// Index is already created by unique: true option above

export default mongoose.models.UserSettings || mongoose.model('UserSettings', userSettingsSchema); 