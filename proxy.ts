import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

export function proxy(request:NextRequest){
  const {pathname,search}=request.nextUrl;
  const requestHeaders=new Headers(request.headers);
  requestHeaders.set('x-vivreplay-path',pathname);
  requestHeaders.set('x-locale',pathname==='/id'||pathname.startsWith('/id/')?'ID':'EN');
  if(pathname!=='/id'&&!pathname.startsWith('/id/')){
    const response=NextResponse.next({request:{headers:requestHeaders}});
    response.headers.set('Permissions-Policy','camera=(self), microphone=(), geolocation=(self)');
    return response;
  }

  requestHeaders.set('x-locale','ID');
  const targetPath=pathname.replace(/^\/id(?=\/|$)/,'')||'/';
  const response=NextResponse.rewrite(new URL(`${targetPath}${search}`,request.url),{request:{headers:requestHeaders}});
  response.cookies.set('vivreplay-locale','ID',{path:'/',maxAge:60*60*24*365,sameSite:'lax'});
  response.headers.set('x-locale','ID');
  response.headers.set('Permissions-Policy','camera=(self), microphone=(), geolocation=(self)');
  return response;
}

export const config={
  matcher:['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|js|woff|woff2|ico|json|txt|xml)).*)'],
};
