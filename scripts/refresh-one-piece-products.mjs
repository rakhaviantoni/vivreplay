import {mkdir, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const clean = value => value.replace(/<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[・·]/g, ', ').replace(/\s+/g, ' ').trim();
const fetchText = async url => {
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
};
const products = [];
for (const [edition, origin] of [['global', 'https://en.onepiece-cardgame.com'], ['asia', 'https://asia-en.onepiece-cardgame.com']]) {
  let index = '';
  for (const category of ['boosters','decks']) {
    const first = await fetchText(`${origin}/products/?subcategory=${category}`);
    index += first;
    const pages = [...new Set([...first.matchAll(/subcategory=\w+&amp;page=(\d+)/g)].map(match => Number(match[1])))];
    for (const page of pages.filter(page => page > 1)) index += await fetchText(`${origin}/products/?subcategory=${category}&page=${page}`);
  }
  const urls = [...new Set([...index.matchAll(/href=["']([^"']*\/products\/(?:boosters\/|decks\/)?(?:op|eb|prb|st|sd|ld)\d+[^"'#?]*)["']/g)].map(match => new URL(match[1], origin).href))];
  async function importProduct(url, targetSlug) {
    try {
      const html = await fetchText(url);
      const slug = targetSlug??new URL(url).pathname.replace(/\/$/, '').split('/').pop().replace(/\.(php|html)$/, '');
      if (!/^(?:op|eb|prb|st|sd|ld)\d+(?:-(?:eb)?\d+)?$/.test(slug)) return;
      const kind=/^(st|sd|ld)/.test(slug)?'deck':'booster';
      const category=kind==='deck'?'decks':'boosters';
      const facts = Object.fromEntries([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(match => [clean(match[1]), clean(match[2])]));
      if(facts.Rarities){facts.Rarity=facts.Rarities;delete facts.Rarities;}
      for (const match of html.matchAll(/<h4 class="prodStatusTit">([\s\S]*?)<\/h4>\s*<div class="prodStatusContents">([\s\S]*?)<\/div>/g)) facts[clean(match[1]).replace('Rarities','Rarity')] = clean(match[2]);
      const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').split('|')[0].trim();
      const productHtml=(html.match(/<main\b[\s\S]*?<\/main>/)?.[0]??html).split(/<section[^>]*class="[^"]*(?:related|connection)/i)[0];
      const details=productHtml.match(/<div class="detailColSlider">([\s\S]*?)<div class="detailColStatus">/)?.[1]??'';
      const cmsSources=[...details.matchAll(/(?:src|data-src)=["']([^"']+)["']/g)].map(match=>new URL(match[1],url).href);
      const sources = [...(details+productHtml).matchAll(/(?:src|data-src)=["']([^"']+)["']/g)].map(match => new URL(match[1], url)).filter(asset => asset.origin === origin && (asset.pathname.includes(`/${category}/${slug}/`)||(!targetSlug&&cmsSources.includes(asset.href))));
      const images = {};
      for (const [key, pattern] of [['pack', /\/(?:img_item01|product_pack)\.(webp|png|jpg)$/], ['box', /\/(?:img_item02|product_booster)\.(webp|png|jpg)$/], ['hero', /\/(?:mv|mv_01)\.(webp|png|jpg)$/]]) {
        const candidates=sources.filter(source => pattern.test(source.pathname));
        if(key!=='hero') candidates.push(new URL(`/renewal/images/products/${category}/${slug}/img_item0${key==='pack'?1:2}.webp`,origin));
        for(const asset of candidates) {
          const filename = `${key}${path.extname(asset.pathname)}`;
          const directory = path.join(root, 'public/products/one-piece', edition, slug);
          const target=path.join(directory,filename);
          if(await access(target).then(()=>true,()=>false)) {images[key]=`/products/one-piece/${edition}/${slug}/${filename}`;break;}
          const response = await fetch(asset, {signal: AbortSignal.timeout(15000)});
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
          await mkdir(directory, {recursive: true});
          await writeFile(target, Buffer.from(await response.arrayBuffer()));
          images[key] = `/products/one-piece/${edition}/${slug}/${filename}`;
          break;
        }
      }
      products.push({code: slug.toUpperCase(), edition, kind, title, sourceUrl: url, facts, images});
      console.log(`${edition} ${slug}: ${Object.keys(images).join(', ')}`);
    } catch (error) { console.error(String(error)); process.exitCode = 1; }
  }
  const jobs=urls.flatMap(url=>{
    const range=url.match(/\/st(\d+)-(\d+)\.(?:php|html)$/);
    return range?Array.from({length:Number(range[2])-Number(range[1])+1},(_,index)=>[url,`st${String(Number(range[1])+index).padStart(2,'0')}`]):[[url]];
  });
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length)await importProduct(...jobs[cursor++]);}));
}
if (!process.exitCode && products.length) {
  await mkdir(path.join(root, 'packages/card-data'), {recursive: true});
  products.sort((a,b)=>a.edition.localeCompare(b.edition)||a.code.localeCompare(b.code,undefined,{numeric:true}));
  await writeFile(path.join(root, 'packages/card-data/one-piece-products.json'), `${JSON.stringify(products, null, 2)}\n`);
} else throw new Error('Refresh incomplete; existing product manifest retained');
