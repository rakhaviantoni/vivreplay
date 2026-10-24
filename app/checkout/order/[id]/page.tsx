import {withRequestLocale} from '@/lib/with-request-locale';
import {CheckoutOrder} from '@/components/tcg/checkout-order';
export const metadata={title:'Payment checkout'};
function CheckoutOrderPage(){return <CheckoutOrder/>;}

export default withRequestLocale(CheckoutOrderPage);
