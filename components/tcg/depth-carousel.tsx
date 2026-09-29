'use client';

import {useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import gsap from 'gsap';
import {CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight} from '@phosphor-icons/react';

export type DepthCarouselItem={id:string;label:string;content:ReactNode;onSelect:()=>void};

export function DepthCarousel({items,label,className=''}:{items:DepthCarouselItem[];label:string;className?:string}){
  const [active,setActive]=useState(0);
  const [dragging,setDragging]=useState(false);
  const cards=useRef<Array<HTMLButtonElement|null>>([]);
  const root=useRef<HTMLElement>(null);
  const pointerStart=useRef<number|null>(null);
  const lastDelta=useRef(0);
  const dragged=useRef(false);

  const move=useCallback((next:number)=>{
    setActive((next+items.length)%items.length);
  },[items.length]);

  const updateCardPositions=useCallback((activeIdx:number,dragOffsetPx=0,isLive=false)=>{
    const total=items.length;
    if(!total)return;
    const reduce=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 140px drag roughly corresponds to 1 card distance in 3D stack
    const offsetNorm=dragOffsetPx/140;

    cards.current.forEach((card,index)=>{
      if(!card)return;
      let distance=(index-activeIdx+total)%total;
      if(distance>total/2)distance-=total;

      const visualDistance=distance+offsetNorm;
      const behind=Math.abs(visualDistance);

      gsap.to(card,{
        xPercent:-50,
        yPercent:-50,
        x:visualDistance*44,
        y:behind*8,
        z:-behind*135,
        rotateY:visualDistance*8,
        scale:Math.max(0.65,1-behind*0.07),
        opacity:behind>3.2?0:1,
        filter:`brightness(${Math.max(0.4,1-behind*0.14)}) blur(${Math.min(behind*1.2,5)}px)`,
        zIndex:Math.round(100-behind*10),
        duration:reduce?0:isLive?0.08:0.42,
        ease:isLive?'power1.out':'power3.out',
        overwrite:isLive?'auto':true,
      });
    });
  },[items.length]);

  useEffect(()=>{
    updateCardPositions(active,0,false);
  },[active,updateCardPositions]);

  const startDrag=(event:PointerEvent<HTMLElement>)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointerStart.current=event.clientX;
    lastDelta.current=0;
    dragged.current=false;
    setDragging(true);
    try{
      event.currentTarget.setPointerCapture(event.pointerId);
    }catch{}
  };

  const trackDrag=(event:PointerEvent<HTMLElement>)=>{
    if(pointerStart.current===null)return;
    const delta=event.clientX-pointerStart.current;
    lastDelta.current=delta;
    if(Math.abs(delta)>5){
      dragged.current=true;
    }
    updateCardPositions(active,delta,true);
  };

  const endDrag=(event:PointerEvent<HTMLElement>)=>{
    if(pointerStart.current===null)return;
    const start=pointerStart.current;
    pointerStart.current=null;
    setDragging(false);
    try{
      if(event.currentTarget.hasPointerCapture(event.pointerId)){
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }catch{}

    const delta=event.clientX-start;
    if(Math.abs(delta)>=36){
      move(delta<0?active+1:active-1);
    }else{
      updateCardPositions(active,0,false);
    }

    setTimeout(()=>{
      dragged.current=false;
    },60);
  };

  const cancelDrag=(event:PointerEvent<HTMLElement>)=>{
    pointerStart.current=null;
    setDragging(false);
    try{
      if(event.currentTarget.hasPointerCapture(event.pointerId)){
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }catch{}
    updateCardPositions(active,0,false);
    setTimeout(()=>{
      dragged.current=false;
    },60);
  };

  if(!items.length)return null;

  return (
    <section
      ref={root}
      className={`depth-carousel ${className} ${dragging?'is-dragging':''}`}
      aria-label={label}
      onKeyDown={event=>{
        if(event.key==='ArrowLeft')move(active-1);
        if(event.key==='ArrowRight')move(active+1);
      }}
      onPointerDown={startDrag}
      onPointerMove={trackDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onDragStart={e=>e.preventDefault()}
    >
      <div className="depth-stage" onDragStart={e=>e.preventDefault()}>
        {items.map((item,index)=>(
          <button
            ref={node=>{cards.current[index]=node}}
            key={item.id}
            type="button"
            className="depth-card"
            aria-current={index===active?'true':undefined}
            aria-label={item.label}
            onClick={()=>{
              if(dragged.current){
                return;
              }
              if(index===active)item.onSelect();
              else move(index);
            }}
          >
            {item.content}
          </button>
        ))}
      </div>
      <div className="depth-controls" aria-label="Carousel controls" onPointerDown={event=>event.stopPropagation()}>
        <button
          type="button"
          aria-label="Previous card"
          onClick={event=>{
            event.stopPropagation();
            move(active-1);
          }}
        >
          <ChevronLeft size={15}/>
        </button>
        <button
          type="button"
          aria-label="Next card"
          onClick={event=>{
            event.stopPropagation();
            move(active+1);
          }}
        >
          <ChevronRight size={15}/>
        </button>
      </div>
    </section>
  );
}
