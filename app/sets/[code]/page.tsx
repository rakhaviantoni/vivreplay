import {SetDetail} from '@/components/tcg/set-detail';
export async function generateMetadata({params}:{params:Promise<{code:string}>}){const {code}=await params;return {title:code,alternates:{canonical:`/sets/${code}`}};}
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <SetDetail code={code}/>;}
