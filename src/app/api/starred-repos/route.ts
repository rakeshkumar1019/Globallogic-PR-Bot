import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { connectToDatabase } from '@/lib/database/mongodb';
import UserSettings from '@/lib/database/models/UserSettings';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    await connectToDatabase();
    
    const userSettings = await UserSettings.findOne({ 
      userEmail: session.user.email 
    });

    return NextResponse.json({
      starredRepositories: userSettings?.starredRepositories || []
    });
  } catch (error) {
    console.error('Error fetching starred repositories:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { starredRepositories } = await request.json();

    if (!Array.isArray(starredRepositories)) {
      return new NextResponse('Invalid data format', { status: 400 });
    }

    await connectToDatabase();
    
    const userSettings = await UserSettings.findOneAndUpdate(
      { userEmail: session.user.email },
      { 
        $set: { 
          starredRepositories,
          userEmail: session.user.email 
        }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    );

    return NextResponse.json({
      starredRepositories: userSettings.starredRepositories
    });
  } catch (error) {
    console.error('Error saving starred repositories:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 