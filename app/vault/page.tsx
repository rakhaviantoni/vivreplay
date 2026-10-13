import {Vault} from '@/components/tcg/vault';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Vault','Your collection vault is private.');
export default function Page(){return <Vault/>}
