export function CardLoadingSkeleton({count=3,className=''}:{count?:number;className?:string}) {
  return <div className={`card-loading-skeleton-list ${className}`} aria-hidden="true">{Array.from({length:count},(_,index)=><div className="card-loading-skeleton-row" key={index}><span className="hero-card-skeletons card-loading-skeleton-art"><i/><i/></span><span className="card-loading-skeleton-copy"><i/><i/></span></div>)}</div>;
}
