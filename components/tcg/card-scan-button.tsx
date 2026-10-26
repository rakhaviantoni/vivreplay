'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {
  ArrowsCounterClockwiseIcon,
  CameraIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  FlashlightIcon,
  ImageSquareIcon,
  SpinnerGapIcon,
  XIcon,
} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
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
        lang:'en',ocrVersion:'PP-OCRv5',worker:false,
        ortOptions:{backend:'wasm',wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',simd:true},
      });
    })();
  }
  try{return await paddleEnginePromise}catch(error){paddleEnginePromise=undefined;throw error}
}

async function loadSourceCanvas(file:Blob):Promise<{canvas:HTMLCanvasElement;width:number;height:number}>{
  const maxDim=1920;
  if(typeof createImageBitmap!=='undefined'){
    try{
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height));
      const width=Math.max(1,Math.round(bitmap.width*scale));
      const height=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      if(context){
        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality='high';
        context.drawImage(bitmap,0,0,width,height);
        bitmap.close();
        return {canvas,width,height};
      }
      bitmap.close();
    }catch{}
  }
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new window.Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const scale=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
      const width=Math.max(1,Math.round(img.naturalWidth*scale));
      const height=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      if(!context){reject(new Error('Canvas context unavailable'));return;}
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(img,0,0,width,height);
      resolve({canvas,width,height});
    };
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src=url;
  });
}

function dataUrl(source:HTMLCanvasElement,box:{x:number;y:number;width:number;height:number},maxWidth:number,maxScale=1,enhance=false){
  const scale=Math.min(maxScale,maxWidth/Math.max(1,box.width));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(box.width*scale));
  canvas.height=Math.max(1,Math.round(box.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:enhance});
  if(!context)return '';
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(source,box.x,box.y,box.width,box.height,0,0,canvas.width,canvas.height);
  if(enhance){
    const image=context.getImageData(0,0,canvas.width,canvas.height);
    for(let index=0;index<image.data.length;index+=4){
      const gray=image.data[index]*.299+image.data[index+1]*.587+image.data[index+2]*.114;
      const contrast=Math.max(0,Math.min(255,(gray-128)*1.45+128));
      image.data[index]=contrast;image.data[index+1]=contrast;image.data[index+2]=contrast;
    }
    context.putImageData(image,0,0);
  }
  const url=canvas.toDataURL('image/jpeg',.88);
  canvas.width=0;canvas.height=0;
  return url;
}

async function getCroppedCardBlob(file:File|Blob,bounds?:NormalizedBounds):Promise<Blob>{
  const {canvas:sourceCanvas,width,height}=await loadSourceCanvas(file);
  try{
    const box=bounds?{
      x:Math.max(0,Math.min(width-10,Math.round(bounds.x*width))),
      y:Math.max(0,Math.min(height-10,Math.round(bounds.y*height))),
      width:Math.min(width,Math.max(20,Math.round(bounds.width*width))),
      height:Math.min(height,Math.max(20,Math.round(bounds.height*height))),
    }:{x:0,y:0,width,height};
    const cropCanvas=document.createElement('canvas');
    const maxDim=800;
    const scale=Math.min(1,maxDim/Math.max(box.width,box.height));
    cropCanvas.width=Math.max(1,Math.round(box.width*scale));
    cropCanvas.height=Math.max(1,Math.round(box.height*scale));
    const context=cropCanvas.getContext('2d');
    if(!context)return file;
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.drawImage(sourceCanvas,box.x,box.y,box.width,box.height,0,0,cropCanvas.width,cropCanvas.height);
    return new Promise(resolve=>{
      cropCanvas.toBlob(blob=>{
        cropCanvas.width=0;cropCanvas.height=0;
        resolve(blob??file);
      },'image/jpeg',.90);
    });
  }finally{
    sourceCanvas.width=0;
    sourceCanvas.height=0;
  }
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
  const {canvas:sourceCanvas,width,height}=await loadSourceCanvas(file);
  try{
    const full=dataUrl(sourceCanvas,{x:0,y:0,width,height},1080);
    const detectionScale=Math.min(1,240/width,240/height);
    const detectionCanvas=document.createElement('canvas');
    detectionCanvas.width=Math.max(1,Math.round(width*detectionScale));
    detectionCanvas.height=Math.max(1,Math.round(height*detectionScale));
    const detectionContext=detectionCanvas.getContext('2d',{willReadFrequently:true});
    detectionContext?.drawImage(sourceCanvas,0,0,detectionCanvas.width,detectionCanvas.height);
    const detected=detectionContext?detectCardBounds(detectionContext.getImageData(0,0,detectionCanvas.width,detectionCanvas.height)):null;
    const detW=detectionCanvas.width;
    const detH=detectionCanvas.height;
    detectionCanvas.width=0;
    detectionCanvas.height=0;
    const bounds=cropOverride?{
      x:cropOverride.x*width,y:cropOverride.y*height,
      width:cropOverride.width*width,height:cropOverride.height*height,
    }:detected?{
      x:(detected.x/detW)*width,
      y:(detected.y/detH)*height,
      width:(detected.width/detW)*width,
      height:(detected.height/detH)*height,
    }:{x:0,y:0,width,height};
    const relative=(x:number,y:number,w:number,h:number)=>({
      x:Math.max(0,bounds.x+bounds.width*x),
      y:Math.max(0,bounds.y+bounds.height*y),
      width:Math.min(width-(bounds.x+bounds.width*x),bounds.width*w),
      height:Math.min(height-(bounds.y+bounds.height*y),bounds.height*h),
    });
    const footer=(top:number)=>relative(0,top,1,1-top);
    const pokemonCorner=relative(0,.7,.58,.3);
    const onePieceCorner=relative(.42,.7,.58,.3);
    const crops=game==='pokemon'?[pokemonCorner,footer(.7),footer(.84)]:game==='one-piece'?[onePieceCorner,footer(.7),footer(.84)]:[pokemonCorner,onePieceCorner,footer(.7),footer(.84)];
    const focused=crops.map((crop,index)=>dataUrl(sourceCanvas,crop,960,2,index>0));
    return {images:[full,...focused],width,height,bounds:{x:bounds.x/width,y:bounds.y/height,width:bounds.width/width,height:bounds.height/height}};
  }finally{
    sourceCanvas.width=0;
    sourceCanvas.height=0;
  }
}

