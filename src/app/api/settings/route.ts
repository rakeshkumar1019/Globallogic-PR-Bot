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
  // Remove the email field from the response
  const { ...settings } = doc;
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const db = await getMongoDb();
  const collection: Collection<Document> = db.collection('llmsettings');
  const { user, settings } = await req.json();
  if (!user) return NextResponse.json({ error: 'User required' }, { status: 400 });
  // Store the settings fields directly at the root, along with the email
  await collection.updateOne(
    { email: user },
    { $set: { email: user, ...settings } },
    { upsert: true }
  );
  return NextResponse.json({ success: true });
} 