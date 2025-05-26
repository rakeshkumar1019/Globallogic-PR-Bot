import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/llm-providers/mongo';
import { Collection, Document } from 'mongodb';
import { ApiCache } from '@/lib/cache/api-cache';

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json(null, { status: 400 });
  
  // Try cache first
  const cachedSettings = await ApiCache.getUserSettings(user);
  if (cachedSettings) {
    return NextResponse.json(cachedSettings);
  }
  
  const db = await getMongoDb();
  const collection: Collection<Document> = db.collection('llmsettings');
  
  // Use the user's email as the unique key (field 'email')
  const doc = await collection.findOne({ email: user });
  if (!doc) return NextResponse.json(null);
  
  // Remove the _id and email fields from the response to return only settings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, email, ...settings } = doc;
  
  // Cache the result
  ApiCache.setUserSettings(user, settings as Record<string, unknown>);
  
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const { user, settings } = await req.json();
  if (!user) return NextResponse.json({ error: 'User required' }, { status: 400 });
  
  // Remove any _id field from settings to prevent immutable field error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...settingsWithoutId } = settings || {};
  
  const db = await getMongoDb();
  const collection: Collection<Document> = db.collection('llmsettings');
  
  // Store the settings fields directly at the root, along with the email
  await collection.updateOne(
    { email: user }, // Use email for comparison/lookup
    { $set: { email: user, ...settingsWithoutId } }, // Exclude _id field
    { upsert: true }
  );
  
  // Update cache with new settings
  ApiCache.setUserSettings(user, settingsWithoutId as Record<string, unknown>);
  
  return NextResponse.json({ success: true });
} 