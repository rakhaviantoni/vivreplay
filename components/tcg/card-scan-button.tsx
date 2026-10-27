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
  InfoIcon,
  SpinnerGapIcon,
  XIcon,
} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {detectCardBounds} from '@/lib/card-scan-detection';
import {CardArt} from '@/components/tcg/card-art';
import type {Card} from '@/packages/card-data/catalog';
import {pokemonRarityLabel} from '@/lib/pokemon-rarity';

export type CardScanCandidate={id:string;game:'pokemon'|'one-piece';code:string;name:string;setCode:string;cardNumber:string;language:string;rarity:string;variant:string;imageUrl:string|null;setCardCount?:string;score?:number;confidence?:number};
type Props={game?:'pokemon'|'one-piece'|'auto';locale?:'EN'|'ID';onSelect?:(card:CardScanCandidate)=>void|Promise<void>;selectionPurpose?:'choose'|'filter';className?:string};
type NormalizedBounds={x:number;y:number;width:number;height:number};

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

async function captureVideoFrameBlob(video:HTMLVideoElement):Promise<Blob|null>{
  const vw=video.videoWidth,vh=video.videoHeight;
  if(!vw||!vh)return null;
  const maxDim=1600;
  const scale=Math.min(1,maxDim/Math.max(vw,vh));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(vw*scale));
  canvas.height=Math.max(1,Math.round(vh*scale));
  const context=canvas.getContext('2d');
  if(!context)return null;
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(video,0,0,canvas.width,canvas.height);

  return new Promise(resolve=>canvas.toBlob(blob=>{
    canvas.width=0;canvas.height=0;
    resolve(blob);
  },'image/jpeg',0.94));
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

