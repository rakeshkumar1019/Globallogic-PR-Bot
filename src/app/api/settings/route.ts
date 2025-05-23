import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/llm-providers/mongo';
import { Collection, Document } from 'mongodb';

export async function GET(req: NextRequest) {
  const db = await getMongoDb();
  const collection: Collection<Document> = db.collection('llmsettings');
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json(null, { status: 400 });
  
  // Use the user's email as the unique key (field 'email')
  const doc = await collection.findOne({ email: user });
  if (!doc) return NextResponse.json(null);
  
  // Remove the _id and email fields from the response to return only settings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, email, ...settings } = doc;
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const db = await getMongoDb();
  const collection: Collection<Document> = db.collection('llmsettings');
  const { user, settings } = await req.json();
  if (!user) return NextResponse.json({ error: 'User required' }, { status: 400 });
  
  // Remove any _id field from settings to prevent immutable field error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...settingsWithoutId } = settings || {};
  
  // Store the settings fields directly at the root, along with the email
  await collection.updateOne(
    { email: user }, // Use email for comparison/lookup
    { $set: { email: user, ...settingsWithoutId } }, // Exclude _id field
    { upsert: true }
  );
  
  return NextResponse.json({ success: true });
} 