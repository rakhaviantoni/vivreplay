import { NextResponse } from 'next/server';

/**
 * Returns which social platforms are available based on configuration
 * This allows the UI to hide unavailable connection buttons
 */
export async function GET() {
  const platforms = {
    instagram: !!(process.env.INSTAGRAM_LOGIN_APP_ID || process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID),
    facebook: !!(process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID),
    threads: !!(process.env.THREADS_APP_ID || process.env.INSTAGRAM_APP_ID),
  };

  return NextResponse.json({ platforms });
}
