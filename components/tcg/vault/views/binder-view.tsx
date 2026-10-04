'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  StarIcon as Star,
  PlusIcon as Plus,
} from '@phosphor-icons/react';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney } from '@/packages/domain';
import type { EnrichedCollectionItem } from '../types';
import { CardArt } from '../card-art';
import { CardStackControls } from './card-stack-controls';
import { groupVaultStacks } from '../vault-utils';

interface BinderViewProps {
  items: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onAddNewCard: () => void;
  onSaved: () => Promise<void> | void;
  isAnonymous: boolean;
  savedOrder: string[];
  onOrderChange: (order: string[]) => void;
  gridSizeStorageKey: string;
}

export function BinderView({
  items,
  hideValues,
  onSelectItem,
  onToggleFavorite,
  onAddNewCard,
  onSaved,
  isAnonymous,
  savedOrder,
  onOrderChange,
  gridSizeStorageKey,
}: BinderViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [gridColumns, setGridColumns] = useState<2|3|4>(3);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const draggedId = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const previousRects = useRef(new Map<string, DOMRect>());
  useEffect(()=>{
    try{const saved=Number(window.localStorage.getItem(gridSizeStorageKey));if(saved===2||saved===3||saved===4)setGridColumns(saved);}catch{}
  },[gridSizeStorageKey]);
  const visibleColumns=gridColumns;
  const pageSize = visibleColumns * 3;
  const stacks=useMemo(()=>{
    const grouped=groupVaultStacks(items);
    if(!savedOrder.length)return grouped;
    const rank=new Map(savedOrder.map((id,index)=>[id,index]));
    return grouped.sort((a,b)=>(rank.get(a.item.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.item.id)??Number.MAX_SAFE_INTEGER));
  },[items,savedOrder]);
  const totalPages = Math.max(1, Math.ceil(stacks.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages - 1);

  const startIdx = validCurrentPage * pageSize;
  const pageItems = stacks.slice(startIdx, startIdx + pageSize);

  useLayoutEffect(()=>{
    const nextRects=new Map<string,DOMRect>();
    gridRef.current?.querySelectorAll<HTMLElement>('[data-binder-item-id]').forEach(node=>{
      const id=node.dataset.binderItemId;
      if(!id)return;
      const rect=node.getBoundingClientRect();
      nextRects.set(id,rect);
      const previous=previousRects.current.get(id);
      if(previous&&(previous.left!==rect.left||previous.top!==rect.top)){
        node.animate([
          {transform:`translate(${previous.left-rect.left}px, ${previous.top-rect.top}px)`},
          {transform:'translate(0, 0)'},
        ],{duration:220,easing:'cubic-bezier(.2,.75,.25,1)'});
      }
    });
    previousRects.current=nextRects;
  },[pageItems]);

  const reorder=(sourceId:string,targetId:string)=>{
    if(sourceId===targetId)return;
    const next=stacks.map(stack=>stack.item.id);
    const from=next.indexOf(sourceId),to=next.indexOf(targetId);
    if(from<0||to<0)return;
    next.splice(to,0,next.splice(from,1)[0]);
    onOrderChange(next);
  };
  const changeGridColumns=(columns:2|3|4)=>{
    setGridColumns(columns);
    try{window.localStorage.setItem(gridSizeStorageKey,String(columns));}catch{}
    setCurrentPage(0);
  };

  // Keep three rows per page at every selected grid density.
  const remainingSlots = Math.max(0, pageSize - pageItems.length);

  return (
    <div className="vault-binder-container">
      {/* Binder Page Archival Header */}
      <div className="vault-binder-page-header">
        <div className="vault-binder-page-title">
          <span>Digital Binder Archive</span>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
          <span>{stacks.length} cards catalogued · drag to reorder</span>
        </div>

        {/* Page Turnover Pagination */}
        <div className="vault-binder-tools">
          <div className="vault-binder-grid-size" role="group" aria-label="Binder grid size">
            {[2,3,4].map(columns=><button type="button" key={columns} aria-pressed={gridColumns===columns} aria-label={`${columns} columns per row`} title={`${columns} columns per row`} className={gridColumns===columns?'is-selected':''} onClick={()=>changeGridColumns(columns as 2|3|4)}>{columns}</button>)}
          </div>
          <div className="vault-binder-pagination">
            <button
              type="button"
              disabled={validCurrentPage === 0}
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              aria-label="Previous binder page"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {validCurrentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={validCurrentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              aria-label="Next binder page"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Binder card grid */}
      <div className="vault-binder-grid" ref={gridRef} style={{gridTemplateColumns:`repeat(${visibleColumns}, minmax(0, 1fr))`}}>
        {pageItems.map(stack => {
          const item=stack.item;
          const printing = printings.find(p => p.id === item.printingId);
          const lang = stack.languageLabel || item.language || item.card.language || printing?.language || 'EN';
          const isGraded = item.type === 'GRADED';
          const isFavorite=stack.items.some(copy=>copy.isFavorite);

          return (
            <div
              key={item.id}
              data-binder-item-id={item.id}
              draggable
              className={`vault-slot ${draggingId===item.id?'is-reordering':''} ${dropTargetId===item.id?'is-drop-target':''}`}
              onDragStart={event=>{if((event.target as HTMLElement).closest('button')){event.preventDefault();return;}draggedId.current=item.id;setDraggingId(item.id);setDropTargetId(null);suppressClick.current=true;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id);}}
              onDragEnd={()=>{draggedId.current=null;setDraggingId(null);setDropTargetId(null);window.setTimeout(()=>{suppressClick.current=false;},0);}}
              onDragOver={event=>{if(!draggedId.current)return;event.preventDefault();event.dataTransfer.dropEffect='move';setDropTargetId(item.id);}}
              onDragEnter={event=>{if(draggedId.current&&draggedId.current!==item.id){event.preventDefault();setDropTargetId(item.id);}}}
              onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDropTargetId(null);}}
              onDrop={event=>{event.preventDefault();const source=event.dataTransfer.getData('text/plain')||draggedId.current;if(source)reorder(source,item.id);draggedId.current=null;setDraggingId(null);setDropTargetId(null);}}
              onClick={() => {if(suppressClick.current){suppressClick.current=false;return;}onSelectItem(item)}}
              role="button"
              tabIndex={0}
              aria-label={`${item.card.name}, ${lang}. Drag to reorder; press Alt and an arrow key to move.`}
              onKeyDown={e => { if(e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const index=stacks.findIndex(stack=>stack.item.id===item.id);const delta=e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1;const target=stacks[index+delta];if(target)reorder(item.id,target.item.id);}else if (e.key === 'Enter') onSelectItem(item); }}
            >
              {/* Card Art Stage with depth and soft shadow */}
              <div className="vault-slot-card-stage">
                <CardArt card={item.card} />

                {/* Badges Overlay */}
                <div className="vault-slot-badges-top">
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span className="vault-badge-qty">
                      {isGraded ? 'SLAB' : `x${stack.quantity}`}
                    </span>
                    <span className="vault-badge-lang">{lang}</span>
                  </div>

                  <button
                    type="button"
                    className={`vault-favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
                    onClick={e => {const pinned=stack.items.filter(copy=>copy.isFavorite);for(const copy of (pinned.length?pinned:[item]))onToggleFavorite(copy.id,e)}}
                    aria-label={isFavorite ? 'Remove from showcase' : 'Add to showcase'}
                    title={isFavorite ? 'In Showcase (Top cards)' : 'Pin to Showcase'}
                  >
                    <Star size={13} weight={isFavorite ? 'fill' : 'regular'} />
                  </button>
                </div>

                {/* Grade or Condition pill on bottom of card */}
                <div className="vault-slot-badge-bottom">
                  {isGraded ? (
                    <span className="vault-grade-pill">
                      <b>{item.provider || 'PSA'}</b> {item.grade || '10'}
                    </span>
                  ) : (
                    <span className="vault-raw-pill">
                      {stack.conditionLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Slot Meta Information */}
              <div className="vault-slot-info">
                <h4 className="vault-slot-name">{item.card.name}</h4>
                <div className="vault-slot-meta-row">
                  <span>{item.card.code} · {stack.printingLabel}</span>
                  {!hideValues && (
                    <span className="vault-slot-value">
                    {stack.item.hasMarketEstimate ? formatCompactMoney(stack.estimatedValue, 'IDR') : '—'}
                    </span>
                  )}
                </div>
                <CardStackControls item={item} stackItems={stack.items} quantity={stack.quantity} isAnonymous={isAnonymous} onSaved={onSaved} />
              </div>
            </div>
          );
        })}

        {/* Faint Empty Placeholder Slots to complete the binder page */}
        {Array.from({ length: remainingSlots }).map((_, index) => (
          <div
            key={`empty-slot-${index}`}
            className="vault-slot-empty"
            onClick={onAddNewCard}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onAddNewCard(); }}
            title="Empty binder pocket · Click to add card"
          >
            <Plus size={22} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Empty Pocket</span>
          </div>
        ))}
      </div>
    </div>
  );
}
