import {access, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
const clean=value=>value.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/[・·]/g,' ').replace(/\s+/g,' ').trim();
async function fetchResource(url){
  for(let attempt=0;attempt<3;attempt++){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${response.status}: ${url}`);return response;}
    catch(error){if(attempt===2)throw error;}
  }
}
async function parallel(items,run){let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<items.length)await run(items[cursor++]);}));}
function productKind(slug,title){
  const text=`${slug} ${title}`.toLowerCase();
  if(/sleeve/.test(text))return 'SLEEVE';
  if(/playmat/.test(text))return 'PLAYMAT';
  if(/binder|9.?po[ck]+et/.test(text))return 'BINDER';
  if(/storage|cardcase/.test(text))return 'STORAGE';
  if(/mini.?tin|^ts\d/.test(text))return 'MINI_TIN';
  if(/super premium|^spc\d|heroines|devil.fruits|treasure chest|championship.?set|special goods|goods_set/.test(text))return 'PREMIUM_COLLECTION';
  if(/collection|anniversary|premium.*card|illustration box|special don/.test(text))return 'CARD_COLLECTION';
  if(/double.pack|^dp\d/.test(text))return 'DOUBLE_PACK';
  return 'OTHER';
}
const products=[];
const failures=[];
for(const [edition,origin] of [['asia','https://asia-en.onepiece-cardgame.com'],['global','https://en.onepiece-cardgame.com']]){
  const first=await (await fetchResource(`${origin}/products/?subcategory=others`)).text();
  const pageCount=Math.max(1,...[...first.matchAll(/subcategory=others&amp;page=(\d+)/g)].map(match=>Number(match[1])));
  const pages=[first];
  await parallel(Array.from({length:pageCount-1},(_,i)=>i+2),async page=>{pages.push(await (await fetchResource(`${origin}/products/?subcategory=others&page=${page}`)).text());});
  const urls=[...new Set(pages.flatMap(html=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*linkListColItem[^"']*["']/g)].map(match=>new URL(match[1],origin).href)))];
  if(edition==='asia')for(const slug of ['other/sleeve037.php','sleeve047.html','sleeve045.html','ts04.html','spc01.html','storage008.html','card_collection_007.html','other/official-9poket-binder001.php','playmat007.html','playmat_flame-flame-fruit.html']){const url=`${origin}/products/${slug}`;if(!urls.includes(url))urls.push(url);}
  console.log(`${edition}: ${urls.length} official product pages`);
  await parallel(urls,async url=>{
    try{
      const html=await (await fetchResource(url)).text();
      const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]??html;
      const slug=new URL(url).pathname.split('/').pop().replace(/\.(?:php|html)$/,'');
      const slider=html.match(/<div class="detailColSlider">([\s\S]*?)<div class="detailColStatus">/)?.[1]??html.match(/<ul class="productsMainSlider">([\s\S]*?)<\/ul>/)?.[1];
      if(!slider)throw new Error(`Product images not found: ${url}`);
      const name=clean(main.match(/<h3 class="pageTit">([\s\S]*?)<\/h3>/)?.[1]?.replace(/<span[^>]*>[\s\S]*?<\/span>/g,'')??main.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]??'');
      if(!name)throw new Error(`Product name not found: ${url}`);
      const rawFacts=Object.fromEntries([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(match=>[clean(match[1]),match[2]]));
      for(const match of html.matchAll(/<h4 class="prodStatusTit">([\s\S]*?)<\/h4>\s*<div class="prodStatusContents">([\s\S]*?)<\/div>/g))rawFacts[clean(match[1])]=match[2];
      const facts=Object.fromEntries(Object.entries(rawFacts).map(([key,value])=>[key,clean(value)]));
      const types=[...(rawFacts['Number of Types']??rawFacts['Products Name']??'').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(match=>clean(match[1]).replace(name,'').trim()).filter(Boolean);
      const sources=[...new Set([...slider.matchAll(/<img\b[^>]*>/g)].map(([tag])=>tag.match(/data-src=["']([^"']+)/)?.[1]??tag.match(/\ssrc=["']([^"']+)/)?.[1]).filter(Boolean).map(source=>new URL(source,url).href).filter(source=>!source.includes('/common/')))];
      if(!sources.length)throw new Error(`Product artwork not found: ${url}`);
      const hasDesigns=types.length>1;
      const separateImages=sources.length===types.length||sources.length===types.length+1;
      const entries=hasDesigns?types.map((design,index)=>({design,source:separateImages?sources[sources.length-types.length+index]:sources[0]})):[{design:'',source:sources[0]}];
      const directory=path.join(root,'public/products/one-piece',edition,slug);
      await mkdir(directory,{recursive:true});
      for(const [index,entry] of entries.entries()){
        const filename=`accessory-${index+1}.webp`;
        const target=path.join(directory,filename);
        if(!await access(target).then(()=>true,()=>false)){
          const response=await fetchResource(entry.source);
          if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error(`Not an image: ${entry.source}`);
          await writeFile(target,await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer());
        }
        const date=Date.parse(facts['Release Date']??'');
        products.push({id:`sealed:${edition}:${slug.toUpperCase()}:${productKind(slug,name)}${hasDesigns?`:${index+1}`:''}`,name,design:entry.design,kind:productKind(slug,name),code:slug.toUpperCase(),edition,language:'',imageUrl:`/products/one-piece/${edition}/${slug}/${filename}`,sourceUrl:url,...(Number.isFinite(date)?{releaseDate:new Date(date).toISOString().slice(0,10)}:{}),contents:facts.Contents??''});
      }
      console.log(`${edition} ${slug}: ${entries.length} product${entries.length===1?'':'s'}`);
    }catch(error){failures.push(String(error));console.error(String(error));}
  });
}
if(failures.length)throw new Error(`Import incomplete (${failures.length} failed pages); existing manifest retained`);
if(!products.length)throw new Error('No products found; existing manifest retained');
const unique=[...new Map(products.map(product=>[product.id,product])).values()];
unique.sort((a,b)=>a.id.localeCompare(b.id));
await writeFile(path.join(root,'packages/card-data/one-piece-accessories.json'),`${JSON.stringify(unique,null,2)}\n`);
console.log(`Saved ${unique.length} products with local artwork`);
