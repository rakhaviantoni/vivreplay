import { NextResponse } from 'next/server';

/**
 * Returns which social platforms are available based on configuration
 * This allows the UI to hide unavailable connection buttons
 */
export async function GET() {
  const platforms = {
    instagram: !!(process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID),
    facebook: !!(process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID),
    twitter: !!process.env.TWITTER_CLIENT_ID,
    threads: !!(process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID),
    tiktok: false, // Not implemented yet
    linkedin: false, // Not implemented yet
    bluesky: false, // Not implemented yet
    pinterest: false, // Not implemented yet
  };

  return NextResponse.json({ platforms });
}
