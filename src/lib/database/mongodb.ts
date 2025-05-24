import mongoose from 'mongoose';

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  try {
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL;
    
    if (!mongoUrl) {
      throw new Error('MongoDB connection string not found in environment variables');
    }

    await mongoose.connect(mongoUrl);
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
} 