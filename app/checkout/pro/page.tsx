import {withRequestLocale} from '@/lib/with-request-locale';
import {ProCheckout} from '@/components/tcg/pro-checkout';
export const metadata={title:'VivrePlay Pro checkout'};
function ProCheckoutPage(){return <ProCheckout/>;}

export default withRequestLocale(ProCheckoutPage);
