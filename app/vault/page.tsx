import {withRequestLocale} from '@/lib/with-request-locale';
import {Vault} from '@/components/tcg/vault';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Vault','Your collection vault is private.');
function Page(){return <Vault/>}

export default withRequestLocale(Page);
