export type CaptionVariables = {
  title: string;
  price: string;
  condition: string;
  seller: string;
  city: string;
  link: string;
  game?: string;
  couriers?: string;
  hashtags?: string;
};

export type SavedCaptionTemplate = {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
};

export const DEFAULT_CAPTION_TEMPLATES: Array<{
  id: string;
  name: { EN: string; ID: string };
  body: string;
}> = [
  {
    id: 'consign-drop',
    name: {
      EN: 'TCG Consignment Drop',
      ID: 'Format Consign Instagram',
    },
    body: `[WTS / FOR SALE] 🔥
🃏 {{title}}
✨ Condition: {{condition}}
💰 Price: {{price}}
📍 Location: {{city}} ({{seller}})
📦 Delivery: {{couriers}}

🛒 Rekber / Checkout langsung via VivrePlay Market:
🔗 {{link}}

{{hashtags}}`,
  },
  {
    id: 'story-drop',
    name: {
      EN: 'Story / Quick Drop',
      ID: 'Drop Singkat / Story',
    },
    body: `AVAILABLE NOW! ⚡
{{title}} ({{condition}})
💵 {{price}}

Langsung tap link di bio / swipe up untuk lock via rekber VivrePlay:
{{link}}`,
  },
  {
    id: 'detailed-collector',
    name: {
      EN: 'Detailed Collector Spec',
      ID: 'Detail Lengkap Kolektor',
    },
    body: `DROP HARI INI 📦
Nama Kartu: {{title}}
Kondisi Fisik: {{condition}}
Harga: {{price}}
Dikirim Dari: {{city}}
Kurir: {{couriers}}

✅ 100% Original Authentic Card
✅ Transaksi aman rekber escrow VivrePlay Market
✅ Packing aman toploader + bubble wrap tebal

Kunjungi listing resmi:
{{link}}

#VivrePlay #VivrePlayMarket {{hashtags}}`,
  },
];

export function getRecommendedHashtags(gameSlug?: string): string {
  if (gameSlug === 'pokemon') {
    return '#PokemonTCG #PokemonCards #PokemonIndonesia #JualKartuPokemon #PokemonCardGame #TCGIndonesia';
  }
  return '#OnePieceCardGame #OnePieceTCG #OPCG #JualKartuOnePiece #OPCGIndo #TCGIndonesia';
}

export function renderCaptionTemplate(template: string, vars: CaptionVariables): string {
  let output = template;
  output = output.replace(/\{\{\s*title\s*\}\}/gi, vars.title || '');
  output = output.replace(/\{\{\s*price\s*\}\}/gi, vars.price || '');
  output = output.replace(/\{\{\s*condition\s*\}\}/gi, vars.condition || '');
  output = output.replace(/\{\{\s*seller\s*\}\}/gi, vars.seller || '');
  output = output.replace(/\{\{\s*city\s*\}\}/gi, vars.city || '');
  output = output.replace(/\{\{\s*link\s*\}\}/gi, vars.link || '');
  output = output.replace(/\{\{\s*game\s*\}\}/gi, vars.game || '');
  output = output.replace(/\{\{\s*couriers\s*\}\}/gi, vars.couriers || 'J&T / JNE / Lion Parcel');
  output = output.replace(
    /\{\{\s*hashtags\s*\}\}/gi,
    vars.hashtags || getRecommendedHashtags(vars.game)
  );
  return output.trim();
}
