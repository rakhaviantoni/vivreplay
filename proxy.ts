import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

export function proxy(request:NextRequest){
  const {pathname,search}=request.nextUrl;
  if(pathname!=='/id'&&!pathname.startsWith('/id/'))return NextResponse.next();

  const targetPath=pathname.replace(/^\/id(?=\/|$)/,'')||'/';
  const rewritten=NextResponse.rewrite(new URL(`${targetPath}${search}`,request.url));
  const response=new NextResponse(rewritten.body,{status:rewritten.status,statusText:rewritten.statusText,headers:new Headers(rewritten.headers)});
  response.cookies.set('vivreplay-locale','ID',{path:'/',maxAge:60*60*24*365,sameSite:'lax'});
  response.headers.set('x-locale','ID');
  return response;
}

export const config={
  matcher:['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|js|woff|woff2|ico|json|txt|xml)).*)'],
};