function cardHref(card:CardScanCandidate,locale:'EN'|'ID'){
  const path=card.game==='pokemon'?'/pokemon/cards':'/cards';
  const params=new URLSearchParams({lang:card.language});
  if(card.game==='pokemon'){
    params.set('printing',card.id);
    params.set('set',card.setCode);
    params.set('number',card.cardNumber.split('/')[0]??card.cardNumber);
  }else params.set('card',card.code);
  return `${locale==='ID'?'/id':''}${path}?${params}`;
}

function scanVariantLabel(value:string){return value.split(/\s*[|·]\s*/)[0]?.trim()||value.trim()}

function cleanCardNumber(cardNumber?:string|null):string{
  if(!cardNumber)return '';
  const trimmed=cardNumber.trim();
  if(/^CT-\d+$/i.test(trimmed))return '';
  return trimmed.replace(/^CT-\d+\s*/i,'');
}

function scanDisplayCard(candidate:CardScanCandidate):Card&{gameSlug:'pokemon'|'one-piece'}{
  const cleanNumber=cleanCardNumber(candidate.cardNumber);
  return {
    id:candidate.id,code:candidate.code,name:candidate.name,color:'',type:'Character',cost:0,power:0,
    rarity:candidate.rarity,art:0,effect:'',imageUrl:candidate.imageUrl??undefined,gameSlug:candidate.game,
    setCode:candidate.setCode,language:candidate.language,printingCode:cleanNumber,
    localCardNumber:cleanNumber.split('/')[0],variant:candidate.variant,
  };
}

function triggerHaptic(pattern:number|number[]){
  if(typeof navigator!=='undefined'&&'vibrate' in navigator){
    try{navigator.vibrate(pattern)}catch{}
  }
}

