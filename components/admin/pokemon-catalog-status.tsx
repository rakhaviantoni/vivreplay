'use client';

import {useCallback,useEffect,useMemo,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {ArrowLeftIcon,ArrowRightIcon,ImageIcon,DatabaseIcon,ShapesIcon,WarningCircleIcon,CheckCircleIcon,ArrowClockwiseIcon,MagnifyingGlassIcon,XIcon,ArrowSquareOutIcon} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {CardArt} from '@/components/tcg/card-art';
import {MultiFilter as SharedMultiFilter} from '@/components/tcg/catalog';
import {PokemonCardText,PokemonCardVitals,PokemonMechanicText} from '@/components/tcg/pokemon-card-text';

type Row={id:string;code:string;name:string;language:string;setCode:string;setName:string;printingCode:string|null;collectorNumber:string|null;variant:string;rarity:string;source:string;imageSource:string|null;status:'stored'|'source'|'missing';imageUrl:string|null;assetKey:string|null;cardType:string;effectText:string|null;cost:number;power:number};
type Detail=Record<string,unknown>&{sourcePayload?:Record<string,unknown>;imageUrl?:string|null};
type Payload={summary?:{printings:number;identities:number;sets:number;stored:number;sourceOnly:number;missing:number;idPrintings:number;idMissing:number};languages?:Array<{language:string;count:number}>;sets?:Array<{code:string;name:string}>;sources?:Array<{source:string;count:number}>;page:number;hasNext:boolean;printings:Row[]};
const format=new Intl.NumberFormat('en-US');

export function PokemonCatalogStatus(){
  const [data,setData]=useState<Payload|null>(null);
  const [query,setQuery]=useState('');
  const [searchText,setSearchText]=useState('');
  const [sets,setSets]=useState<string[]>([]);
  const [languages,setLanguages]=useState<string[]>([]);
  const [sources,setSources]=useState<string[]>([]);
  const [status,setStatus]=useState('all');
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null);
  const metadataLoaded=useRef(false);

  const load=useCallback(async(forceMetadata=false)=>{
    setLoading(true);setError('');
    try{
      const params=new URLSearchParams({page:String(page)});
      if(forceMetadata||!metadataLoaded.current)params.set('metadata','1');
      if(query.trim())params.set('q',query.trim());
      sets.forEach(value=>params.append('set',value));
      languages.forEach(value=>params.append('language',value));
      sources.forEach(value=>params.append('source',value));
      if(status!=='all')params.set('status',status);
      const response=await fetch(`/api/admin/catalog/pokemon?${params}`,{cache:'no-store'});
      const payload=await response.json() as Payload&{error?:string};
      if(!response.ok)throw new Error(payload.error??'Pokémon printings could not be loaded.');
      if(payload.summary)metadataLoaded.current=true;
      setData(previous=>({...previous,...payload,summary:payload.summary??previous?.summary,languages:payload.languages??previous?.languages,sets:payload.sets??previous?.sets,sources:payload.sources??previous?.sources}));
    }catch(reason){setError(reason instanceof Error?reason.message:'Pokémon printings could not be loaded.');}
    finally{setLoading(false);}
  },[page,query,sets,languages,sources,status]);

  useEffect(()=>{const timer=window.setTimeout(()=>{setQuery(searchText);setPage(1)},250);return()=>window.clearTimeout(timer)},[searchText]);
  useEffect(()=>{void load()},[load]);

  const statuses=useMemo(()=>[
    {id:'missing',label:'No saved image or URL',count:data?.summary?.missing??0},
    {id:'source',label:'Image links',count:data?.summary?.sourceOnly??0},
    {id:'stored',label:'Saved images',count:data?.summary?.stored??0},
    {id:'all',label:'All printings',count:data?.summary?.printings??0},
  ],[data]);

  const setOptions=(data?.sets??[]).map(item=>({value:item.code,label:`${item.name} (${item.code})`}));
  const languageOptions=(data?.languages??[]).map(item=>({value:item.language,label:item.language}));
  const sourceOptions=(data?.sources??[]).map(item=>({value:item.source,label:sourceLabel(item.source)}));
  const activeFilters=searchText.trim().length>0||sets.length>0||languages.length>0||sources.length>0;
  const clearFilters=()=>{setSearchText('');setQuery('');setSets([]);setLanguages([]);setSources([]);setStatus('all');setPage(1)};

  const selectRow=(row:Row)=>{
    setSelected(row);setDetail(null);
    void fetch(`/api/cards/printing/${encodeURIComponent(row.id)}`).then(async response=>{if(!response.ok)throw new Error('Card details unavailable');setDetail(await response.json() as Detail)}).catch(()=>setDetail({sourcePayload:{description:row.effectText??''},imageUrl:row.imageUrl}));
  };
  const summary=data?.summary;

  return <section className="pokemon-catalog-admin">
    <header className="pokemon-catalog-toolbar">
      <div><span className="eyebrow">POKÉMON TCG</span><h2>Card printings</h2><p>Check saved artwork and source links. Cards without either may still load from their set and card number.</p></div>
      <button type="button" className="admin-refresh" onClick={()=>void load(true)} disabled={loading}><ArrowClockwiseIcon size={15} className={loading?'spin':''}/>Refresh</button>
    </header>
    {summary&&<div className="pokemon-catalog-metrics">
      <Metric icon={<DatabaseIcon size={17}/>} label="Printings" value={summary.printings}/>
      <Metric icon={<ShapesIcon size={17}/>} label="Cards" value={summary.identities}/>
      <Metric icon={<CheckCircleIcon size={17}/>} label="Saved images" value={summary.stored}/>
      <Metric icon={<ImageIcon size={17}/>} label="Image links" value={summary.sourceOnly}/>
      <Metric icon={<WarningCircleIcon size={17}/>} label="No saved image or URL" value={summary.missing}/>
    </div>}
    {data&&<div className="pokemon-catalog-filters">
      <label className="pokemon-catalog-search"><MagnifyingGlassIcon size={16}/><input value={searchText} onChange={event=>setSearchText(event.target.value)} placeholder="Search card, number, or set"/></label>
      <SharedMultiFilter portal portalClassName="pokemon-admin-filter-popover" label="Set" values={setOptions} selected={sets} onToggle={value=>{setSets(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);setPage(1)}} searchPlaceholder="Find a set"/>
      <SharedMultiFilter portal portalClassName="pokemon-admin-filter-popover" label="Language" values={languageOptions} selected={languages} onToggle={value=>{setLanguages(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);setPage(1)}} searchPlaceholder="Find a language"/>
      <SharedMultiFilter portal portalClassName="pokemon-admin-filter-popover" label="Source" values={sourceOptions} selected={sources} onToggle={value=>{setSources(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);setPage(1)}} searchPlaceholder="Find a source"/>
    </div>}
    {data&&<div className="pokemon-catalog-filter-summary"><span>{activeFilters?`${sets.length+languages.length+sources.length+(searchText.trim()?1:0)} filters applied`:''}</span>{activeFilters&&<button type="button" onClick={clearFilters}>Clear filters <XIcon size={13}/></button>}</div>}
    {data&&<div className="pokemon-catalog-status-tabs" role="tablist" aria-label="Image status">{statuses.map(item=><button key={item.id} type="button" role="tab" aria-selected={status===item.id} className={status===item.id?'active':''} onClick={()=>{setStatus(item.id);setPage(1)}}>{item.label}<b>{format.format(item.count)}</b></button>)}</div>}
    {error&&<p className="admin-error">{error}</p>}
    <div className="pokemon-catalog-table-wrap" aria-busy={loading}>
      <table className="admin-health-table pokemon-catalog-table"><thead><tr><th>Card</th><th>Set and printing</th><th>Language</th><th>Data source</th><th>Image</th><th aria-label="Open details"/></tr></thead><tbody>
        {loading&&!data?<tr><td colSpan={6}>Loading Pokémon cards…</td></tr>:data?.printings.map(row=><tr key={row.id} className="pokemon-catalog-row" tabIndex={0} role="button" aria-label={`Open ${row.name} card details`} onClick={()=>selectRow(row)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRow(row)}}}>
          <td><strong>{row.name}</strong><small>{[row.collectorNumber,row.rarity,row.source==='cardtell'?null:row.code].filter(Boolean).join(' / ')}</small></td>
          <td>{row.setName}<small>{[row.setCode,row.collectorNumber??row.printingCode,row.variant].filter(Boolean).join(' / ')}</small></td>
          <td>{row.language}</td><td>{sourceLabel(row.source)}</td>
          <td><span className={`pokemon-image-status is-${row.status}`}>{row.status==='stored'?'Saved':row.status==='source'?'Image link':'No direct image'}</span></td>
          <td><ArrowSquareOutIcon size={15}/></td>
        </tr>)}
        {!loading&&data&&!data.printings.length&&<tr><td colSpan={6}>No printings match these filters.</td></tr>}
      </tbody></table>
    </div>
    {data&&<footer className="pokemon-catalog-pagination"><span>Page {data.page}{loading?' / Updating':''}</span><div><button type="button" onClick={()=>setPage(value=>Math.max(1,value-1))} disabled={page<=1||loading} aria-label="Previous page"><ArrowLeftIcon size={16}/></button><button type="button" onClick={()=>setPage(value=>value+1)} disabled={!data.hasNext||loading} aria-label="Next page"><ArrowRightIcon size={16}/></button></div></footer>}
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open){setSelected(null);setDetail(null)}}}><DialogContent className="pokemon-card-dialog pokemon-admin-card-dialog">{selected&&<div className="pokemon-card-dialog-layout">
      <div className="pokemon-card-dialog-art-column"><div className="pokemon-dialog-art-wrap"><CardArt priority card={{id:selected.id,code:selected.code,name:selected.name,color:'Colorless',type:'Character',cost:selected.cost,power:selected.power,rarity:selected.rarity,art:0,imageUrl:selected.imageUrl??undefined,imageSource:'generated',setCode:selected.setCode,language:selected.language,printingCode:selected.printingCode??undefined,localCardNumber:selected.collectorNumber??undefined,effect:selected.effectText??'',variant:selected.variant,gameSlug:'pokemon'}}/></div></div>
      <div className="pokemon-card-dialog-details"><DialogHeader><div className="pokemon-dialog-title-row"><DialogTitle><PokemonMechanicText text={selected.name}/></DialogTitle><PokemonCardVitals source={detail?.sourcePayload as ComponentProps<typeof PokemonCardVitals>['source']} language={selected.language}/></div>
        <DialogDescription asChild><div className="pokemon-dialog-meta"><span className="pokemon-card-meta-row"><small className="pokemon-card-set-name">{selected.setName}</small><small className="pokemon-card-set-badge">{selected.setCode}</small><span className="pokemon-card-meta-divider" aria-hidden="true"/><small className="pokemon-card-number">{selected.collectorNumber??selected.printingCode??selected.code}</small>{selected.rarity&&<small className="pokemon-card-rarity">{selected.rarity}</small>}</span></div></DialogDescription>
      </DialogHeader>
        {detail?<PokemonCardText code={selected.code} name={selected.name} language={selected.language} source={cardTextSource(detail.sourcePayload,selected) as ComponentProps<typeof PokemonCardText>['source']}/>:<div className="pokemon-card-text pokemon-card-text-missing" role="status">Loading card details…</div>}
        <section className="pokemon-catalog-detail-audit"><h3>Catalog details</h3><dl>
          <div><dt>Collector number</dt><dd>{selected.collectorNumber??'Not set'}</dd></div><div><dt>Language</dt><dd>{selected.language}</dd></div>
          <div><dt>Type and rarity</dt><dd>{selected.cardType}{selected.rarity?` / ${selected.rarity}`:''}</dd></div><div><dt>Data source</dt><dd>{sourceLabel(selected.source)}</dd></div>
          <div><dt>Image source</dt><dd>{selected.imageSource??(selected.status==='missing'?'Card route fallback':'Not available')}</dd></div><div><dt>Image record</dt><dd><span className={`pokemon-image-status is-${selected.status}`}>{selected.status==='stored'?'Saved in VivrePlay':selected.status==='source'?'Source URL available':'No saved image or source URL'}</span></dd></div>
        </dl></section>
      </div>
    </div>}</DialogContent></Dialog>
  </section>;
}

function cardTextSource(source:Record<string,unknown>|undefined,printing:Row){
  if(!source)return undefined;
  const description=typeof source.description==='string'?source.description:'';
  const normalized=(value:string)=>value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  const descriptionKey=normalized(description);
  const setAndNumber=normalized(`${printing.setName}${printing.collectorNumber??printing.printingCode??''}`);
  const number=normalized(printing.collectorNumber??printing.printingCode??'');
  const isPrintingLabel=Boolean(descriptionKey&&((setAndNumber&&descriptionKey===setAndNumber)||(number&&descriptionKey===number)));
  return isPrintingLabel?{...source,description:''}:source;
}

function sourceLabel(value:string){
  const normalized=value.trim().toLowerCase();
  if(!normalized||normalized==='unknown')return 'Unknown';
  if(normalized==='tcgdex')return 'TCGdex';
  if(normalized==='cardtell')return 'Cardtell';
  if(normalized==='pokepedia')return 'Poképedia';
  return value.replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:number}){return <div>{icon}<span>{label}</span><strong>{format.format(value)}</strong></div>}
