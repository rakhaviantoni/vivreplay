export async function GET(request:Request){
  const source=new URL(request.url).searchParams.get('url');
  if(!source)return Response.json({error:'Missing card image URL.'},{status:400});
  let remote:URL;
  try{remote=new URL(source);}catch{return Response.json({error:'Invalid card image URL.'},{status:400});}
  if(remote.protocol!=='https:'||remote.hostname!=='cards.oplaytcg.com')return Response.json({error:'Unsupported card image source.'},{status:400});
  const [,set,language,...parts]=remote.pathname.split('/');
  const filename=parts.at(-1);
  if(!set||!language||!filename||set.toLowerCase()==='tcg'||filename.toLowerCase().startsWith('tcg-'))return new Response('Card image is unavailable in VivrePlay storage.',{status:404});
  const internalPath=`/${encodeURIComponent(set)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(filename)}`;
  return Response.redirect(new URL(internalPath,request.url),307);
}
