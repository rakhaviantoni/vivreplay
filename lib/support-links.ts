const WHATSAPP_NUMBER='6287892660993';
export const DEFAULT_SUPPORT_MESSAGE='Hi VivrePlay support, I need help with: ';

export function whatsappSupportUrl(message=DEFAULT_SUPPORT_MESSAGE){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
