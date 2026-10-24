import {withRequestLocale} from '@/lib/with-request-locale';
import {PlayTutorial} from '@/components/tcg/play-tutorial';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Practice table','Direct practice-table links are not indexed.');
function Page(){return <PlayTutorial/>}

export default withRequestLocale(Page);