export function CardScanButton({game,locale='EN',onSelect,className}:Props){
  const [open,setOpen]=useState(false);
  const [selectedGame,setSelectedGame]=useState<'auto'|'pokemon'|'one-piece'>(game);
  const [preview,setPreview]=useState<string>();
  const [previewSize,setPreviewSize]=useState<{width:number;height:number}>();
  const [previewZoom,setPreviewZoom]=useState(1);
  const [previewPan,setPreviewPan]=useState({x:0,y:0});
  const [cameraActive,setCameraActive]=useState(false);
  const [cameraReady,setCameraReady]=useState(false);
  const [cameraStatus,setCameraStatus]=useState<'searching'|'steady'|'capturing'>('searching');
  const [torchAvailable,setTorchAvailable]=useState(false);
  const [torchOn,setTorchOn]=useState(false);
  const [scanMethod,setScanMethod]=useState<'vision'|'ocr'|null>(null);
  const [useCameraPicker,setUseCameraPicker]=useState(false);
  const [scanBounds,setScanBounds]=useState<NormalizedBounds>();
  const [detectedBounds,setDetectedBounds]=useState<NormalizedBounds>();
  const [sourceFile,setSourceFile]=useState<File>();
  const [images,setImages]=useState<string[]>([]);
  const [read,setRead]=useState<CardScanRead>();
  const [candidates,setCandidates]=useState<CardScanCandidate[]>([]);
  const [selectedCandidateIndex,setSelectedCandidateIndex]=useState(0);
  const [busy,setBusy]=useState(false);
  const [ocrStage,setOcrStage]=useState<'loading'|'reading'>('loading');
  const [error,setError]=useState('');
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
  const cropDrag=useRef<{pointerId:number;corner:'top-left'|'top-right'|'bottom-left'|'bottom-right'|'move'|null;startX:number;startY:number;startBounds?:NormalizedBounds}>({pointerId:-1,corner:null,startX:0,startY:0});
  const resultTrack=useRef<HTMLDivElement>(null);
  const panDrag=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
  const id=locale==='ID';

  useEffect(()=>{setSelectedGame(game)},[game]);

  const stopCamera=()=>{
    if(torchOn)setTorchOn(false);
    setTorchAvailable(false);
    cameraStream.current?.getTracks().forEach(track=>track.stop());
    cameraStream.current=null;
    setCameraActive(false);
    setCameraReady(false);
  };

  const toggleTorch=async()=>{
    const track=cameraStream.current?.getVideoTracks()[0];
    if(!track)return;
    try{
      const next=!torchOn;
      await track.applyConstraints({advanced:[{torch:next} as unknown as MediaTrackConstraintSet]});
      setTorchOn(next);
    }catch(err){
      console.warn('Torch toggle failed',err);
    }
  };

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
        video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}},
        audio:false,
      });
      const cameraTrack=cameraStream.current.getVideoTracks()[0];
      const cameraCapabilities=cameraTrack?.getCapabilities() as (MediaTrackCapabilities&{focusMode?:string[];torch?:boolean})|undefined;
      if(cameraTrack&&cameraCapabilities?.focusMode?.includes('continuous')){
        try{await cameraTrack.applyConstraints({advanced:[{focusMode:'continuous'}] as unknown as MediaTrackConstraintSet[]})}catch{}
      }
      setTorchAvailable(Boolean(cameraCapabilities?.torch));
      setTorchOn(false);
      autoCaptureStarted.current=false;captureInProgress.current=false;cameraSteady.current=false;cameraSteadySince.current=null;setCameraStatus('searching');
      setPreview(undefined);setPreviewSize(undefined);setImages([]);setScanBounds(undefined);setDetectedBounds(undefined);setRead(undefined);setCandidates([]);setSelectedCandidateIndex(0);setScanMethod(null);
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
    triggerHaptic(35);
    const scanArea=bounds??getCameraGuideBounds();
    const video=videoRef.current;
    if(!video||!video.videoWidth||!video.videoHeight){
      captureInProgress.current=false;
      setCameraStatus('searching');
      return;
    }
    try{
      const maxDim=1920;
      const scale=Math.min(1,maxDim/Math.max(video.videoWidth,video.videoHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const context=canvas.getContext('2d');
      if(!context){
        captureInProgress.current=false;
        setCameraStatus('steady');
        setError(id?'Foto tidak dapat diambil.':'Could not capture the photo.');
        return;
      }
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(video,0,0,canvas.width,canvas.height);
      stopCamera();
      await new Promise<void>(resolve=>{
        canvas.toBlob(blob=>{
          canvas.width=0;canvas.height=0;
          if(!blob){
            setCameraStatus('steady');
            setError(id?'Foto tidak dapat disimpan.':'Could not save the photo.');
            resolve();
            return;
          }
          void choose(new File([blob],'card-scan.jpg',{type:'image/jpeg'}),autoScan,scanArea).finally(resolve);
        },'image/jpeg',.92);
      });
    }catch{
      setCameraStatus('steady');
      setError(id?'Foto tidak dapat diambil.':'Could not capture the photo.');
    }finally{
      captureInProgress.current=false;
    }
  };

  const close=(next:boolean)=>{
    setOpen(next);
    if(!next){
      autoScanRequested.current=false;
      captureInProgress.current=false;
      stopCamera();
      setPreview(undefined);
      setPreviewSize(undefined);
      setPreviewZoom(1);
      setPreviewPan({x:0,y:0});
      setScanBounds(undefined);
      setDetectedBounds(undefined);
      setSourceFile(undefined);
      setImages([]);
      setRead(undefined);
      setCandidates([]);
      setSelectedCandidateIndex(0);
      setScanMethod(null);
      setError('');
      setResultScroll({left:false,right:false});
    }
  };

  const resumeScanning=()=>{
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setRead(undefined);
    setPreview(undefined);
    setPreviewSize(undefined);
    setSourceFile(undefined);
    setScanBounds(undefined);
    setDetectedBounds(undefined);
    setScanMethod(null);
    setError('');
    autoCaptureStarted.current=false;
    captureInProgress.current=false;
    cameraSteady.current=false;
    cameraSteadySince.current=null;
    setCameraStatus('searching');
    void startCamera();
  };

  const openScanner=()=>{
    setOpen(true);
    void startCamera();
  };

  const choose=async(file?:File,autoScan=false,captureBounds?:NormalizedBounds)=>{
    if(!file)return;
    autoScanRequested.current=autoScan;
    setError('');setRead(undefined);setCandidates([]);setSelectedCandidateIndex(0);setImages([]);setScanBounds(undefined);setDetectedBounds(undefined);setSourceFile(file);setPreviewZoom(1);setPreviewPan({x:0,y:0});setScanMethod(null);
    if(file.size>24_000_000){autoScanRequested.current=false;setError(id?'Foto terlalu besar. Pilih gambar di bawah 24 MB.':'Photo is too large. Choose an image under 24 MB.');return;}
    try{
      const prepared=await scanImages(file,selectedGame,captureBounds);
      setPreview(prepared.images[0]);setPreviewSize({width:prepared.width,height:prepared.height});setScanBounds(prepared.bounds);setDetectedBounds(prepared.bounds);setImages(prepared.images);
    }catch{autoScanRequested.current=false;setError(id?'Gambar tidak dapat dibuka. Coba JPEG, PNG, atau WebP.':'Could not open that image. Try JPEG, PNG, or WebP.');}
  };

  const identify=async()=>{
    if(!sourceFile||!scanBounds)return;
    setBusy(true);setOcrStage('loading');setError('');setRead(undefined);setCandidates([]);setSelectedCandidateIndex(0);setResultScroll({left:false,right:false});
    try{
      const vpsScannerUrl=process.env.NEXT_PUBLIC_CARD_SCANNER_URL||'https://scan.vivreplay.com';
      if(vpsScannerUrl){
        try{
          setOcrStage('reading');
          const croppedBlob=await getCroppedCardBlob(sourceFile,scanBounds);
          const formData=new FormData();
          formData.append('image',croppedBlob,'card-scan.jpg');
          if(selectedGame!=='auto')formData.append('game',selectedGame);
          const vpsResponse=await fetch(`${vpsScannerUrl.replace(/\/+$/,'')}/api/scan`,{method:'POST',body:formData});
          if(vpsResponse.ok){
            const vpsData=await vpsResponse.json() as {status:string;product?:CardScanCandidate;candidates?:CardScanCandidate[]};
            if(vpsData.status==='match'&&vpsData.product){
              const rawMatches=vpsData.candidates?.length?vpsData.candidates:[vpsData.product];
              const matches=rawMatches.map(c=>({...c,cardNumber:cleanCardNumber(c.cardNumber)}));
              const cleanProduct={...vpsData.product,cardNumber:cleanCardNumber(vpsData.product.cardNumber)};
              triggerHaptic([40,50,40]);
              setCandidates(matches);
              setSelectedCandidateIndex(0);
              setScanMethod('vision');
              setRead({
                game:cleanProduct.game,
                name:cleanProduct.name,
                setCode:cleanProduct.setCode,
                cardNumber:cleanProduct.cardNumber,
                cardNumberTotal:'',
                language:cleanProduct.language,
                rarity:cleanProduct.rarity,
                variant:cleanProduct.variant,
                block:'',
              });
              return;
            }
          }
        }catch(err){
          console.warn('VivrePlay Vision scan error, checking fallback',err);
        }
      }
      try{
        setScanMethod('ocr');
        const engine=await getPaddleEngine();
        setOcrStage('reading');
        const prepared=await scanImages(sourceFile,selectedGame,scanBounds);
        const candidateUrls=[...prepared.images.slice(1),prepared.images[0]];
        let combinedText='';
        for(const dataUri of candidateUrls){
          const blob=await (await fetch(dataUri)).blob();
          const results=await engine.predict([blob]);
          const text=results.flatMap(result=>result.items.filter(item=>item.score>=.2).map(item=>item.text)).join('\n').trim();
          if(text){
            combinedText=combinedText?`${combinedText}\n${text}`:text;
            const candidateRead=parseLiveCardRead(combinedText,selectedGame);
            if(candidateRead.cardNumber&&candidateRead.setCode){
              break;
            }
          }
        }
        if(!combinedText.trim())throw new Error(id?'Teks kartu tidak terbaca. Pastikan nomor dan set terlihat jelas.':'No card text was recognized. Make sure the set and card number are visible.');
        const response=await fetch('/api/cards/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game:selectedGame,text:combinedText})});
        const result=await response.json() as {error?:string;read?:CardScanRead;candidates?:CardScanCandidate[]};
        if(!response.ok)throw new Error(result.error??'Card scan failed.');
        const cleanCandidates=(result.candidates??[]).map(c=>({...c,cardNumber:cleanCardNumber(c.cardNumber)}));
        triggerHaptic([40,50,40]);
        setRead(result.read?{...result.read,cardNumber:cleanCardNumber(result.read.cardNumber)}:undefined);
        setCandidates(cleanCandidates);
        setSelectedCandidateIndex(0);
      }catch(cause){
        setError(cause instanceof Error?cause.message:id?'Teks kartu tidak dapat dibaca. Coba gambar yang lebih tajam.':'Could not read the card text. Try a sharper photo.');
      }
    }finally{
      setBusy(false);
    }
  };

  useEffect(()=>{identifyRef.current=identify;capturePhotoRef.current=capturePhoto});
  useEffect(()=>{
    if(!autoScanRequested.current||!sourceFile||!scanBounds)return;
    autoScanRequested.current=false;
    void identifyRef.current?.();
  },[scanBounds,sourceFile]);

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
      if(!video.videoWidth||!video.videoHeight||captureInProgress.current)return;
      let sourceX=0,sourceWidth=video.videoWidth;
      if(sourceWidth>video.videoHeight*1.15){sourceWidth=Math.min(sourceWidth,video.videoHeight*.75);sourceX=(video.videoWidth-sourceWidth)/2}
      const scale=Math.min(180/sourceWidth,180/video.videoHeight);
      canvas.width=Math.max(1,Math.round(sourceWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      context.drawImage(video,sourceX,0,sourceWidth,video.videoHeight,0,0,canvas.width,canvas.height);
      const bounds=detectCardBounds(context.getImageData(0,0,canvas.width,canvas.height));
      const centered=Boolean(bounds&&bounds.width/canvas.width>=.34&&bounds.height/canvas.height>=.48&&Math.abs(bounds.x+bounds.width/2-canvas.width/2)<canvas.width*.18&&Math.abs(bounds.y+bounds.height/2-canvas.height/2)<canvas.height*.18);
      if(!bounds||!centered){previous=undefined;steadyFrames=0;cameraSteady.current=false;cameraSteadySince.current=null;setCameraStatus('searching');return}
      const stable=Boolean(previous&&Math.abs(bounds.x-previous.x)<canvas.width*.035&&Math.abs(bounds.y-previous.y)<canvas.height*.035&&Math.abs(bounds.width-previous.width)<canvas.width*.045&&Math.abs(bounds.height-previous.height)<canvas.height*.045);
      steadyFrames=stable?steadyFrames+1:1;
      previous=bounds;
      if(!cameraSteady.current){
        triggerHaptic(30);
      }
      cameraSteady.current=true;
      cameraSteadySince.current??=performance.now();
      setCameraStatus('steady');
      if(!autoCaptureStarted.current&&cameraSteadySince.current!==null&&performance.now()-cameraSteadySince.current>=1600){
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
    timer=window.setInterval(checkFrame,550);
    return()=>window.clearInterval(timer);
  },[cameraActive,cameraReady]);

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
    const step=event.shiftKey?.02:.005;
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

  const activeCandidate=candidates[selectedCandidateIndex]??candidates[0];

  return <>
    <button
      type="button"
      className={`card-scan-trigger${className?` ${className}`:''}`}
      aria-label={id?'Pindai kartu':'Scan card'}
      title={id?'Pindai kartu':'Scan card'}
      onClick={event=>{event.preventDefault();openScanner()}}
    >
      <CameraIcon size={18} aria-hidden="true"/>
    </button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={`card-scan-dialog${preview?' has-preview':''}`} overlayClassName="card-scan-overlay">
        <DialogHeader className="card-scan-header">
          <DialogTitle>
            {candidates.length>0?(id?'Hasil Pindai Kartu':'Scan Result'):cameraActive?(id?'Pindai Kartu TCG':'Scan TCG Card'):(id?'Pindai Kartu':'Scan Card')}
          </DialogTitle>
          <DialogDescription>
            {candidates.length>0
              ?(id?'Kartu berhasil dicocokkan. Pilih kartu untuk melihat detail, atau pindai kartu berikutnya.':'Card matched. Select to view details, or scan your next card.')
              :cameraActive
              ?(cameraStatus==='capturing'
                ?(id?'Mengambil foto dan memindai visual kartu…':'Capturing and scanning card visual…')
                :cameraStatus==='steady'
                ?(id?'Kartu terdeteksi. Tahan sebentar…':'Card detected. Hold steady…')
                :(id?'Posisikan kartu di dalam bingkai. Foto diambil otomatis saat stabil.':'Keep card inside frame. Captures automatically when steady.'))
              :preview
              ?(id?'Pastikan seluruh kartu masuk ke dalam bingkai.':'Keep the full card inside the frame.')
              :(id?'Arahkan kamera ke kartu Pokémon atau One Piece Anda.':'Point camera at your Pokémon or One Piece card.')}
          </DialogDescription>
        </DialogHeader>

        {cameraActive&&!candidates.length&&<section className="card-scan-camera-view">
          <div ref={cameraStageRef} className={`card-scan-camera-stage${cameraStatus==='steady'?' is-steady':''}`}>
            <video
              ref={videoRef}
              className="card-scan-live-video"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={()=>setCameraReady(true)}
              aria-label={id?'Pratinjau kamera':'Camera preview'}
            />
            <div className="card-scan-hud-top">
              <div className="card-scan-game-switcher" role="radiogroup" aria-label={id?'Pilih Game':'Select Game'}>
                {(['auto','pokemon','one-piece'] as const).map(g=>(
                  <button
                    key={g}
                    type="button"
                    className={`card-scan-game-pill${selectedGame===g?' is-active':''}`}
                    onClick={()=>setSelectedGame(g)}
                  >
                    {g==='auto'?(id?'Semua':'All'):g==='pokemon'?'Pokémon':'One Piece'}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                {torchAvailable&&<button
                  type="button"
                  className={`card-scan-hud-btn${torchOn?' is-active':''}`}
                  onClick={()=>void toggleTorch()}
                  aria-label={torchOn?(id?'Matikan lampu':'Turn off flashlight'):(id?'Nyalakan lampu':'Turn on flashlight')}
                >
                  <FlashlightIcon size={18} weight={torchOn?'fill':'regular'}/>
                </button>}
                <button
                  type="button"
                  className="card-scan-hud-btn"
                  onClick={()=>close(false)}
                  aria-label={id?'Tutup':'Close'}
                >
                  <XIcon size={18}/>
                </button>
              </div>
            </div>
            <div ref={cameraGuideRef} className="card-scan-camera-guide" aria-hidden="true">
              <div className="card-scan-corner is-top-left"/>
              <div className="card-scan-corner is-top-right"/>
              <div className="card-scan-corner is-bottom-left"/>
              <div className="card-scan-corner is-bottom-right"/>
              <div className="card-scan-beam"/>
            </div>
          </div>
          <p className={`card-scan-camera-status is-${cameraStatus}`} role="status">
            {cameraStatus==='capturing'?(id?'Mengambil foto…':'Capturing photo…'):cameraStatus==='steady'?(id?'Kartu terdeteksi. Tahan sebentar…':'Card aligned. Hold steady…'):(id?'Posisikan kartu di dalam bingkai':'Place card inside the frame')}
          </p>
          <div className="card-scan-source-actions" style={{marginTop:'2px'}}>
            <button
              type="button"
              className="button card-scan-shutter-btn"
              onClick={()=>void capturePhoto(true)}
              disabled={!cameraReady||cameraStatus==='capturing'}
            >
              <CameraIcon size={18} weight="bold"/>
              {id?'Ambil & Pindai':'Capture & Scan'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={()=>uploadInput.current?.click()}
            >
              <ImageSquareIcon size={17}/>
              {id?'Pilih Gambar':'Upload Image'}
            </button>
          </div>
        </section>}

        {candidates.length>0&&activeCandidate&&<section className="card-scan-match-sheet" aria-label={id?'Hasil kartu yang cocok':'Card match result'}>
          <div className="card-scan-match-header">
            <div className="card-scan-match-meta">
              <CheckCircleIcon size={18} weight="fill" color="#10b981"/>
              <strong style={{fontSize:'13px',color:'var(--ink)'}}>{id?'Kartu Terdeteksi':'Card Matched'}</strong>
            </div>
            <span className="card-scan-vision-pill">
              {scanMethod==='vision'?'VivrePlay AI Vision':'PaddleOCR'}
            </span>
          </div>

          <div className="card-scan-card-card">
            <div className="card-scan-sheet-thumb">
              <CardArt card={scanDisplayCard(activeCandidate)}/>
            </div>
            <div className="card-scan-sheet-info">
              <h4 className="card-scan-sheet-title" title={activeCandidate.name}>
                {activeCandidate.name}
              </h4>
              <div className="card-scan-sheet-badges">
                {activeCandidate.setCode&&<span className="card-scan-sheet-badge is-set">{activeCandidate.setCode}</span>}
                {cleanCardNumber(activeCandidate.cardNumber)&&<span className="card-scan-sheet-badge">
                  {cleanCardNumber(activeCandidate.cardNumber).includes('/')
                    ? cleanCardNumber(activeCandidate.cardNumber)
                    : `${cleanCardNumber(activeCandidate.cardNumber)}${activeCandidate.setCardCount?`/${activeCandidate.setCardCount}`:''}`}
                </span>}
                {activeCandidate.rarity&&<span className="card-scan-sheet-badge">{pokemonRarityLabel(activeCandidate.rarity,activeCandidate.language)||activeCandidate.rarity}</span>}
                {activeCandidate.language&&<span className="card-scan-sheet-badge">{activeCandidate.language}</span>}
                {activeCandidate.variant&&scanVariantLabel(activeCandidate.variant)!=='Standard'&&<span className="card-scan-sheet-badge">{scanVariantLabel(activeCandidate.variant)}</span>}
              </div>
            </div>
          </div>

          {candidates.length>1&&<div style={{display:'grid',gap:'6px'}}>
            <p style={{margin:0,fontSize:'11px',color:'var(--muted)',fontWeight:600}}>
              {id?'Pilihan varian/cetakan lain yang cocok:':'Other matching printings:'}
            </p>
            <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'4px'}}>
              {candidates.map((candidate,idx)=>{
                const num=cleanCardNumber(candidate.cardNumber);
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={()=>setSelectedCandidateIndex(idx)}
                    style={{
                      padding:'4px 9px',
                      borderRadius:'6px',
                      border:idx===selectedCandidateIndex?'1.5px solid var(--accent,#f59e0b)':'1px solid var(--line)',
                      background:idx===selectedCandidateIndex?'color-mix(in srgb, var(--accent,#f59e0b) 16%, transparent)':'var(--surface-raised)',
                      fontSize:'11px',
                      fontWeight:650,
                      color:'var(--ink)',
                      cursor:'pointer',
                      whiteSpace:'nowrap',
                    }}
                  >
                    {candidate.setCode}{num?` #${num}`:''}{candidate.rarity?` (${candidate.rarity})`:''}
                  </button>
                );
              })}
            </div>
          </div>}

          <div className="card-scan-sheet-actions">
            <button
              type="button"
              className="card-scan-primary-btn"
              onClick={()=>void select(activeCandidate)}
              disabled={busy}
            >
              <CheckCircleIcon size={17} weight="bold"/>
              {onSelect?(id?'Pilih Kartu Ini':'Select This Card'):(id?'Buka Detail Kartu':'View Card Details')}
            </button>
            <button
              type="button"
              className="card-scan-secondary-btn"
              onClick={resumeScanning}
              disabled={busy}
            >
              <ArrowsCounterClockwiseIcon size={16}/>
              {id?'Pindai Lain':'Scan Next'}
            </button>
          </div>
        </section>}

        {preview&&!candidates.length&&<div className="card-scan-workspace">
          <div
            ref={photoRef}
            className={`card-scan-photo${previewZoom>1?' is-zoomed':''}`}
            onPointerDown={beginPan}
            onPointerMove={event=>{moveCrop(event);movePan(event)}}
            onPointerUp={event=>{finishCropDrag(event);finishPan(event)}}
            onPointerCancel={event=>{finishCropDrag(event);finishPan(event)}}
            style={previewSize?{aspectRatio:`${previewSize.width}/${previewSize.height}`,width:`min(100%, ${Math.min(520,320*previewSize.width/previewSize.height)}px)`}:undefined}
          >
            {preview&&<div className="card-scan-photo-content" style={{left:`calc(50% - ${previewZoom*50}% + ${previewPan.x}px)`,top:`calc(50% - ${previewZoom*50}% + ${previewPan.y}px)`,width:`${previewZoom*100}%`,height:`${previewZoom*100}%`}}>
              <Image src={preview} width={previewSize?.width??440} height={previewSize?.height??235} unoptimized alt={id?'Foto kartu yang dipilih':'Selected card photo'}/>
            </div>}
            {preview&&scanBounds&&<div
              className="card-scan-crop-box"
              onPointerDown={beginCropMove}
              style={{left:`calc(50% + ${(scanBounds.x-.5)*previewZoom*100}% + ${previewPan.x}px)`,top:`calc(50% + ${(scanBounds.y-.5)*previewZoom*100}% + ${previewPan.y}px)`,width:`${scanBounds.width*previewZoom*100}%`,height:`${scanBounds.height*previewZoom*100}%`}}
              aria-label={id?'Batas kartu yang bisa diatur':'Adjustable card outline'}
            >
              {(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner=>(
                <button
                  key={corner}
                  type="button"
                  className={`card-scan-crop-handle is-${corner}`}
                  aria-label={id?`Atur sudut ${corner}`:`Adjust ${corner} corner`}
                  onPointerDown={event=>beginCropDrag(corner,event)}
                  onKeyDown={event=>nudgeCrop(corner,event)}
                />
              ))}
            </div>}
            {!preview&&<CameraIcon size={34} aria-hidden="true"/>}
          </div>
        </div>}

        {preview&&!candidates.length&&<div className="card-scan-crop-tools">
          <span>{id?'Seret sudut atau bingkai untuk memilih area kartu. Perbesar foto lalu geser untuk melihat tulisan kecil.':'Drag a corner or the frame to select the card area. Zoom in, then move the photo to check small print.'}</span>
          <label className="card-scan-zoom">
            <span>{id?'Zoom':'Zoom'}</span>
            <input type="range" min="1" max="5" step=".1" value={previewZoom} onChange={event=>changePreviewZoom(Number(event.target.value))} aria-label={id?'Perbesar pratinjau':'Zoom preview'}/>
            <output>{Math.round(previewZoom*100)}%</output>
          </label>
          <button type="button" className="card-scan-crop-reset" onClick={()=>{setScanBounds(detectedBounds);setPreviewZoom(1);setPreviewPan({x:0,y:0});setRead(undefined);setCandidates([]);setError('')}} disabled={!detectedBounds}>
            {id?'Atur ulang':'Reset view'}
          </button>
        </div>}

        {!cameraActive&&!candidates.length&&<div className="card-scan-source-actions">
          <button type="button" className="button secondary" onClick={()=>{if(useCameraPicker){setError('');cameraInput.current?.click()}else void startCamera()}}>
            <CameraIcon size={17}/>
            {useCameraPicker?(id?'Buka kamera':'Open camera'):(id?'Ambil foto':'Take photo')}
          </button>
          <button type="button" className="button secondary" onClick={()=>uploadInput.current?.click()}>
            <ImageSquareIcon size={17}/>
            {id?'Pilih gambar':'Choose image'}
          </button>
        </div>}

        <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
        <input ref={uploadInput} className="sr-only" type="file" accept="image/*" onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>

        {images.length>0&&!candidates.length&&<button
          type="button"
          className="button card-scan-submit"
          disabled={busy}
          onClick={()=>void identify()}
        >
          {busy?<SpinnerGapIcon size={17} className="card-scan-spinner"/>:<CameraIcon size={17}/>}
          {busy?(id?'Memindai visual kartu dengan AI…':'Scanning card visual with AI…'):(id?'Pindai kartu':'Scan card')}
        </button>}

        {error&&<p className="card-scan-error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
