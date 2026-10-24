'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {CameraIcon,CaretLeftIcon,CaretRightIcon,ImageSquareIcon,SpinnerGapIcon} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {TurnstileField,turnstileEnabled,turnstileHeaders} from './turnstile-field';
import {detectCardBounds} from '@/lib/card-scan-detection';
import {CardArt} from '@/components/tcg/card-art';
import type {Card} from '@/packages/card-data/catalog';
import {pokemonRarityLabel} from '@/lib/pokemon-rarity';
import {detectCardScanGame,detectPokemonScanLanguage,parseOnePieceScanCode,parsePokemonScanCode} from '@/lib/card-scan-parser';

export type CardScanCandidate={id:string;game:'pokemon'|'one-piece';code:string;name:string;setCode:string;cardNumber:string;language:string;rarity:string;variant:string;imageUrl:string|null;setCardCount?:string};
type CardScanRead={game:'pokemon'|'one-piece';name:string;setCode:string;cardNumber:string;cardNumberTotal:string;language:string;rarity:string;variant:string;block:string};
type LiveCardScanRead=Partial<CardScanRead>;
type Props={game:'pokemon'|'one-piece'|'auto';locale?:'EN'|'ID';onSelect?:(card:CardScanCandidate)=>void|Promise<void>;selectionPurpose?:'choose'|'filter';className?:string};
type NormalizedBounds={x:number;y:number;width:number;height:number};
type PaddleEngine=Awaited<ReturnType<typeof import('@paddleocr/paddleocr-js').PaddleOCR.create>>;
let paddleEnginePromise:Promise<PaddleEngine>|undefined;

async function getPaddleEngine():Promise<PaddleEngine>{
  if(!paddleEnginePromise){
    paddleEnginePromise=(async()=>{
      const {PaddleOCR}=await import('@paddleocr/paddleocr-js');
      return PaddleOCR.create({
        // PaddleOCR's generated 11 MB worker bundle currently overflows
        // Vite's import.meta.url asset transform. Keep inference inline until
        // the worker can be served as a static asset instead.
        lang:'en',ocrVersion:'PP-OCRv5',worker:false,
        ortOptions:{backend:'wasm',wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',simd:true},
      });
    })();
  }
  try{return await paddleEnginePromise}catch(error){paddleEnginePromise=undefined;throw error}
}

function dataUrl(bitmap:ImageBitmap,box:{x:number;y:number;width:number;height:number},maxWidth:number,maxScale=1,enhance=false){
  const scale=Math.min(maxScale,maxWidth/box.width);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(box.width*scale));
  canvas.height=Math.max(1,Math.round(box.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:enhance});
  if(!context)return '';
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(bitmap,box.x,box.y,box.width,box.height,0,0,canvas.width,canvas.height);
  if(enhance){
    const image=context.getImageData(0,0,canvas.width,canvas.height);
    for(let index=0;index<image.data.length;index+=4){
      const gray=image.data[index]*.299+image.data[index+1]*.587+image.data[index+2]*.114;
      const contrast=Math.max(0,Math.min(255,(gray-128)*1.45+128));
      image.data[index]=contrast;image.data[index+1]=contrast;image.data[index+2]=contrast;
    }
    context.putImageData(image,0,0);
  }
  return canvas.toDataURL('image/jpeg',1);
}

function videoCropBlob(video:HTMLVideoElement,bounds:NormalizedBounds,maxWidth:number):Promise<Blob|null>{
  const x=bounds.x*video.videoWidth,y=bounds.y*video.videoHeight,width=bounds.width*video.videoWidth,height=bounds.height*video.videoHeight;
  const scale=Math.min(1,maxWidth/width);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');
  if(!context)return Promise.resolve(null);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(video,x,y,width,height,0,0,canvas.width,canvas.height);
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
}

function liveCardName(items:Array<{text:string;score:number;poly:Array<[number,number]>}>,imageHeight:number){
  const ignored=/^(?:BASIC|STAGE\s*\d|CHARACTER|LEADER|DON!!|TRAINER|SUPPORTER|ITEM|STADIUM|ENERGY|POK[EÉ]MON|HP\s*\d*|WEAKNESS|RESISTANCE|RETREAT|ILLUS\.?|NO\.?\s*\d+|[A-Z0-9]{1,3})$/i;
  return items.map(item=>{
    const text=item.text.replace(/\s+/g,' ').trim();
    const centerY=item.poly.reduce((sum,point)=>sum+point[1],0)/Math.max(1,item.poly.length);
    const height=item.poly.length?Math.max(...item.poly.map(point=>point[1]))-Math.min(...item.poly.map(point=>point[1])):0;
    return{text,centerY,height,score:item.score};
  }).filter(item=>item.score>=.35&&item.centerY/imageHeight>.08&&item.centerY/imageHeight<.4&&item.text.length>=3&&item.text.length<=44&&!ignored.test(item.text)&&/[A-Z\p{L}]/iu.test(item.text)&&!/^\d/.test(item.text))
    .sort((left,right)=>right.height-left.height||left.centerY-right.centerY)[0]?.text;
}

function parseLiveCardRead(text:string,requestedGame:Props['game'],name?:string):LiveCardScanRead{
  const game:CardScanRead['game']|null=detectCardScanGame(text,requestedGame);
  if(game==='one-piece'){
    const parsed=parseOnePieceScanCode(text);
    return parsed?{game,name,setCode:parsed.setCode,cardNumber:parsed.cardNumber,language:detectPokemonScanLanguage(text),rarity:parsed.rarity,variant:parsed.variant}:name?{name}:{};
  }
  if(game==='pokemon'){
    const parsed=parsePokemonScanCode(text);
    return parsed?{game,name,setCode:parsed.setCodeCandidates[0],cardNumber:parsed.cardNumber,cardNumberTotal:parsed.cardNumberTotal,language:parsed.language,rarity:parsed.rarity}:name?{name}:{};
  }
  return name?{name}:{};
}

