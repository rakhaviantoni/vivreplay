export type SocialAssetFormat = 'square' | 'story' | 'banner' | 'og';
export type SocialAssetTheme = 'dark' | 'light';
export type SocialAssetLocale = 'EN' | 'ID';
export type SocialAssetTemplateId =
  | 'launch'
  | 'market'
  | 'scanner'
  | 'auctions'
  | 'pro'
  | 'arena';

export type SocialPlatformKey =
  | 'instagram'
  | 'threads'
  | 'twitter'
  | 'tiktok'
  | 'whatsapp'
  | 'facebook';

export interface SocialAssetConfig {
  template: SocialAssetTemplateId;
  format: SocialAssetFormat;
  theme: SocialAssetTheme;
  locale: SocialAssetLocale;
  eyebrow: string;
  headline: string;
  subheadline: string;
  chips: string[];
  ctaUrl: string;
  showMarketBadge: boolean;
}

export interface SocialBioEntry {
  id: string;
  platform: SocialPlatformKey;
  channel: string;
  limitNote: string;
  textEN: string;
  textID: string;
}

export interface SocialCampaignPreset {
  id: string;
  dayLabel: string;
  pillar: string;
  recommendedTime: string;
  platforms: SocialPlatformKey[];
  template: SocialAssetTemplateId;
  defaultFormat: SocialAssetFormat;
  titleEN: string;
  titleID: string;
  captionEN: string;
  captionID: string;
  assetEN: Omit<SocialAssetConfig, 'format' | 'theme' | 'locale'>;
  assetID: Omit<SocialAssetConfig, 'format' | 'theme' | 'locale'>;
}

export const SOCIAL_ASSET_DIMENSIONS: Record<
  SocialAssetFormat,
  { width: number; height: number; labelEN: string; labelID: string }
> = {
  square: { width: 1080, height: 1080, labelEN: 'Square (1080×1080)', labelID: 'Persegi (1080×1080)' },
  story: { width: 1080, height: 1920, labelEN: 'Story (1080×1920)', labelID: 'Story (1080×1920)' },
  banner: { width: 1500, height: 500, labelEN: 'Banner (1500×500)', labelID: 'Banner (1500×500)' },
  og: { width: 1200, height: 630, labelEN: 'Link Card (1200×630)', labelID: 'Link Card (1200×630)' },
};

