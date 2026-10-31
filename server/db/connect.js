import mongoose from 'mongoose';
import dns from 'node:dns';

export async function connectDB() {
  try {
    // Configure DNS servers
    dns.setServers(['8.8.8.8', '1.1.1.1']);

    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is missing');
    }

    console.log('Connecting to MongoDB...');

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log('✅ Connected to MongoDB');

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}