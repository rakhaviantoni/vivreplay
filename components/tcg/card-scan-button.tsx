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

function videoCropBlob(video:HTMLVideoElement,bounds:NormalizedBounds,maxWidth:number):Promise<Blob|null>{
  const x=bounds.x*video.videoWidth,y=bounds.y*video.videoHeight,width=bounds.width*video.videoWidth,height=bounds.height*video.videoHeight;
  const scale=Math.min(1,maxWidth/width);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');
  if(!context)return Promise.resolve(null);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='medium';
  context.drawImage(video,x,y,width,height,0,0,canvas.width,canvas.height);
  return new Promise(resolve=>canvas.toBlob(blob=>{
    canvas.width=0;canvas.height=0;
    resolve(blob);
  },'image/jpeg',.85));
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
  const videoRef=useRef<HTMLVideoElement>(null);
  const cameraStageRef=useRef<HTMLDivElement>(null);
  const cameraGuideRef=useRef<HTMLDivElement>(null);
  const cameraStream=useRef<MediaStream|null>(null);
  const liveScanning=useRef(false);
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
    void startCamera();
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
      const blob=await videoCropBlob(video,guideBounds??{x:0.1,y:0.1,width:0.8,height:0.8},720);
      if(!blob){
        setError(id?'Foto tidak dapat diambil.':'Could not capture frame.');
        return;
      }
      const matches=await scanBlob(blob,true);
      if(matches&&matches.length>0){
        triggerHaptic([40,50,40]);
        setCandidates(matches);
        setSelectedCandidateIndex(0);
        videoRef.current?.pause();
      }else{
        setError(id?'Kartu belum terdeteksi. Posisikan seluruh kartu di dalam bingkai dan pastikan tidak silau.':'No card recognized. Keep the whole card inside the frame and avoid glare.');
      }
    }catch{
      setError(id?'Gagal memindai kartu. Silakan coba lagi.':'Scan failed. Please try again.');
    }finally{
      setBusy(false);
    }
  };

  // File upload fallback
  const chooseFile=async(file?:File)=>{
    if(!file)return;
    stopCamera();
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setError('');
    setBusy(true);
    setSourceFile(file);
    try{
      const croppedBlob=await getCroppedCardBlob(file);
      const matches=await scanBlob(croppedBlob,true);
      if(matches&&matches.length>0){
        triggerHaptic([40,50,40]);
        setCandidates(matches);
        setSelectedCandidateIndex(0);
      }else{
        setError(id?'Kartu belum terdeteksi dari foto ini. Coba foto yang lebih tajam.':'No card recognized from this photo. Try a clearer photo.');
      }
    }catch{
      setError(id?'Gambar tidak dapat dibuka atau dipindai.':'Could not scan that image.');
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

        <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>{void chooseFile(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
        <input ref={uploadInput} className="sr-only" type="file" accept="image/*" onChange={event=>{void chooseFile(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>

        {error&&<p className="card-scan-error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
