import {serveCardImage} from '../route';

const variants=new Set(['thumb','small','large']);
const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;

export async function GET(_request:Request,{params}:{params:Promise<{setCode:string;language:string;filename:string;legacyFilename:string}>}) {
  const {setCode,language,filename:variant,legacyFilename}=await params;
  if(!variants.has(variant)||!filenamePattern.test(legacyFilename)) return new Response('Not found',{status:404});
  // Legacy size segments are aliases. Artwork is stored once at its canonical size.
  return serveCardImage(setCode,language,legacyFilename,'small');
}
