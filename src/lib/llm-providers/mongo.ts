import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable');
}
if (!dbName) {
  throw new Error('Please define the MONGODB_DB environment variable');
}

const mongoUri: string = uri;
const mongoDbName: string = dbName;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUri);
    await cachedClient.connect();
  }
  cachedDb = cachedClient.db(mongoDbName);
  return cachedDb;
} 