import {withRequestLocale} from '@/lib/with-request-locale';
import {ArenaTutorialIndex} from '@/components/tcg/arena-lobby';
import {PlayTutorial} from '@/components/tcg/play-tutorial';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Arena tutorial',description:'Learn the One Piece Card Game table, zones, and turn flow through interactive lessons.',path:'/play/tutorial'});}

async function Page({
  searchParams,
}: {
  searchParams?: Promise<{step?: string; play?: string}>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params.step !== undefined || params.play === '1' || params.play === 'true') {
    const stepNum = params.step ? parseInt(params.step, 10) : 0;
    return <PlayTutorial initialStep={isNaN(stepNum) ? 0 : Math.max(0, Math.min(11, stepNum))} />;
  }
  return <ArenaTutorialIndex />;
}

export default withRequestLocale(Page);