async function scanImages(file:File,game:Props['game'],cropOverride?:NormalizedBounds){
  const bitmap=await createImageBitmap(file);
  try{
    const full=dataUrl(bitmap,{x:0,y:0,width:bitmap.width,height:bitmap.height},1500);
    const detectionScale=Math.min(1,240/bitmap.width,240/bitmap.height);
    const detectionCanvas=document.createElement('canvas');
    detectionCanvas.width=Math.max(1,Math.round(bitmap.width*detectionScale));
    detectionCanvas.height=Math.max(1,Math.round(bitmap.height*detectionScale));
    const detectionContext=detectionCanvas.getContext('2d',{willReadFrequently:true});
    detectionContext?.drawImage(bitmap,0,0,detectionCanvas.width,detectionCanvas.height);
    const detected=detectionContext?detectCardBounds(detectionContext.getImageData(0,0,detectionCanvas.width,detectionCanvas.height)):null;
    const bounds=cropOverride?{
      x:cropOverride.x*bitmap.width,y:cropOverride.y*bitmap.height,
      width:cropOverride.width*bitmap.width,height:cropOverride.height*bitmap.height,
    }:detected?{
      x:detected.x/detectionCanvas.width*bitmap.width,
      y:detected.y/detectionCanvas.height*bitmap.height,
      width:detected.width/detectionCanvas.width*bitmap.width,
      height:detected.height/detectionCanvas.height*bitmap.height,
    }:{x:0,y:0,width:bitmap.width,height:bitmap.height};
    const relative=(x:number,y:number,width:number,height:number)=>({
      x:bounds.x+bounds.width*x,y:bounds.y+bounds.height*y,
      width:bounds.width*width,height:bounds.height*height,
    });
    const footer=(top:number)=>relative(0,top,1,1-top);
    const pokemonCorner=relative(0,.7,.58,.3);
    const onePieceCorner=relative(.42,.7,.58,.3);
    // The card-relative crops keep the scanner on its lower corners even if
    // the card is small or offset in the photo. The full image stays as backup.
    const crops=game==='pokemon'?[pokemonCorner,footer(.7),footer(.84)]:game==='one-piece'?[onePieceCorner,footer(.7),footer(.84)]:[pokemonCorner,onePieceCorner,footer(.7),footer(.84)];
    const focused=crops.map((crop,index)=>dataUrl(bitmap,crop,2400,4,index>0));
    return {images:[full,...focused],width:bitmap.width,height:bitmap.height,bounds:{x:bounds.x/bitmap.width,y:bounds.y/bitmap.height,width:bounds.width/bitmap.width,height:bounds.height/bitmap.height}};
  }finally{bitmap.close();}
}

function cardHref(card:CardScanCandidate,locale:'EN'|'ID'){
  const path=card.game==='pokemon'?'/pokemon':'/cards';
  const params=new URLSearchParams({lang:card.language});
  if(card.game==='pokemon'){
    params.set('printing',card.id);
    params.set('set',card.setCode);
    params.set('number',card.cardNumber.split('/')[0]??card.cardNumber);
  }else params.set('card',card.code);
  return `${locale==='ID'?'/id':''}${path}?${params}`;
}

function scanVariantLabel(value:string){return value.split(/\s*[|·]\s*/)[0]?.trim()||value.trim()}

function scanDisplayCard(candidate:CardScanCandidate):Card&{gameSlug:'pokemon'|'one-piece'}{
  return {
    id:candidate.id,code:candidate.code,name:candidate.name,color:'',type:'Character',cost:0,power:0,
    rarity:candidate.rarity,art:0,effect:'',imageUrl:candidate.imageUrl??undefined,gameSlug:candidate.game,
    setCode:candidate.setCode,language:candidate.language,printingCode:candidate.cardNumber,
    localCardNumber:candidate.cardNumber.split('/')[0],variant:candidate.variant,
  };
}