export const SOCIAL_BIOS_AND_DESCRIPTIONS: SocialBioEntry[] = [
  {
    id: 'ig-threads',
    platform: 'instagram',
    channel: 'Instagram & Threads (@vivreplay)',
    limitNote: '150 chars max',
    textEN: `One Piece & Pokémon TCG Hub\nScan cards, track your Vault, test decks & trade safely on Market.\nvivreplay.com/market`,
    textID: `Hub One Piece & Pokémon TCG\nScan kartu, kelola Vault, uji deck & jual beli aman di Market.\nvivreplay.com/id/market`,
  },
  {
    id: 'x-twitter',
    platform: 'twitter',
    channel: 'X / Twitter (@vivreplay)',
    limitNote: '160 chars max',
    textEN: `Built for One Piece & Pokémon TCG collectors. Camera card scanner, digital Vault, deck simulator, and a protected Market with live auctions.`,
    textID: `Platform kolektor One Piece & Pokémon TCG. Scan kartu dari kamera, Vault koleksi, deck builder, dan Market jual beli dengan lelang live.`,
  },
  {
    id: 'tiktok',
    platform: 'tiktok',
    channel: 'TikTok (@vivreplay)',
    limitNote: '80 chars max',
    textEN: `Scan, Vault & Trade One Piece + Pokémon TCG\nvivreplay.com/market`,
    textID: `Scan, Koleksi & Jual Beli One Piece + Pokémon TCG\nvivreplay.com/id/market`,
  },
  {
    id: 'whatsapp-business',
    platform: 'whatsapp',
    channel: 'WhatsApp Business Profile',
    limitNote: 'Profile description',
    textEN: `VivrePlay: One Piece & Pokémon TCG collector platform. Scan cards, track your Vault, and buy or sell raw singles, graded slabs, and sealed boxes at vivreplay.com/market.`,
    textID: `VivrePlay: Platform kolektor One Piece & Pokémon TCG. Scan kartu, rapikan koleksi di Vault, dan jual beli kartu raw, graded slab, hingga box tersegel di vivreplay.com/id/market.`,
  },
  {
    id: 'whatsapp-community',
    platform: 'whatsapp',
    channel: 'WhatsApp Community / Group',
    limitNote: 'Group description',
    textEN: `Welcome to the VivrePlay Collector Community.\n\nShare pulls, discuss One Piece & Pokémon decks, and post your Market listings or live auctions.\n\nBrowse & list cards: https://vivreplay.com/market\nScan & track your Vault: https://vivreplay.com/vault\nBuild & test decks: https://vivreplay.com/decks/builder\n\nKeep trades respectful and complete all payments inside VivrePlay Market so both buyer and seller stay protected.`,
    textID: `Selamat datang di Komunitas Kolektor VivrePlay.\n\nTempat berbagi hasil pull, diskusi deck One Piece & Pokémon, serta share listing jual beli maupun lelang live.\n\nCari & pasang listing: https://vivreplay.com/id/market\nScan & rapikan Vault: https://vivreplay.com/id/vault\nRakit & uji deck: https://vivreplay.com/id/decks/builder\n\nJaga diskusi tetap kondusif dan selesaikan transaksi melalui VivrePlay Market agar pembeli dan penjual sama-sama aman.`,
  },
  {
    id: 'fb-youtube-discord',
    platform: 'facebook',
    channel: 'Facebook Page / YouTube / Discord',
    limitNote: 'Full about section',
    textEN: `VivrePlay brings everything One Piece Card Game and Pokémon TCG collectors need into one place.\n\nCard Scanner: Point your camera at any card to identify the exact set, rarity, and printing.\nDigital Vault: Track raw singles, graded slabs, alternate arts, and collection value.\nVivrePlay Market: Buy, sell, or run live auctions with anti-snipe protection, integrated courier shipping, and 48-hour buyer inspection.\nDeck Builder & Arena: Build lists, check matchups, and practice games online.\n\nStart free at https://vivreplay.com`,
    textID: `VivrePlay menyatukan semua kebutuhan kolektor dan pemain One Piece Card Game serta Pokémon TCG dalam satu tempat.\n\nScan Kartu Instan: Arahkan kamera ke kartu untuk mengenali set, rarity, dan cetakannya.\nVault Koleksi: Catat kartu raw, graded slab, varian alt-art, dan pantau koleksi Anda.\nVivrePlay Market: Beli, jual, atau adakan lelang live dengan fitur anti-snipe, cek ongkir & resi otomatis, serta masa inspeksi pembeli 48 jam.\nDeck Builder & Arena: Rakit deck, cek meta, dan latihan main langsung secara online.\n\nMulai gratis di https://vivreplay.com/id`,
  },
];

