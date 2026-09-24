'use client';

import {useEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import gsap from 'gsap';
import {CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight} from '@phosphor-icons/react';

export type DepthCarouselItem={id:string;label:string;content:ReactNode;onSelect:()=>void};

export function DepthCarousel({items,label,className=''}:{items:DepthCarouselItem[];label:string;className?:string}){
  const [active,setActive]=useState(0);
  const [dragging,setDragging]=useState(false);
  const cards=useRef<Array<HTMLButtonElement|null>>([]);
  const root=useRef<HTMLElement>(null);
  const pointerStart=useRef<number|null>(null);
  const dragged=useRef(false);
  const move=(next:number)=>setActive((next+items.length)%items.length);

  useEffect(()=>{const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;cards.current.forEach((card,index)=>{if(!card)return;let distance=(index-active+items.length)%items.length;if(distance>items.length/2)distance-=items.length;const behind=Math.abs(distance);gsap.to(card,{xPercent:-50,yPercent:-50,x:distance*44,y:behind*8,z:-behind*135,rotateY:distance*8,scale:1-behind*.07,opacity:Math.abs(distance)>3?0:1,filter:`brightness(${1-behind*.14}) blur(${behind}px)`,zIndex:100-behind,duration:reduce?0:.42,ease:'power3.out'});});},[active,items.length]);

  const startDrag=(event:PointerEvent<HTMLElement>)=>{if(event.pointerType==='mouse'&&event.button!==0)return;pointerStart.current=event.clientX;dragged.current=false;setDragging(true);event.currentTarget.setPointerCapture?.(event.pointerId)};
  const trackDrag=(event:PointerEvent<HTMLElement>)=>{if(pointerStart.current===null)return;if(Math.abs(event.clientX-pointerStart.current)>7)dragged.current=true};
  const endDrag=(event:PointerEvent<HTMLElement>)=>{const start=pointerStart.current;pointerStart.current=null;setDragging(false);if(start===null)return;const delta=event.clientX-start;if(Math.abs(delta)>=36)move(delta<0?active+1:active-1)};
  const cancelDrag=()=>{pointerStart.current=null;setDragging(false)};

  if(!items.length)return null;
  return <section ref={root} className={`depth-carousel ${className} ${dragging?'is-dragging':''}`} aria-label={label} onKeyDown={event=>{if(event.key==='ArrowLeft')move(active-1);if(event.key==='ArrowRight')move(active+1)}} onPointerDown={startDrag} onPointerMove={trackDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}><div className="depth-stage">{items.map((item,index)=><button ref={node=>{cards.current[index]=node}} key={item.id} type="button" className="depth-card" aria-current={index===active?'true':undefined} aria-label={item.label} onClick={()=>{if(dragged.current){dragged.current=false;return}if(index===active)item.onSelect();else setActive(index)}}>{item.content}</button>)}</div><div className="depth-controls" aria-label="Carousel controls" onPointerDown={event=>event.stopPropagation()}><button type="button" aria-label="Previous card" onClick={event=>{event.stopPropagation();move(active-1)}}><ChevronLeft size={15}/></button><button type="button" aria-label="Next card" onClick={event=>{event.stopPropagation();move(active+1)}}><ChevronRight size={15}/></button></div></section>;
}
