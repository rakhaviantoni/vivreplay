import {headers} from 'next/headers';

export async function isIndonesianRequest(){
  const requestHeaders=await headers();
  return requestHeaders.get('x-locale')==='ID'||requestHeaders.get('x-middleware-rewrite')?.startsWith('/id')===true;
}
