import {withRequestLocale} from '@/lib/with-request-locale';
import {Profile} from '@/components/tcg/profile';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Profile','Your player profile settings are private.');
function Page(){return <Profile/>}

export default withRequestLocale(Page);
