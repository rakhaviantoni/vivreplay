import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Intercept requests starting with /id (e.g. /id/cards -> /cards, /id -> /)
  if (pathname === '/id' || pathname.startsWith('/id/')) {
    const targetPath = pathname.replace(/^\/id/, '') || '/';
    const rewriteUrl = new URL(`${targetPath}${search}`, request.url);

    const response = NextResponse.rewrite(rewriteUrl);
    // Set cookie and header for locale awareness
    response.cookies.set('vivreplay-locale', 'ID', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    response.headers.set('x-locale', 'ID');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/*)
     * - Next.js internal static assets (_next/*)
     * - Static asset files (.png, .webp, .svg, .ico, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|js|woff|woff2|ico|json|txt|xml)).*)',
  ],
};
