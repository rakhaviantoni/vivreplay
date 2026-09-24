import {LiveCardDetail} from '@/components/tcg/live-card-detail';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;return {title:code,alternates:{canonical:`/cards/${code}`}};}
export default async function Page({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{lang?:string}>}){const {code}=await params;const {lang}=await searchParams;return <LiveCardDetail code={code} initialLanguage={lang==='JP'?'JP':'EN'}/>}
