export function CardGridLoading({label,count=10}:{label:string;count?:number}){
  return <div className="catalog-loading route-card-loading" role="status" aria-label={label}>
    <div className="catalog-skeleton-grid" aria-hidden="true">
      {Array.from({length:count},(_,index)=><i key={index}/>) }
    </div>
    <span className="sr-only">{label}</span>
  </div>;
}