export function CardScanButton({game='auto',locale='EN',onSelect,className}:Props){
  const [open,setOpen]=useState(false);
  const [preview,setPreview]=useState<string>();
  const [previewSize,setPreviewSize]=useState<{width:number;height:number}>();
  const [previewZoom,setPreviewZoom]=useState(1);
  const [previewPan,setPreviewPan]=useState({x:0,y:0});
  const [scanBounds,setScanBounds]=useState<NormalizedBounds>();
  const [detectedBounds,setDetectedBounds]=useState<NormalizedBounds>();
  const [cameraActive,setCameraActive]=useState(false);
  const [cameraReady,setCameraReady]=useState(false);
  const [isEvaluating,setIsEvaluating]=useState(false);
  const [unmatchedAttempts,setUnmatchedAttempts]=useState(0);
  const [torchAvailable,setTorchAvailable]=useState(false);
  const [torchOn,setTorchOn]=useState(false);
  const [useCameraPicker,setUseCameraPicker]=useState(false);
  const [sourceFile,setSourceFile]=useState<File>();
  const [candidates,setCandidates]=useState<CardScanCandidate[]>([]);
  const [selectedCandidateIndex,setSelectedCandidateIndex]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const cameraInput=useRef<HTMLInputElement>(null);
  const uploadInput=useRef<HTMLInputElement>(null);
  const photoRef=useRef<HTMLDivElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const cameraStageRef=useRef<HTMLDivElement>(null);
  const cameraGuideRef=useRef<HTMLDivElement>(null);
  const cameraStream=useRef<MediaStream|null>(null);
  const liveScanning=useRef(false);
  const cropDrag=useRef<{pointerId:number;corner:'top-left'|'top-right'|'bottom-left'|'bottom-right'|'move'|null;startX:number;startY:number;startBounds?:NormalizedBounds}>({pointerId:-1,corner:null,startX:0,startY:0});
  const panDrag=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
  const resultTrack=useRef<HTMLDivElement>(null);
  const [resultScroll,setResultScroll]=useState<{left:boolean;right:boolean}>({left:false,right:false});
  const id=locale==='ID';

  const updateResultScroll=useCallback(()=>{
    const el=resultTrack.current;
    if(!el)return;
    setResultScroll({
      left:el.scrollLeft>6,
      right:el.scrollLeft+el.clientWidth<el.scrollWidth-6,
    });
  },[]);

  useEffect(()=>{
    if(candidates.length>1){
      const t=setTimeout(updateResultScroll,60);
      return()=>clearTimeout(t);
    }
  },[candidates.length,updateResultScroll]);

  const stopCamera=()=>{
    if(torchOn)setTorchOn(false);
    setTorchAvailable(false);
    liveScanning.current=false;
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
      setIsEvaluating(false);
      setUnmatchedAttempts(0);
      setPreview(undefined);
      setPreviewSize(undefined);
      setCandidates([]);
      setSelectedCandidateIndex(0);
      setCameraActive(true);
    }catch{
      setUseCameraPicker(true);
      setError(id?'Kamera langsung tidak tersedia. Tekan Buka kamera atau pilih gambar.':'Live camera is unavailable. Open camera or choose an image.');
    }
  };

  const close=(next:boolean)=>{
    setOpen(next);
    if(!next){
      stopCamera();
      setPreview(undefined);
      setPreviewSize(undefined);
      setPreviewZoom(1);
      setPreviewPan({x:0,y:0});
      setScanBounds(undefined);
      setDetectedBounds(undefined);
      setSourceFile(undefined);
      setCandidates([]);
      setSelectedCandidateIndex(0);
      setIsEvaluating(false);
      setUnmatchedAttempts(0);
      setError('');
    }
  };

  const resumeScanning=()=>{
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setError('');
    setIsEvaluating(false);
    setUnmatchedAttempts(0);
    setPreview(undefined);
    setPreviewSize(undefined);
    setPreviewZoom(1);
    setPreviewPan({x:0,y:0});
    setScanBounds(undefined);
    setDetectedBounds(undefined);
    setSourceFile(undefined);
    liveScanning.current=false;
    if(videoRef.current){
      void videoRef.current.play().catch(()=>{});
    }
    if(!cameraActive){
      void startCamera();
    }
  };

  const openScanner=()=>{
    setOpen(true);
    setIsEvaluating(false);
    setUnmatchedAttempts(0);
    setPreview(undefined);
    setScanBounds(undefined);
    setPreviewZoom(1);
    setPreviewPan({x:0,y:0});
    void startCamera();
  };

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

  const finishCropDrag=(event:React.PointerEvent<HTMLElement>)=>{
    if(cropDrag.current.pointerId!==event.pointerId)return;
    cropDrag.current={pointerId:-1,corner:null,startX:0,startY:0};
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
      setCandidates([]);setError('');return;
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
    setCandidates([]);setError('');
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
      if(corner==='top-left'){left=Math.min(right-minimum,Math.max(0,left+deltaX));top=Math.min(bottom-minimum,Math.max(0,top+deltaY))}
      if(corner==='top-right'){right=Math.max(left+minimum,Math.min(1,right+deltaX));top=Math.min(bottom-minimum,Math.max(0,top+deltaY))}
      if(corner==='bottom-left'){left=Math.min(right-minimum,Math.max(0,left+deltaX));bottom=Math.max(top+minimum,Math.min(1,bottom+deltaY))}
      if(corner==='bottom-right'){right=Math.max(left+minimum,Math.min(1,right+deltaX));bottom=Math.max(top+minimum,Math.min(1,bottom+deltaY))}
      return{x:left,y:top,width:right-left,height:bottom-top};
    });
  };

  // Choose file and prepare zoom & crop workspace
  const chooseFile=async(file?:File)=>{
    if(!file)return;
    stopCamera();
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setError('');
    setBusy(true);
    setSourceFile(file);
    setPreviewZoom(1);
    setPreviewPan({x:0,y:0});
    try{
      const {canvas:sourceCanvas,width,height}=await loadSourceCanvas(file);
      try{
        const previewCanvas=document.createElement('canvas');
        const scale=Math.min(1,1080/Math.max(width,height));
        previewCanvas.width=Math.round(width*scale);
        previewCanvas.height=Math.round(height*scale);
        const pctx=previewCanvas.getContext('2d');
        pctx?.drawImage(sourceCanvas,0,0,previewCanvas.width,previewCanvas.height);
        const previewUrl=previewCanvas.toDataURL('image/jpeg',0.90);
        previewCanvas.width=0;previewCanvas.height=0;

        // Auto-detect card boundary in background
        const detectCanvas=document.createElement('canvas');
        detectCanvas.width=160;
        detectCanvas.height=Math.max(1,Math.round(160*height/width));
        const dctx=detectCanvas.getContext('2d');
        dctx?.drawImage(sourceCanvas,0,0,detectCanvas.width,detectCanvas.height);
        const idata=dctx?.getImageData(0,0,detectCanvas.width,detectCanvas.height);
        const rawBounds=idata?detectCardBounds({data:idata.data,width:detectCanvas.width,height:detectCanvas.height}):null;
        detectCanvas.width=0;detectCanvas.height=0;

        const bounds:NormalizedBounds=rawBounds?{
          x:rawBounds.x/160,
          y:rawBounds.y/(160*height/width),
          width:rawBounds.width/160,
          height:rawBounds.height/(160*height/width),
        }:{
          x:0.08,
          y:0.06,
          width:0.84,
          height:0.88,
        };

        setPreview(previewUrl);
        setPreviewSize({width,height});
        setScanBounds(bounds);
        setDetectedBounds(bounds);
      }finally{
        sourceCanvas.width=0;sourceCanvas.height=0;
      }
    }catch{
      setError(id?'Gambar tidak dapat dibuka. Coba JPEG, PNG, atau WebP.':'Could not open that image. Try JPEG, PNG, or WebP.');
    }finally{
      setBusy(false);
    }
  };

  // Search card from cropped photo in workspace
  const searchCroppedCard=async()=>{
    if(!sourceFile||busy)return;
    setBusy(true);
    setError('');
    try{
      const croppedBlob=await getCroppedCardBlob(sourceFile,scanBounds);
      const matches=await scanBlob(croppedBlob,true);
      if(matches&&matches.length>0){
        triggerHaptic([40,50,40]);
        setCandidates(matches);
        setSelectedCandidateIndex(0);
      }else{
        setError(id?'Kartu belum terdeteksi dari foto ini. Coba sesuaikan bingkai atau pilih foto yang lebih tajam.':'No card recognized from this photo. Try adjusting the crop frame or choosing a clearer photo.');
      }
    }catch{
      setError(id?'Gagal memindai gambar. Silakan coba lagi.':'Failed to scan image. Please try again.');
    }finally{
      setBusy(false);
    }
  };

  const scanBlob=async(blob:Blob,isManual=false):Promise<CardScanCandidate[]|null>=>{
    const vpsScannerUrl=process.env.NEXT_PUBLIC_CARD_SCANNER_URL||'https://scan.vivreplay.com';
    const formData=new FormData();
    formData.append('image',blob,'card-scan.jpg');
    if(isManual){
      formData.append('manual','true');
    }
    if(game==='pokemon'||game==='one-piece'){
      formData.append('game',game);
    }
    try{
      const res=await fetch(`${vpsScannerUrl.replace(/\/+$/,'')}/api/scan`,{
        method:'POST',
        body:formData,
        signal:AbortSignal.timeout(4500),
      });
      if(!res.ok)return null;
      const data=await res.json() as {status:string;product?:CardScanCandidate;candidates?:CardScanCandidate[]};
      if(data.status==='match'&&data.product){
        const rawMatches=data.candidates?.length?data.candidates:[data.product];
        return rawMatches.map(c=>({...c,cardNumber:cleanCardNumber(c.cardNumber)}));
      }
    }catch{}
    return null;
  };

  // Immediate manual capture
  const capturePhoto=async()=>{
    if(busy)return;
    const video=videoRef.current;
    if(!video||!video.videoWidth||!video.videoHeight)return;
    setBusy(true);
    setError('');
    triggerHaptic(35);
    try{
      const guideBounds=getCameraGuideBounds();
      const blob=await videoCropBlob(video,guideBounds??{x:0.1,y:0.1,width:0.8,height:0.8},1080);
      if(!blob){
        setError(id?'Foto tidak dapat diambil.':'Could not capture frame.');
        return;
      }
      const matches=await scanBlob(blob,true);
      const topScore=matches?.[0]?.score??0;
      if(matches&&matches.length>0&&topScore>=0.90){
        triggerHaptic([40,50,40]);
        setCandidates(matches);
        setSelectedCandidateIndex(0);
        videoRef.current?.pause();
      }else{
        // If match confidence is ambiguous or no match, transition the captured photo directly into the Zoom & Crop workspace
        stopCamera();
        const file=new File([blob],'camera-capture.jpg',{type:'image/jpeg'});
        await chooseFile(file);
        if(!matches||matches.length===0){
          setError(id?'Sesuaikan bingkai di sekeliling kartu lalu tekan Cari Kartu.':'Adjust the frame around the card and tap Search Card.');
        }
      }
    }catch{
      setError(id?'Gagal memindai kartu. Silakan coba lagi.':'Scan failed. Please try again.');
    }finally{
      setBusy(false);
    }
  };

  // Continuous background live scan loop (non-blocking)
  useEffect(()=>{
    if(!cameraActive||!cameraReady||candidates.length>0)return;
    let mounted=true;
    let timer=0;
    let prevSample:Uint8ClampedArray|null=null;
    let pendingCandidateId:string|null=null;
    let pendingCandidateName:string|null=null;

    const sampleCanvas=document.createElement('canvas');
    sampleCanvas.width=32;
    sampleCanvas.height=45;
    const sampleCtx=sampleCanvas.getContext('2d',{willReadFrequently:true});

    // Settle delay (1200ms) gives the user time to place the card in the frame
    const settleTimer=setTimeout(()=>{
      if(!mounted)return;
      timer=window.setInterval(()=>{
        if(!mounted||liveScanning.current||candidates.length>0||!cameraActive||!videoRef.current||busy)return;
        const v=videoRef.current;
        if(!v.videoWidth||!v.videoHeight||!sampleCtx)return;
        const guideBounds=getCameraGuideBounds();
        if(!guideBounds)return;

        // Check if there is actual content in the guide frame
        const sx=guideBounds.x*v.videoWidth,sy=guideBounds.y*v.videoHeight;
        const sw=guideBounds.width*v.videoWidth,sh=guideBounds.height*v.videoHeight;
        sampleCtx.drawImage(v,sx,sy,sw,sh,0,0,32,45);
        const imgData=sampleCtx.getImageData(0,0,32,45).data;

        let minLuma=255,maxLuma=0;
        let motionDiff=0;
        for(let i=0;i<imgData.length;i+=8){
          const luma=imgData[i]!*0.299+imgData[i+1]!*0.587+imgData[i+2]!*0.114;
          if(luma<minLuma)minLuma=luma;
          if(luma>maxLuma)maxLuma=luma;
          if(prevSample){
            motionDiff+=Math.abs(imgData[i]!-prevSample[i]!);
          }
        }
        prevSample=new Uint8ClampedArray(imgData);

        // Don't scan if guide is pitch dark or completely uniform flat color
        if(maxLuma-minLuma<25||maxLuma<35)return;

        // If card or phone is actively moving, wait for the user to hold it steady
        // Sampled pixels = 1440 / 2 = 720 pixels. Average delta > 16 indicates rapid motion.
        if(motionDiff>720*16)return;

        void(async()=>{
          if(liveScanning.current||candidates.length>0||!mounted)return;
          liveScanning.current=true;
          setIsEvaluating(true);
          try{
            const blob=await videoCropBlob(v,guideBounds,480);
            if(blob&&mounted&&candidates.length===0){
              const matches=await scanBlob(blob,false);
              if(!mounted)return;
              if(matches&&matches.length>0){
                const topMatch=matches[0]!;
                const topScore=topMatch.score??0;
                const isConfirmed=(pendingCandidateId===topMatch.id)||(pendingCandidateName===topMatch.name);

                // Lock immediately on high confidence (>= 0.92) or on consecutive verification
                if(topScore>=0.92||isConfirmed){
                  triggerHaptic([40,50,40]);
                  setCandidates(matches);
                  setSelectedCandidateIndex(0);
                  videoRef.current?.pause();
                  pendingCandidateId=null;
                  pendingCandidateName=null;
                }else{
                  // First detection: stage for consecutive verification on next tick
                  pendingCandidateId=topMatch.id;
                  pendingCandidateName=topMatch.name;
                }
              }else{
                pendingCandidateId=null;
                pendingCandidateName=null;
                setUnmatchedAttempts(prev=>prev+1);
              }
            }
          }catch{}finally{
            if(mounted){
              liveScanning.current=false;
              setIsEvaluating(false);
            }
          }
        })();
      }, 1000);
    }, 1200);

    return()=>{
      mounted=false;
      clearTimeout(settleTimer);
      window.clearInterval(timer);
      sampleCanvas.width=0;
      sampleCanvas.height=0;
    };
  },[cameraActive,cameraReady,candidates.length,busy,game]);

  const select=async(card:CardScanCandidate)=>{
    if(!onSelect){window.location.assign(cardHref(card,locale));return;}
    setBusy(true);setError('');
    try{await onSelect(card);close(false)}catch{setError(id?'Kartu tidak dapat dibuka. Coba lagi.':'Could not open this card. Try again.')}finally{setBusy(false)}
  };

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
      <DialogContent className="card-scan-dialog" overlayClassName="card-scan-overlay">
        <DialogHeader className="card-scan-header">
          <DialogTitle>
            {candidates.length>0?(id?'Kartu Ditemukan':'Card Detected'):(id?'Pindai Kartu TCG':'Scan TCG Card')}
          </DialogTitle>
          <DialogDescription>
            {candidates.length>0
              ?(id?'Kartu berhasil dicocokkan.':'Card matched successfully.')
              :cameraActive
              ?(id?'Posisikan kartu di dalam bingkai panduan.':'Place card inside the guide frame.')
              :preview
              ?(id?'Sesuaikan bingkai dan perbesar gambar jika diperlukan.':'Adjust the frame and zoom if needed.')
              :(id?'Pilih kamera atau gambar kartu.':'Choose camera or card image.')}
          </DialogDescription>
        </DialogHeader>

        {cameraActive&&<section className="card-scan-camera-view">
          <div ref={cameraStageRef} className={`card-scan-camera-stage${candidates.length>0?' is-steady':isEvaluating?' is-evaluating':''}`}>
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
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <span className="card-scan-vision-pill">
                  <CameraIcon size={12} weight="bold"/>
                  {id?'Pemindai':'Scanner'}
                </span>
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

          {candidates.length===0&&<div style={{display:'grid',gap:'4px',justifyItems:'center',margin:'4px 0 2px',minHeight:'22px'}}>
            <p className="card-scan-camera-status" role="status">
              {id?'Posisikan kartu di dalam bingkai':'Align card inside the frame'}
            </p>
            {unmatchedAttempts>=4&&<p className="card-scan-camera-tip">
              <InfoIcon size={14} weight="bold" style={{verticalAlign:'middle',marginRight:'4px'}}/>
              {id?'Posisikan kartu pas di dalam bingkai dan hindari pantulan cahaya':'Fit card inside the frame and avoid glare'}
            </p>}
          </div>}

          {candidates.length===0&&<div className="card-scan-source-actions" style={{marginTop:'2px'}}>
            <button
              type="button"
              className="button card-scan-shutter-btn"
              onClick={()=>void capturePhoto()}
              disabled={!cameraReady||busy}
            >
              {busy?<SpinnerGapIcon size={18} className="card-scan-spinner"/>:<CameraIcon size={18} weight="bold"/>}
              {busy?(id?'Memindai…':'Scanning…'):(id?'Pindai Sekarang':'Scan Now')}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={()=>uploadInput.current?.click()}
              disabled={busy}
            >
              <ImageSquareIcon size={17}/>
              {id?'Pilih Gambar':'Upload Image'}
            </button>
          </div>}
        </section>}

        {candidates.length>0&&activeCandidate&&<section className="card-scan-match-sheet" aria-label={id?'Hasil kartu yang cocok':'Card match result'}>
          <div className="card-scan-match-header">
            <div className="card-scan-match-meta">
              <CheckCircleIcon size={18} weight="fill" color="#10b981"/>
              <strong style={{fontSize:'13px',color:'var(--ink)'}}>{id?'Kartu Ditemukan':'Card Detected'}</strong>
            </div>
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

          {candidates.length>1&&<section className={`card-scan-results${resultScroll.left?' has-left-overflow':''}${resultScroll.right?' has-right-overflow':''}`} aria-label={id?'Pilihan cetakan lain':'Other matching printings'}>
            <header>
              <div className="card-scan-results-title">
                <p>{id?'Pilihan cetakan lain:':'Other matching printings:'}</p>
              </div>
              <div className="card-scan-results-controls">
                <button
                  type="button"
                  aria-label={id?'Geser ke kiri':'Scroll left'}
                  disabled={!resultScroll.left}
                  onClick={()=>resultTrack.current?.scrollBy({left:-240,behavior:'smooth'})}
                >
                  <CaretLeftIcon size={16}/>
                </button>
                <button
                  type="button"
                  aria-label={id?'Geser ke kanan':'Scroll right'}
                  disabled={!resultScroll.right}
                  onClick={()=>resultTrack.current?.scrollBy({left:240,behavior:'smooth'})}
                >
                  <CaretRightIcon size={16}/>
                </button>
              </div>
            </header>
            <div ref={resultTrack} role="region" className="card-scan-results-track" onScroll={updateResultScroll}>
              {candidates.map((card,idx)=>{
                const cleanNumber=cleanCardNumber(card.cardNumber);
                const isSelected=idx===selectedCandidateIndex;
                return (
                  <button
                    type="button"
                    key={card.id}
                    disabled={busy}
                    onClick={()=>setSelectedCandidateIndex(idx)}
                    className={`card-scan-result${card.game==='pokemon'?' pokemon-card-tile':' catalog-card'}${isSelected?' is-selected':''}`}
                    style={isSelected?{outline:'2px solid var(--accent,#f59e0b)',outlineOffset:'2px',borderRadius:'8px'}:undefined}
                  >
                    {card.game==='pokemon'?<CardArt card={scanDisplayCard(card)}/>:<span className="card-stage"><CardArt card={scanDisplayCard(card)}/></span>}
                    {card.game==='pokemon'?(
                      <span className="pokemon-card-caption">
                        <strong>{card.name}</strong>
                        <span className="pokemon-card-meta-row">
                          <small className="pokemon-card-set-badge">{card.setCode.toLowerCase()}</small>
                          {cleanNumber&&<small className="pokemon-card-number">{cleanNumber.includes('/')?cleanNumber:`${cleanNumber}${card.setCardCount?`/${card.setCardCount}`:''}`}</small>}
                          {card.rarity&&<small className="pokemon-card-rarity">{pokemonRarityLabel(card.rarity,card.language)||card.rarity}</small>}
                        </span>
                      </span>
                    ):(
                      <>
                        <span className="card-meta">
                          <span><b>{card.setCode}</b>{cleanNumber&&<small>{cleanNumber}</small>}<small>{card.language}</small></span>
                          {card.rarity&&<span className={`rarity rarity-${card.rarity}`}>{card.rarity}</span>}
                        </span>
                        <span className="card-title"><h3>{card.name}</h3></span>
                        <small className="card-scan-printing-variant">{scanVariantLabel(card.variant)||'Standard'}</small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>}

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

        {preview&&!cameraActive&&!candidates.length&&<div className="card-scan-workspace">
          <div
            ref={photoRef}
            className={`card-scan-photo${previewZoom>1?' is-zoomed':''}`}
            onPointerDown={beginPan}
            onPointerMove={event=>{moveCrop(event);movePan(event)}}
            onPointerUp={event=>{finishCropDrag(event);finishPan(event)}}
            onPointerCancel={event=>{finishCropDrag(event);finishPan(event)}}
            style={previewSize?{aspectRatio:`${previewSize.width}/${previewSize.height}`,width:`min(100%, ${Math.min(520,320*previewSize.width/previewSize.height)}px)`}:undefined}
          >
            <div className="card-scan-photo-content" style={{left:`calc(50% - ${previewZoom*50}% + ${previewPan.x}px)`,top:`calc(50% - ${previewZoom*50}% + ${previewPan.y}px)`,width:`${previewZoom*100}%`,height:`${previewZoom*100}%`}}>
              <Image src={preview} width={previewSize?.width??440} height={previewSize?.height??314} unoptimized alt={id?'Foto kartu yang dipilih':'Selected card photo'}/>
            </div>
            {scanBounds&&<div
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
          </div>
        </div>}

        {preview&&!cameraActive&&!candidates.length&&<div className="card-scan-crop-tools">
          <span>{id?'Seret sudut atau bingkai untuk memilih area kartu. Perbesar foto lalu geser untuk memfokuskan kartu.':'Drag a corner or the frame to select the card area. Zoom in and pan to focus the card.'}</span>
          <label className="card-scan-zoom">
            <span>Zoom</span>
            <input type="range" min="1" max="5" step=".1" value={previewZoom} onChange={event=>changePreviewZoom(Number(event.target.value))} aria-label={id?'Perbesar pratinjau':'Zoom preview'}/>
            <output>{Math.round(previewZoom*100)}%</output>
          </label>
          <button type="button" className="card-scan-crop-reset" onClick={()=>{setScanBounds(detectedBounds);setPreviewZoom(1);setPreviewPan({x:0,y:0});setCandidates([]);setError('')}} disabled={!detectedBounds}>
            {id?'Atur ulang':'Reset view'}
          </button>
        </div>}

        {preview&&!cameraActive&&!candidates.length&&<button
          type="button"
          className="button card-scan-submit"
          disabled={busy}
          onClick={()=>void searchCroppedCard()}
        >
          {busy?<SpinnerGapIcon size={18} className="card-scan-spinner"/>:<CameraIcon size={18} weight="bold"/>}
          {busy?(id?'Mencari kartu…':'Searching card…'):(id?'Cari Kartu':'Search Card')}
        </button>}

        {!cameraActive&&!candidates.length&&<div className="card-scan-source-actions">
          <button type="button" className="button secondary" onClick={()=>{setPreview(undefined);setScanBounds(undefined);if(useCameraPicker){setError('');cameraInput.current?.click()}else void startCamera()}}>
            <CameraIcon size={17}/>
            {id?'Buka Kamera':'Open Camera'}
          </button>
          <button type="button" className="button secondary" onClick={()=>uploadInput.current?.click()}>
            <ImageSquareIcon size={17}/>
            {preview?(id?'Ganti Gambar':'Change Image'):(id?'Pilih Gambar':'Choose Image')}
          </button>
        </div>}

        <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{void chooseFile(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
        <input ref={uploadInput} className="sr-only" type="file" accept="image/*" onChange={event=>{void chooseFile(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>

        {error&&<p className="card-scan-error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
