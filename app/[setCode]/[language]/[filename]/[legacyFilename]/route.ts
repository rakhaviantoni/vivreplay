import {serveCardImage} from '../route';

const variants=new Set(['thumb','small','large']);
const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;

export async function GET(request:Request,{params}:{params:Promise<{setCode:string;language:string;filename:string;legacyFilename:string}>}) {
  const {setCode,language,filename:variant,legacyFilename}=await params;
  if(!variants.has(variant)||!filenamePattern.test(legacyFilename)) return new Response('Not found',{status:404});
  // Legacy size segments are aliases. Artwork is stored once at its canonical size.
  const rawWidth=Number(new URL(request.url).searchParams.get('width'));
  const requestedWidth=[160,220,280,360].includes(rawWidth)?rawWidth:undefined;
  return serveCardImage(setCode,language,legacyFilename,'small',requestedWidth);
}
