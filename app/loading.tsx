import {headers} from 'next/headers';
import {VivreMark} from '@/components/tcg/brand-assets';

export default async function Loading(){
  const requestHeaders=await headers();
  const isIndonesian=requestHeaders.get('x-locale')==='ID'||requestHeaders.get('x-middleware-rewrite')?.startsWith('/id');
  const label=isIndonesian?'Memuat halaman':'Loading page';
  return <main className="route-loading-page" aria-busy="true" aria-label={label}>
    <div className="route-loading-brand" role="status">
      <VivreMark size={34}/>
      <span>{label}</span>
      <i aria-hidden="true"/>
    </div>
  </main>;
}