export const SOCIAL_CAMPAIGN_PRESETS: SocialCampaignPreset[] = [
  {
    id: 'launch-reveal',
    dayLabel: 'Mon, Launch',
    pillar: 'Platform Reveal',
    recommendedTime: '19:00',
    platforms: ['instagram', 'threads', 'facebook', 'twitter'],
    template: 'launch',
    defaultFormat: 'square',
    titleEN: 'VivrePlay Platform Reveal',
    titleID: 'Perkenalan Platform VivrePlay',
    captionEN: `Buying, selling, and tracking TCG shouldn't live across five messy group chats and spreadsheets.\n\nMeet VivrePlay, built for One Piece & Pokémon TCG collectors:\n- Scan cards straight from your phone camera\n- Organize raw singles & graded slabs in your Vault\n- Buy, sell, or run live auctions with integrated shipping\n- Build and test decks online\n\nStart free at vivreplay.com/market`,
    captionID: `Koleksi dan jual beli kartu TCG nggak perlu lagi tersebar di banyak chat grup dan spreadsheet.\n\nKenalan dengan VivrePlay, platform untuk kolektor One Piece & Pokémon TCG:\n- Scan kartu langsung dari kamera HP\n- Rapikan kartu raw & graded slab di Vault\n- Beli, jual, atau buka lelang live dengan ongkir terintegrasi\n- Rakit dan uji coba deck secara online\n\nMulai gratis di vivreplay.com/id/market`,
    assetEN: {
      template: 'launch',
      eyebrow: 'ONE PIECE & POKÉMON TCG',
      headline: 'Collect, Trade & Play in One Place.',
      subheadline: 'Scan cards by camera, organize your Vault, trade safely on Market, and test decks online.',
      chips: ['Card Scanner', 'Digital Vault', 'Collector Market', 'Deck Arena'],
      ctaUrl: 'vivreplay.com',
      showMarketBadge: false,
    },
    assetID: {
      template: 'launch',
      eyebrow: 'ONE PIECE & POKÉMON TCG',
      headline: 'Koleksi, Jual Beli & Main di Satu Tempat.',
      subheadline: 'Scan kartu pakai kamera, rapikan Vault, transaksi aman di Market, dan uji deck online.',
      chips: ['Scan Kartu', 'Vault Koleksi', 'Market Aman', 'Arena Deck'],
      ctaUrl: 'vivreplay.com/id',
      showMarketBadge: false,
    },
  },
  {
    id: 'market-trust',
    dayLabel: 'Tue, Market',
    pillar: 'Collector Market',
    recommendedTime: '19:00',
    platforms: ['instagram', 'facebook', 'threads', 'twitter'],
    template: 'market',
    defaultFormat: 'square',
    titleEN: 'Safe Collector Marketplace',
    titleID: 'Marketplace Aman untuk Kolektor',
    captionEN: `Every order on VivrePlay Market includes transparent shipping rates, automatic tracking numbers, and a 48-hour inspection window after delivery before funds settle to the seller.\n\nTrade raw singles, graded slabs, and sealed boxes with peace of mind.\nvivreplay.com/market`,
    captionID: `Setiap transaksi di VivrePlay Market dilengkapi cek ongkir transparan, nomor resi otomatis, dan masa inspeksi 48 jam setelah paket tiba sebelum dana diteruskan ke penjual.\n\nJual beli kartu raw, graded slab, dan box tersegel dengan lebih tenang.\nvivreplay.com/id/market`,
    assetEN: {
      template: 'market',
      eyebrow: 'VIVREPLAY MARKET',
      headline: 'Buy & Sell Singles, Slabs & Sealed Safely.',
      subheadline: 'Fixed-price listings, live auctions, auto courier rates, and 48-hour delivery inspection.',
      chips: ['48h Inspection', 'Auto Tracking', 'QRIS & VA', 'Raw & Slabs'],
      ctaUrl: 'vivreplay.com/market',
      showMarketBadge: true,
    },
    assetID: {
      template: 'market',
      eyebrow: 'VIVREPLAY MARKET',
      headline: 'Jual Beli Kartu, Slab & Box Lebih Tenang.',
      subheadline: 'Harga pas atau lelang live, cek ongkir otomatis, dan masa inspeksi 48 jam setelah paket tiba.',
      chips: ['Inspeksi 48 Jam', 'Resi Otomatis', 'QRIS & VA', 'Raw & Slab'],
      ctaUrl: 'vivreplay.com/id/market',
      showMarketBadge: true,
    },
  },
  {
    id: 'scanner-vault-flow',
    dayLabel: 'Wed, Scanner',
    pillar: 'Scanner & Vault',
    recommendedTime: '12:15',
    platforms: ['instagram', 'threads', 'tiktok'],
    template: 'scanner',
    defaultFormat: 'story',
    titleEN: 'Scan to Vault to Market',
    titleID: 'Scan ke Vault lalu Jual',
    captionEN: `Fresh pull? List it in under a minute.\n\n1. Scan the card with your camera\n2. Save it into your Vault\n3. Publish to VivrePlay Market at fixed price or live auction\n\nNo manual typing of set codes or card numbers.\nTry it now: vivreplay.com/vault`,
    captionID: `Baru dapat pull bagus? Pasang iklan kurang dari semenit.\n\n1. Scan kartu pakai kamera\n2. Simpan otomatis ke Vault\n3. Jual di VivrePlay Market dengan harga pas atau lelang live\n\nNggak perlu ketik kode set atau nomor kartu secara manual.\nCoba langsung di vivreplay.com/id/vault`,
    assetEN: {
      template: 'scanner',
      eyebrow: 'SCANNER & VAULT',
      headline: 'Scan Once. Sync to Vault & Market.',
      subheadline: 'Identify EN, JP & ID printings by camera, track graded slabs, and list in one tap.',
      chips: ['EN / JP / ID', 'PSA / BGS / EGS', '1-Tap Listing', 'Price Guide'],
      ctaUrl: 'vivreplay.com/vault',
      showMarketBadge: false,
    },
    assetID: {
      template: 'scanner',
      eyebrow: 'SCANNER & VAULT',
      headline: 'Scan Sekali. Masuk Vault & Siap Jual.',
      subheadline: 'Kenali cetakan EN, JP & ID lewat kamera, catat graded slab, dan pasang listing 1 klik.',
      chips: ['Kartu EN / JP / ID', 'PSA / BGS / EGS', 'Jual 1 Klik', 'Pantau Harga'],
      ctaUrl: 'vivreplay.com/id/vault',
      showMarketBadge: false,
    },
  },
  {
    id: 'live-auctions',
    dayLabel: 'Thu, Auctions',
    pillar: 'Live Auctions',
    recommendedTime: '20:30',
    platforms: ['instagram', 'twitter', 'threads', 'facebook'],
    template: 'auctions',
    defaultFormat: 'square',
    titleEN: 'Fair Live Auctions',
    titleID: 'Lelang Live yang Adil',
    captionEN: `Tired of losing auctions in the last 2 seconds?\n\nVivrePlay Market auctions support 24h/48h rolling timers or fixed end times with +2m anti-snipe protection, Buy Out options, and instant winner checkout.\n\nBrowse live auctions now: vivreplay.com/market`,
    captionID: `Kesal kalah lelang di 2 detik terakhir?\n\nLelang di VivrePlay Market mendukung durasi rolling 24/48 jam atau waktu tutup tetap dengan proteksi anti-snipe +2m, opsi Buy Out, dan checkout pemenang instan.\n\nPantau lelang aktif sekarang: vivreplay.com/id/market`,
    assetEN: {
      template: 'auctions',
      eyebrow: 'LIVE AUCTIONS',
      headline: 'Real-Time Bidding. Zero Last-Second Sniping.',
      subheadline: '24h or 48h rolling timers, fixed end times, +2m anti-snipe protection, and Buy Out.',
      chips: ['Anti-Snipe +2m', 'Rolling 24h / 48h', 'Buy Out Ready', 'Instant Checkout'],
      ctaUrl: 'vivreplay.com/market',
      showMarketBadge: true,
    },
    assetID: {
      template: 'auctions',
      eyebrow: 'LELANG LIVE',
      headline: 'Bid Real-Time. Tanpa Drama Sniping.',
      subheadline: 'Durasi rolling 24/48 jam atau waktu tetap, proteksi anti-snipe +2m, dan opsi Buy Out.',
      chips: ['Anti-Snipe +2m', 'Rolling 24 / 48 Jam', 'Opsi Buy Out', 'Checkout Instan'],
      ctaUrl: 'vivreplay.com/id/market',
      showMarketBadge: true,
    },
  },
  {
    id: 'market-pro',
    dayLabel: 'Fri, Pro',
    pillar: 'Market Pro',
    recommendedTime: '20:30',
    platforms: ['instagram', 'twitter', 'threads'],
    template: 'pro',
    defaultFormat: 'square',
    titleEN: 'Market Pro Benefits',
    titleID: 'Keuntungan Market Pro',
    captionEN: `Selling regularly? Upgrade to Market Pro:\n- 0.75% service fee (instead of 1.75%)\n- Up to 500 active listings & 30-day lifespan\n- Monthly Spotlight boost credits & shipping vouchers\n- Scheduled social auto-posts for your listings\n\nSee plans at vivreplay.com/market`,
    captionID: `Rutin jualan kartu? Upgrade ke Market Pro:\n- Biaya layanan 0,75% (lebih hemat dari 1,75%)\n- Hingga 500 listing aktif dengan durasi 30 hari\n- Kredit Sorotan bulanan & voucher ongkir\n- Jadwal auto-post ke media sosial untuk setiap listing\n\nLihat detail paket di vivreplay.com/id/market`,
    assetEN: {
      template: 'pro',
      eyebrow: 'MARKET PRO',
      headline: '0.75% Fee. Built for Active Sellers.',
      subheadline: '30-day listings, Spotlight boost credits, shipping vouchers, and up to 500 active listings.',
      chips: ['0.75% Fee', 'Spotlight Credits', 'Shipping Vouchers', 'Auto-Post'],
      ctaUrl: 'vivreplay.com/market',
      showMarketBadge: true,
    },
    assetID: {
      template: 'pro',
      eyebrow: 'MARKET PRO',
      headline: 'Biaya 0,75%. Lebih Hemat untuk Seller.',
      subheadline: 'Durasi listing 30 hari, kredit Sorotan, voucher ongkir, dan hingga 500 listing aktif.',
      chips: ['Biaya 0,75%', 'Kredit Sorotan', 'Voucher Ongkir', 'Auto-Post'],
      ctaUrl: 'vivreplay.com/id/market',
      showMarketBadge: true,
    },
  },
  {
    id: 'deck-arena',
    dayLabel: 'Sat, Play',
    pillar: 'Decks & Arena',
    recommendedTime: '15:00',
    platforms: ['twitter', 'instagram', 'threads'],
    template: 'arena',
    defaultFormat: 'banner',
    titleEN: 'Deck Builder & Online Arena',
    titleID: 'Deck Builder & Arena Online',
    captionEN: `Before locals start, test your spicy tech online.\n\nBuild your One Piece deck, check matchup win rates, and run practice games in the VivrePlay Arena.\n\nBuild now: vivreplay.com/decks/builder`,
    captionID: `Sebelum turnamen mingguan mulai, uji dulu kombo deck kamu.\n\nRakit deck One Piece, cek statistik matchup meta, dan latihan tanding langsung di Arena VivrePlay.\n\nMulai rakit: vivreplay.com/id/decks/builder`,
    assetEN: {
      template: 'arena',
      eyebrow: 'DECK BUILDER & ARENA',
      headline: 'Build Lists. Test Every Matchup.',
      subheadline: 'Official card rulings, live meta win rates, and browser playtesting before locals.',
      chips: ['Deck Builder', 'Meta Win Rates', 'Official Rulings', 'Online Arena'],
      ctaUrl: 'vivreplay.com/decks/builder',
      showMarketBadge: false,
    },
    assetID: {
      template: 'arena',
      eyebrow: 'DECK BUILDER & ARENA',
      headline: 'Rakit Deck. Uji Sebelum Turnamen.',
      subheadline: 'Lengkap dengan ruling resmi, statistik meta, dan arena latihan langsung dari browser.',
      chips: ['Deck Builder', 'Statistik Meta', 'Ruling Resmi', 'Arena Online'],
      ctaUrl: 'vivreplay.com/id/decks/builder',
      showMarketBadge: false,
    },
  },
];