export function CardScanButton({game,locale='EN',onSelect,className}:Props){
  const [open,setOpen]=useState(false);
  const [preview,setPreview]=useState<string>();
  const [previewSize,setPreviewSize]=useState<{width:number;height:number}>();
  const [previewZoom,setPreviewZoom]=useState(1);
  const [previewPan,setPreviewPan]=useState({x:0,y:0});
  const [cameraActive,setCameraActive]=useState(false);
  const [cameraReady,setCameraReady]=useState(false);
  const [cameraStatus,setCameraStatus]=useState<'searching'|'steady'|'capturing'>('searching');
  const [liveRead,setLiveRead]=useState<LiveCardScanRead>({});
  const [liveOcrStatus,setLiveOcrStatus]=useState<'waiting'|'loading'|'reading'|'ready'>('waiting');
  const [useCameraPicker,setUseCameraPicker]=useState(false);
  const [scanBounds,setScanBounds]=useState<NormalizedBounds>();
  const [detectedBounds,setDetectedBounds]=useState<NormalizedBounds>();
  const [sourceFile,setSourceFile]=useState<File>();
  const [images,setImages]=useState<string[]>([]);
  const [read,setRead]=useState<CardScanRead>();
  const [candidates,setCandidates]=useState<CardScanCandidate[]>([]);
  const [busy,setBusy]=useState(false);
  const [ocrStage,setOcrStage]=useState<'loading'|'reading'>('loading');
  const [error,setError]=useState('');
  const [token,setToken]=useState('');
  const [turnstileRevision,setTurnstileRevision]=useState(0);
  const [resultScroll,setResultScroll]=useState({left:false,right:false});
  const cameraInput=useRef<HTMLInputElement>(null);
  const uploadInput=useRef<HTMLInputElement>(null);
  const photoRef=useRef<HTMLDivElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const cameraStageRef=useRef<HTMLDivElement>(null);
  const cameraGuideRef=useRef<HTMLDivElement>(null);
  const cameraStream=useRef<MediaStream|null>(null);
  const capturePhotoRef=useRef<((autoScan?:boolean,bounds?:NormalizedBounds)=>Promise<void>)|undefined>(undefined);
  const identifyRef=useRef<(()=>Promise<void>)|undefined>(undefined);
  const autoCaptureStarted=useRef(false);
  const captureInProgress=useRef(false);
  const autoScanRequested=useRef(false);
  const cameraSteady=useRef(false);
  const cameraSteadySince=useRef<number|null>(null);
  const liveOcrInProgress=useRef(false);
  const liveIdentity=useRef<{key:string;count:number}>({key:'',count:0});
  const liveReadRef=useRef<LiveCardScanRead>({});
  const cropDrag=useRef<{pointerId:number;corner:'top-left'|'top-right'|'bottom-left'|'bottom-right'|'move'|null;startX:number;startY:number;startBounds?:NormalizedBounds}>({pointerId:-1,corner:null,startX:0,startY:0});
  const resultTrack=useRef<HTMLDivElement>(null);
  const panDrag=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
  const id=locale==='ID';
  const stopCamera=()=>{cameraStream.current?.getTracks().forEach(track=>track.stop());cameraStream.current=null;setCameraActive(false);setCameraReady(false)};
  const getCameraGuideBounds=():NormalizedBounds|undefined=>{
    const video=videoRef.current,stage=cameraStageRef.current,guide=cameraGuideRef.current;
    if(!video||!stage||!guide||!video.videoWidth||!video.videoHeight)return;
    const videoRect=video.getBoundingClientRect(),stageRect=stage.getBoundingClientRect(),guideRect=guide.getBoundingClientRect();
    const scale=Math.min(videoRect.width/video.videoWidth,videoRect.height/video.videoHeight);
    const contentWidth=video.videoWidth*scale,contentHeight=video.videoHeight*scale;
    const contentLeft=videoRect.left+(videoRect.width-contentWidth)/2,contentTop=videoRect.top+(videoRect.height-contentHeight)/2;
    const left=Math.max(contentLeft,guideRect.left),top=Math.max(contentTop,guideRect.top);
    const right=Math.min(contentLeft+contentWidth,guideRect.right),bottom=Math.min(contentTop+contentHeight,guideRect.bottom);
    if(right<=left||bottom<=top||stageRect.width===0)return;
    return{x:(left-contentLeft)/contentWidth,y:(top-contentTop)/contentHeight,width:(right-left)/contentWidth,height:(bottom-top)/contentHeight};
  };
  useEffect(()=>()=>cameraStream.current?.getTracks().forEach(track=>track.stop()),[]);
  useEffect(()=>{
    if(!cameraActive||!videoRef.current||!cameraStream.current)return;
    videoRef.current.srcObject=cameraStream.current;
    void videoRef.current.play().catch(()=>{});
  },[cameraActive]);
  const startCamera=async()=>{
    if(useCameraPicker||!navigator.mediaDevices?.getUserMedia){cameraInput.current?.click();return;}
    setError('');
    try{
      cameraStream.current=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160},frameRate:{ideal:30,max:30}},
        audio:false,
      });
      const cameraTrack=cameraStream.current.getVideoTracks()[0];
      const cameraCapabilities=cameraTrack?.getCapabilities() as (MediaTrackCapabilities&{focusMode?:string[]})|undefined;
      if(cameraTrack&&cameraCapabilities?.focusMode?.includes('continuous')){
        try{await cameraTrack.applyConstraints({advanced:[{focusMode:'continuous'}] as unknown as MediaTrackConstraintSet[]})}catch{}
      }
      autoCaptureStarted.current=false;captureInProgress.current=false;cameraSteady.current=false;cameraSteadySince.current=null;liveIdentity.current={key:'',count:0};liveReadRef.current={};setCameraStatus('searching');setLiveRead({});setLiveOcrStatus('waiting');
      setPreview(undefined);setPreviewSize(undefined);setImages([]);setScanBounds(undefined);setDetectedBounds(undefined);setRead(undefined);setCandidates([]);
      setCameraActive(true);
    }catch{
      setUseCameraPicker(true);
      setError(id?'Kamera langsung tidak tersedia. Tekan Ambil foto lagi untuk mencoba kamera perangkat, atau pilih gambar.':'Live camera is unavailable. Tap Take photo again to try your device camera, or choose an image.');
    }
  };
  const capturePhoto=async(autoScan=false,bounds?:NormalizedBounds)=>{
    if(captureInProgress.current)return;
    captureInProgress.current=true;
    setCameraStatus('capturing');
    const scanArea=bounds??getCameraGuideBounds();
    const track=cameraStream.current?.getVideoTracks()[0];
    if(track&&typeof ImageCapture!=='undefined'){
      try{
        const blob=await new ImageCapture(track).takePhoto();
        stopCamera();
        await choose(new File([blob],'card-scan.jpg',{type:blob.type||'image/jpeg'}),autoScan,scanArea);
        return;
      }catch{
        // Some browsers expose ImageCapture but cannot take a still photo.
      }
    }
    const video=videoRef.current;
    if(!video||!video.videoWidth||!video.videoHeight){captureInProgress.current=false;return;}
    const canvas=document.createElement('canvas');
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    const context=canvas.getContext('2d');
    if(!context){captureInProgress.current=false;setCameraStatus('steady');setError(id?'Foto tidak dapat diambil.':'Could not capture the photo.');return;}
    context.drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      if(!blob){captureInProgress.current=false;setCameraStatus('steady');setError(id?'Foto tidak dapat disimpan.':'Could not save the photo.');return;}
      stopCamera();
      void choose(new File([blob],'card-scan.jpg',{type:'image/jpeg'}),autoScan,scanArea);
    },'image/jpeg',.94);
  };
  const close=(next:boolean)=>{setOpen(next);if(!next){autoScanRequested.current=false;stopCamera();setPreview(undefined);setPreviewSize(undefined);setPreviewZoom(1);setPreviewPan({x:0,y:0});setScanBounds(undefined);setDetectedBounds(undefined);setSourceFile(undefined);setImages([]);setRead(undefined);setCandidates([]);setError('');setResultScroll({left:false,right:false});}};
  const choose=async(file?:File,autoScan=false,captureBounds?:NormalizedBounds)=>{
    if(!file)return;
    autoScanRequested.current=autoScan;
    setError('');setRead(undefined);setCandidates([]);setImages([]);setScanBounds(undefined);setDetectedBounds(undefined);setSourceFile(file);setPreviewZoom(1);setPreviewPan({x:0,y:0});
    if(file.size>12_000_000){autoScanRequested.current=false;setError(id?'Foto terlalu besar. Pilih gambar di bawah 12 MB.':'Photo is too large. Choose an image under 12 MB.');return;}
    try{
      const prepared=await scanImages(file,game,captureBounds);
      setPreview(prepared.images[0]);setPreviewSize({width:prepared.width,height:prepared.height});setScanBounds(prepared.bounds);setDetectedBounds(prepared.bounds);setImages(prepared.images);
    }catch{autoScanRequested.current=false;setError(id?'Gambar tidak dapat dibuka. Coba JPEG, PNG, atau WebP.':'Could not open that image. Try JPEG, PNG, or WebP.');}
  };
  const identify=async()=>{
    if(!sourceFile||!scanBounds)return;
    if(turnstileEnabled&&!token){setError(id?'Selesaikan pemeriksaan keamanan.':'Complete the security check first.');return;}
    setBusy(true);setOcrStage('loading');setError('');setRead(undefined);setCandidates([]);setResultScroll({left:false,right:false});
    try{
      const engine=await getPaddleEngine();
      setOcrStage('reading');
      const prepared=await scanImages(sourceFile,game,scanBounds);
      const cropImages=await Promise.all([...prepared.images.slice(1),prepared.images[0]].map(async image=>await (await fetch(image)).blob()));
      const results=await engine.predict(cropImages);
      const text=results.flatMap(result=>result.items.filter(item=>item.score>=.2).map(item=>item.text)).join('\n').trim();
      if(!text.trim())throw new Error(id?'Teks kartu tidak terbaca. Pastikan nomor dan set terlihat jelas.':'No card text was recognized. Make sure the set and card number are visible.');
      const response=await fetch('/api/cards/scan',{method:'POST',headers:{'content-type':'application/json',...turnstileHeaders(token)},body:JSON.stringify({game,text})});
      const result=await response.json() as {error?:string;read?:CardScanRead;candidates?:CardScanCandidate[]};
      if(!response.ok)throw new Error(result.error??'Card scan failed.');
      setRead(result.read);setCandidates(result.candidates??[]);
    }catch(cause){setError(cause instanceof Error?cause.message:id?'Teks kartu tidak dapat dibaca. Coba gambar yang lebih tajam.':'Could not read the card text. Try a sharper photo.');}
    finally{setBusy(false);setToken('');setTurnstileRevision(value=>value+1);}
  };
  useEffect(()=>{identifyRef.current=identify;capturePhotoRef.current=capturePhoto});
  useEffect(()=>{
    if(!autoScanRequested.current||!sourceFile||!scanBounds||(turnstileEnabled&&!token))return;
    autoScanRequested.current=false;
    void identifyRef.current?.();
  },[scanBounds,sourceFile,token]);
  useEffect(()=>{
    if(!cameraActive||!cameraReady)return;
    const video=videoRef.current;
    if(!video)return;
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return;
    let previous:NormalizedBounds|undefined;
    let steadyFrames=0;
    let timer=0;
    const checkFrame=()=>{
      if(!video.videoWidth||!video.videoHeight)return;
      let sourceX=0,sourceWidth=video.videoWidth;
      // Some phones expose a landscape stream while held upright. Inspect its
      // centered portrait area so a card can fill the guide naturally.
      if(sourceWidth>video.videoHeight*1.15){sourceWidth=Math.min(sourceWidth,video.videoHeight*.75);sourceX=(video.videoWidth-sourceWidth)/2}
      const scale=Math.min(180/sourceWidth,180/video.videoHeight);
      canvas.width=Math.max(1,Math.round(sourceWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      context.drawImage(video,sourceX,0,sourceWidth,video.videoHeight,0,0,canvas.width,canvas.height);
      const bounds=detectCardBounds(context.getImageData(0,0,canvas.width,canvas.height));
      const centered=Boolean(bounds&&bounds.width/canvas.width>=.34&&bounds.height/canvas.height>=.48&&Math.abs(bounds.x+bounds.width/2-canvas.width/2)<canvas.width*.18&&Math.abs(bounds.y+bounds.height/2-canvas.height/2)<canvas.height*.18);
      if(!bounds||!centered){previous=undefined;steadyFrames=0;cameraSteady.current=false;cameraSteadySince.current=null;liveIdentity.current={key:'',count:0};setCameraStatus('searching');setLiveOcrStatus('waiting');return}
      const stable=Boolean(previous&&Math.abs(bounds.x-previous.x)<canvas.width*.035&&Math.abs(bounds.y-previous.y)<canvas.height*.035&&Math.abs(bounds.width-previous.width)<canvas.width*.045&&Math.abs(bounds.height-previous.height)<canvas.height*.045);
      steadyFrames=stable?steadyFrames+1:1;
      previous=bounds;
      cameraSteady.current=true;
      cameraSteadySince.current??=performance.now();
      setCameraStatus('steady');
      if(!autoCaptureStarted.current&&cameraSteadySince.current!==null&&performance.now()-cameraSteadySince.current>=12000){
        autoCaptureStarted.current=true;
        window.clearInterval(timer);
        setCameraStatus('capturing');
        const captureBounds=getCameraGuideBounds()??{
          x:sourceX/video.videoWidth+bounds.x/canvas.width*(sourceWidth/video.videoWidth),
          y:bounds.y/canvas.height,
          width:bounds.width/canvas.width*(sourceWidth/video.videoWidth),
          height:bounds.height/canvas.height,
        };
        void capturePhotoRef.current?.(true,captureBounds);
      }
    };
    timer=window.setInterval(checkFrame,650);
    return()=>window.clearInterval(timer);
  },[cameraActive,cameraReady]);
  useEffect(()=>{
    if(!cameraActive||!cameraReady)return;
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false;
    let timer=0;
    const runLiveRead=async()=>{
      if(cancelled)return;
      if(!cameraSteady.current||liveOcrInProgress.current){timer=window.setTimeout(runLiveRead,900);return;}
      const guide=getCameraGuideBounds();
      if(!guide||!video.videoWidth||!video.videoHeight){timer=window.setTimeout(runLiveRead,900);return;}
      liveOcrInProgress.current=true;
      setLiveOcrStatus('loading');
      try{
        const engine=await getPaddleEngine();
        if(cancelled)return;
        setLiveOcrStatus('reading');
        const bottom={x:guide.x,y:guide.y+guide.height*.68,width:guide.width,height:guide.height*.32};
        const pokemonCorner={...bottom,width:bottom.width*.62};
        const onePieceCorner={...bottom,x:bottom.x+bottom.width*.38,width:bottom.width*.62};
        const crops=game==='pokemon'?[pokemonCorner]:game==='one-piece'?[onePieceCorner]:[pokemonCorner,onePieceCorner];
        const blobs=await Promise.all([videoCropBlob(video,guide,1100),...crops.map(crop=>videoCropBlob(video,crop,1300))]);
        const results=await engine.predict(blobs.filter((blob):blob is Blob=>Boolean(blob)));
        if(cancelled)return;
        const text=results.flatMap(result=>result.items.filter(item=>item.score>=.23).map(item=>item.text)).join('\n').trim();
        const name=liveCardName(results[0]?.items??[],results[0]?.image.height??1);
        const parsed=parseLiveCardRead(text,game,name);
        if(Object.values(parsed).some(value=>typeof value==='string'&&value.trim())){
          const key=parsed.game&&parsed.setCode&&parsed.cardNumber?`${parsed.game}:${parsed.setCode}:${parsed.cardNumber}`:'';
          const changedCard=Boolean(key&&liveIdentity.current.key&&key!==liveIdentity.current.key);
          const merged:LiveCardScanRead=changedCard?{}:{...liveReadRef.current};
          for(const field of ['game','name','setCode','cardNumber','cardNumberTotal','language','rarity','variant','block'] as const){
            const value=parsed[field];
            if(typeof value==='string'&&value.trim())(merged as Record<keyof LiveCardScanRead,string>)[field]=value;
          }
          liveReadRef.current=merged;
          setLiveRead(merged);
          if(key){liveIdentity.current=liveIdentity.current.key===key?{key,count:liveIdentity.current.count+1}:{key,count:1};}
          setLiveOcrStatus('ready');
          const mergedName=Boolean(merged.name),mergedRarity=Boolean(merged.rarity),mergedLanguage=Boolean(merged.language);
          if(key&&liveIdentity.current.count>=2&&mergedName&&mergedRarity&&mergedLanguage&&!autoCaptureStarted.current){
            autoCaptureStarted.current=true;
            void capturePhotoRef.current?.(true,getCameraGuideBounds());
          }
        }else setLiveOcrStatus('reading');
      }catch{
        if(!cancelled)setLiveOcrStatus('waiting');
      }finally{
        liveOcrInProgress.current=false;
        if(!cancelled)timer=window.setTimeout(runLiveRead,1400);
      }
    };
    void runLiveRead();
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[cameraActive,cameraReady,game]);
  const changePreviewZoom=(value:number)=>{
    if(!photoRef.current){setPreviewZoom(value);return;}
    if(value===1){setPreviewZoom(1);setPreviewPan({x:0,y:0});return;}
    const rect=photoRef.current.getBoundingClientRect();
    const focusX=scanBounds?scanBounds.x+scanBounds.width/2:.5;
    const focusY=scanBounds?scanBounds.y+scanBounds.height/2:.5;
    const maxX=(value-1)*rect.width/2,maxY=(value-1)*rect.height/2;
    const nextX=previewPan.x+(focusX-.5)*rect.width*(previewZoom-value);
    const nextY=previewPan.y+(focusY-.5)*rect.height*(previewZoom-value);
    setPreviewZoom(value);
    setPreviewPan({x:Math.max(-maxX,Math.min(maxX,nextX)),y:Math.max(-maxY,Math.min(maxY,nextY))});
  };
  const beginCropDrag=(corner:'top-left'|'top-right'|'bottom-left'|'bottom-right',event:React.PointerEvent<HTMLButtonElement>)=>{
    event.preventDefault();event.stopPropagation();
    cropDrag.current={pointerId:event.pointerId,corner,startX:event.clientX,startY:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const beginCropMove=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.button!==0||!scanBounds)return;
    event.preventDefault();event.stopPropagation();
    cropDrag.current={pointerId:event.pointerId,corner:'move',startX:event.clientX,startY:event.clientY,startBounds:scanBounds};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const beginPan=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(previewZoom<=1||event.button!==0)return;
    event.preventDefault();
    panDrag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:previewPan.x,originY:previewPan.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan=(event:React.PointerEvent<HTMLDivElement>)=>{
    const drag=panDrag.current;
    if(!drag||drag.pointerId!==event.pointerId||!photoRef.current)return;
    const rect=photoRef.current.getBoundingClientRect();
    const maxX=(previewZoom-1)*rect.width/2,maxY=(previewZoom-1)*rect.height/2;
    setPreviewPan({
      x:Math.max(-maxX,Math.min(maxX,drag.originX+event.clientX-drag.startX)),
      y:Math.max(-maxY,Math.min(maxY,drag.originY+event.clientY-drag.startY)),
    });
  };
  const finishPan=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(panDrag.current?.pointerId!==event.pointerId)return;
    panDrag.current=null;
  };
  const moveCrop=(event:React.PointerEvent<HTMLDivElement>)=>{
    const drag=cropDrag.current;
    if(drag.pointerId!==event.pointerId||!drag.corner||!photoRef.current)return;
    const rect=photoRef.current.getBoundingClientRect();
    const scaledWidth=rect.width*previewZoom,scaledHeight=rect.height*previewZoom;
    const imageLeft=rect.left+(rect.width-scaledWidth)/2+previewPan.x,imageTop=rect.top+(rect.height-scaledHeight)/2+previewPan.y;
    if(drag.corner==='move'&&drag.startBounds){
      const start=drag.startBounds;
      const dx=(event.clientX-drag.startX)/scaledWidth,dy=(event.clientY-drag.startY)/scaledHeight;
      setScanBounds({...start,x:Math.max(0,Math.min(1-start.width,start.x+dx)),y:Math.max(0,Math.min(1-start.height,start.y+dy))});
      setRead(undefined);setCandidates([]);setError('');return;
    }
    const x=Math.max(0,Math.min(1,(event.clientX-imageLeft)/scaledWidth));
    const y=Math.max(0,Math.min(1,(event.clientY-imageTop)/scaledHeight));
    setScanBounds(previous=>{
      if(!previous)return previous;
      let left=previous.x,top=previous.y,right=previous.x+previous.width,bottom=previous.y+previous.height;
      const minimum=.035;
      if(drag.corner==='top-left'){left=Math.min(x,right-minimum);top=Math.min(y,bottom-minimum)}
      if(drag.corner==='top-right'){right=Math.max(x,left+minimum);top=Math.min(y,bottom-minimum)}
      if(drag.corner==='bottom-left'){left=Math.min(x,right-minimum);bottom=Math.max(y,top+minimum)}
      if(drag.corner==='bottom-right'){right=Math.max(x,left+minimum);bottom=Math.max(y,top+minimum)}
      left=Math.max(0,left);top=Math.max(0,top);right=Math.min(1,right);bottom=Math.min(1,bottom);
      return{x:left,y:top,width:right-left,height:bottom-top};
    });
    setRead(undefined);setCandidates([]);setError('');
  };
  const nudgeCrop=(corner:'top-left'|'top-right'|'bottom-left'|'bottom-right',event:React.KeyboardEvent<HTMLButtonElement>)=>{
    const step=event.shiftKey ? .02 : .005;
    const deltaX=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;
    const deltaY=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
    if(!deltaX&&!deltaY)return;
    event.preventDefault();
    setScanBounds(previous=>{
      if(!previous)return previous;
      let left=previous.x,top=previous.y,right=previous.x+previous.width,bottom=previous.y+previous.height;
      const minimum=.035;
      if(corner==='top-left'){left=Math.max(0,Math.min(left+deltaX,right-minimum));top=Math.max(0,Math.min(top+deltaY,bottom-minimum))}
      if(corner==='top-right'){right=Math.min(1,Math.max(right+deltaX,left+minimum));top=Math.max(0,Math.min(top+deltaY,bottom-minimum))}
      if(corner==='bottom-left'){left=Math.max(0,Math.min(left+deltaX,right-minimum));bottom=Math.min(1,Math.max(bottom+deltaY,top+minimum))}
      if(corner==='bottom-right'){right=Math.min(1,Math.max(right+deltaX,left+minimum));bottom=Math.min(1,Math.max(bottom+deltaY,top+minimum))}
      return{x:left,y:top,width:right-left,height:bottom-top};
    });
    setRead(undefined);setCandidates([]);setError('');
  };
  const finishCropDrag=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(cropDrag.current.pointerId!==event.pointerId)return;
    cropDrag.current={pointerId:-1,corner:null,startX:0,startY:0};
  };
  const select=async(card:CardScanCandidate)=>{
    if(!onSelect){window.location.assign(cardHref(card,locale));return;}
    setBusy(true);setError('');
    try{await onSelect(card);close(false)}catch{setError(id?'Kartu tidak dapat dibuka. Coba lagi.':'Could not open this card. Try again.')}finally{setBusy(false)}
  };
  const updateResultScroll=useCallback(()=>{
    const track=resultTrack.current;
    if(!track)return;
    const maxScroll=Math.max(0,track.scrollWidth-track.clientWidth);
    setResultScroll({left:track.scrollLeft>3,right:maxScroll-track.scrollLeft>3});
  },[]);
  useEffect(()=>{
    const frame=window.requestAnimationFrame(updateResultScroll);
    window.addEventListener('resize',updateResultScroll);
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('resize',updateResultScroll)};
  },[candidates,read,updateResultScroll]);
  return <>
    <button type="button" className={`card-scan-trigger${className?` ${className}`:''}`} aria-label={id?'Pindai kartu':'Scan card'} title={id?'Pindai kartu':'Scan card'} onClick={event=>{event.preventDefault();setOpen(true)}}><CameraIcon size={18} aria-hidden="true"/></button>
    <Dialog open={open} onOpenChange={close}><DialogContent className={`card-scan-dialog${preview?' has-preview':''}`} overlayClassName="card-scan-overlay">
      <DialogHeader className="card-scan-header"><DialogTitle>{cameraActive?(id?'Pindai kartu':'Scan a card'):(id?'Pindai kartu':'Scan a card')}</DialogTitle>{cameraActive?<DialogDescription>{cameraStatus==='capturing'?(id?'Mengambil foto dan memindai kartu…':'Capturing and scanning…'):cameraStatus==='steady'?(id?'Kartu terdeteksi. Tahan posisi sebentar.':'Card found. Hold it steady.'):id?'Posisikan kartu di dalam bingkai. Foto diambil otomatis saat kartu stabil.':'Place the card inside the frame. It will capture once the card is steady.'}</DialogDescription>:preview&&<DialogDescription>{id?'Pastikan seluruh kartu masuk ke dalam bingkai.':'Keep the full card inside the frame.'}</DialogDescription>}</DialogHeader>
      {cameraActive&&<section className="card-scan-camera-view"><div ref={cameraStageRef} className="card-scan-camera-stage"><video ref={videoRef} className="card-scan-live-video" autoPlay muted playsInline onLoadedMetadata={()=>setCameraReady(true)} aria-label={id?'Pratinjau kamera':'Camera preview'}/><div ref={cameraGuideRef} className="card-scan-camera-guide" aria-hidden="true"/></div><p className={`card-scan-camera-status is-${cameraStatus}`} role="status">{cameraStatus==='capturing'?(id?'Memindai…':'Scanning…'):cameraStatus==='steady'?(id?'Kartu stabil':'Card is steady'):id?'Cari kartu':'Finding card'}</p><dl className="card-scan-live-fields" aria-live="polite"><div className="is-name"><dt>{id?'Nama':'Name'}</dt><dd>{liveRead.name||'—'}</dd></div><div><dt>Set</dt><dd>{liveRead.setCode||'—'}</dd></div><div><dt>{id?'Nomor':'Number'}</dt><dd>{liveRead.cardNumber?`${liveRead.cardNumber}${liveRead.cardNumberTotal?`/${liveRead.cardNumberTotal}`:''}`:'—'}</dd></div><div><dt>{id?'Kelangkaan':'Rarity'}</dt><dd>{liveRead.rarity||'—'}</dd></div><div><dt>{id?'Bahasa':'Language'}</dt><dd>{liveRead.language||'—'}</dd></div></dl><p className="card-scan-live-status" role="status">{liveOcrStatus==='loading'?(id?'Menyiapkan pembacaan…':'Starting live read…'):liveOcrStatus==='reading'?(id?'Membaca tulisan kartu':'Reading card text'):liveOcrStatus==='ready'?(id?'Detail kartu diperbarui':'Card details updating'):id?'Arahkan kartu ke dalam bingkai':'Hold the card inside the frame'}</p><div className="card-scan-camera-actions"><button type="button" className="button secondary" onClick={stopCamera}>{id?'Batal':'Cancel'}</button><button type="button" className="button card-scan-capture" onClick={()=>void capturePhoto()} disabled={!cameraReady||cameraStatus==='capturing'}>{id?'Ambil sekarang':'Capture now'}</button></div></section>}
      {preview&&<div className="card-scan-workspace">
      <div ref={photoRef} className={`card-scan-photo${previewZoom>1?' is-zoomed':''}`} onPointerDown={beginPan} onPointerMove={event=>{moveCrop(event);movePan(event)}} onPointerUp={event=>{finishCropDrag(event);finishPan(event)}} onPointerCancel={event=>{finishCropDrag(event);finishPan(event)}} style={previewSize?{aspectRatio:`${previewSize.width}/${previewSize.height}`,width:`min(100%, ${Math.min(520,320*previewSize.width/previewSize.height)}px)`}:undefined}>
        {preview&&<div className="card-scan-photo-content" style={{left:`calc(50% - ${previewZoom*50}% + ${previewPan.x}px)`,top:`calc(50% - ${previewZoom*50}% + ${previewPan.y}px)`,width:`${previewZoom*100}%`,height:`${previewZoom*100}%`}}><Image src={preview} width={previewSize?.width??440} height={previewSize?.height??235} unoptimized alt={id?'Foto kartu yang dipilih':'Selected card photo'}/></div>}
        {preview&&scanBounds&&<div className="card-scan-crop-box" onPointerDown={beginCropMove} style={{left:`calc(50% + ${(scanBounds.x-.5)*previewZoom*100}% + ${previewPan.x}px)`,top:`calc(50% + ${(scanBounds.y-.5)*previewZoom*100}% + ${previewPan.y}px)`,width:`${scanBounds.width*previewZoom*100}%`,height:`${scanBounds.height*previewZoom*100}%`}} aria-label={id?'Batas kartu yang bisa diatur':'Adjustable card outline'}>
          {(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner=><button key={corner} type="button" className={`card-scan-crop-handle is-${corner}`} aria-label={id?`Atur sudut ${corner}`:`Adjust ${corner} corner`} onPointerDown={event=>beginCropDrag(corner,event)} onKeyDown={event=>nudgeCrop(corner,event)}/>) }
        </div>}
        {!preview&&<CameraIcon size={34} aria-hidden="true"/>}
      </div>
      </div>}
      {preview&&read&&<section className="card-scan-read-panel" aria-label={id?'Detail kartu':'Card details'}><dl className="card-scan-read-fields">{read.setCode&&<div><dt>Set</dt><dd>{read.setCode}</dd></div>}{read.cardNumber&&<div><dt>{id?'Nomor':'Number'}</dt><dd>{read.cardNumber}{read.cardNumberTotal?`/${read.cardNumberTotal}`:''}</dd></div>}{read.rarity&&<div><dt>{id?'Kelangkaan':'Rarity'}</dt><dd>{read.rarity}</dd></div>}{read.language&&<div><dt>{id?'Bahasa':'Language'}</dt><dd>{read.language}</dd></div>}</dl></section>}
      {preview&&!read&&Object.values(liveRead).some(Boolean)&&<section className="card-scan-live-fields is-captured" aria-label={id?'Detail sementara':'Live details'}><div className="is-name"><dt>{id?'Nama':'Name'}</dt><dd>{liveRead.name||'—'}</dd></div>{liveRead.setCode&&<div><dt>Set</dt><dd>{liveRead.setCode}</dd></div>}{liveRead.cardNumber&&<div><dt>{id?'Nomor':'Number'}</dt><dd>{liveRead.cardNumber}{liveRead.cardNumberTotal?`/${liveRead.cardNumberTotal}`:''}</dd></div>}{liveRead.rarity&&<div><dt>{id?'Kelangkaan':'Rarity'}</dt><dd>{liveRead.rarity}</dd></div>}{liveRead.language&&<div><dt>{id?'Bahasa':'Language'}</dt><dd>{liveRead.language}</dd></div>}</section>}
      {preview&&<div className="card-scan-crop-tools"><span>{id?'Seret sudut atau bingkai untuk memilih area kartu. Perbesar foto lalu geser untuk melihat tulisan kecil.':'Drag a corner or the frame to select the card area. Zoom in, then move the photo to check small print.'}</span><label className="card-scan-zoom"><span>{id?'Zoom':'Zoom'}</span><input type="range" min="1" max="5" step=".1" value={previewZoom} onChange={event=>changePreviewZoom(Number(event.target.value))} aria-label={id?'Perbesar pratinjau':'Zoom preview'}/><output>{Math.round(previewZoom*100)}%</output></label><button type="button" className="card-scan-crop-reset" onClick={()=>{setScanBounds(detectedBounds);setPreviewZoom(1);setPreviewPan({x:0,y:0});setRead(undefined);setCandidates([]);setError('')}} disabled={!detectedBounds}>{id?'Atur ulang':'Reset view'}</button></div>}
      {!cameraActive&&<div className="card-scan-source-actions">
        <button type="button" className="button secondary" onClick={()=>{if(useCameraPicker){setError('');cameraInput.current?.click()}else void startCamera()}}><CameraIcon size={17}/>{useCameraPicker?(id?'Buka kamera':'Open camera'):(id?'Ambil foto':'Take photo')}</button>
        <button type="button" className="button secondary" onClick={()=>uploadInput.current?.click()}><ImageSquareIcon size={17}/>{id?'Pilih gambar':'Choose image'}</button>
        <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
        <input ref={uploadInput} className="sr-only" type="file" accept="image/*" onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
      </div>}
      {turnstileEnabled&&images.length>0&&<TurnstileField onToken={setToken} resetKey={turnstileRevision}/>}
      {images.length>0&&<button type="button" className="button card-scan-submit" disabled={busy} onClick={()=>void identify()}>{busy?<SpinnerGapIcon size={17} className="card-scan-spinner"/>:<CameraIcon size={17}/>} {busy?(id?(ocrStage==='loading'?'Menyiapkan pemindaian…':'Membaca kartu…'):(ocrStage==='loading'?'Getting ready…':'Reading card…')):(id?'Cari kartu':'Search cards')}</button>}
      {error&&<p className="card-scan-error" role="alert">{error}</p>}
      {read&&<section className={`card-scan-results${resultScroll.left?' has-left-overflow':''}${resultScroll.right?' has-right-overflow':''}`} aria-live="polite">
        <header><p>{candidates.length?(id?'Kartu yang cocok':'Possible matches'):(id?'Kartu tidak ditemukan.':'No matching cards found.')}</p>{candidates.length>1&&<div className="card-scan-results-controls"><button type="button" aria-label={id?'Geser ke kiri':'Scroll left'} disabled={!resultScroll.left} onClick={()=>resultTrack.current?.scrollBy({left:-260,behavior:'smooth'})}><CaretLeftIcon size={17}/></button><button type="button" aria-label={id?'Geser ke kanan':'Scroll right'} disabled={!resultScroll.right} onClick={()=>resultTrack.current?.scrollBy({left:260,behavior:'smooth'})}><CaretRightIcon size={17}/></button></div>}</header>
        {candidates.length>0&&<div ref={resultTrack} role="region" className="card-scan-results-track" aria-label={id?'Hasil kartu yang cocok':'Matching cards'} onScroll={updateResultScroll} onLoad={updateResultScroll}>
        {candidates.map(card=><button type="button" key={card.id} disabled={busy} aria-label={`${card.name}, ${card.setCode} ${card.cardNumber}, ${card.language}${card.rarity?`, ${card.rarity}`:''}`} onClick={()=>void select(card)} className={`card-scan-result${card.game==='pokemon'?' pokemon-card-tile':' catalog-card catalog-card-button'}`}>
          {card.game==='pokemon'?<CardArt card={scanDisplayCard(card)}/>:<span className="card-stage"><CardArt card={scanDisplayCard(card)}/></span>}
          {card.game==='pokemon'?<span className="pokemon-card-caption"><strong>{card.name}</strong><span className="pokemon-card-meta-row"><small className="pokemon-card-set-badge">{card.setCode.toLowerCase()}</small><small className="pokemon-card-number">{card.cardNumber.includes('/')?card.cardNumber:`${card.cardNumber}${card.setCardCount?`/${card.setCardCount}`:''}`}</small>{card.rarity&&<small className="pokemon-card-rarity">{pokemonRarityLabel(card.rarity,card.language)||card.rarity}</small>}</span></span>:<><span className="card-meta"><span><b>{card.setCode}</b><small>{card.cardNumber}</small><small>{card.language}</small></span>{card.rarity&&<span className={`rarity rarity-${card.rarity}`}>{card.rarity}</span>}</span><span className="card-title"><h3>{card.name}</h3></span><small className="card-scan-printing-variant">{scanVariantLabel(card.variant)||'Standard'}</small></>}
        </button>)}
        </div>}
      </section>}
    </DialogContent></Dialog>
  </>;
}
