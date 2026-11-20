export type QuestGroup = 'starter' | 'growth';

export type QuestDefinition = {
  key: string;
  group: QuestGroup;
  points: number;
  target: number;
  href: string;
  title: { EN: string; ID: string };
  description: { EN: string; ID: string };
};

export type QuestStats = {
  vaultCards: number;
  decks: number;
  hasDeliveryAddress: boolean;
  listings: number;
  wishlists: number;
  paidOrders: number;
};

export type QuestItem = QuestDefinition & {
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export const PRO_TRIAL_QUEST_KEY = 'unlock_pro_trial';
export const PRO_TRIAL_REQUIRED_CLAIMS = 3;
export const PRO_TRIAL_DAYS = 3;

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    key: 'vault_first_cards',
    group: 'starter',
    points: 50,
    target: 5,
    href: '/vault',
    title: { EN: 'Start your Vault', ID: 'Mulai isi Vault' },
    description: {
      EN: 'Add at least 5 cards to your personal Vault.',
      ID: 'Tambahkan minimal 5 kartu ke Vault pribadi Anda.',
    },
  },
  {
    key: 'deck_builder',
    group: 'starter',
    points: 50,
    target: 1,
    href: '/deck',
    title: { EN: 'Build a Decklist', ID: 'Buat Decklist' },
    description: {
      EN: 'Save your first decklist in the Deck Builder.',
      ID: 'Simpan decklist pertama Anda di Deck Builder.',
    },
  },
  {
    key: 'delivery_ready',
    group: 'starter',
    points: 50,
    target: 1,
    href: '/profile',
    title: { EN: 'Set Delivery Address', ID: 'Atur Alamat Pengiriman' },
    description: {
      EN: 'Save your shipping address for Market checkout and selling.',
      ID: 'Simpan alamat pengiriman untuk belanja dan berjualan di Market.',
    },
  },
  {
    key: 'first_listing',
    group: 'starter',
    points: 100,
    target: 1,
    href: '/market',
    title: { EN: 'List on Market', ID: 'Buat Listing di Market' },
    description: {
      EN: 'Publish your first WTS or WTB card listing.',
      ID: 'Publikasikan listing WTS atau WTB pertama Anda.',
    },
  },
  {
    key: 'vault_collector_25',
    group: 'growth',
    points: 100,
    target: 25,
    href: '/vault',
    title: { EN: 'Archive 25 Cards', ID: 'Arsipkan 25 Kartu' },
    description: {
      EN: 'Grow your Vault collection to 25 cards.',
      ID: 'Kumpulkan hingga 25 kartu di koleksi Vault Anda.',
    },
  },
  {
    key: 'first_wishlist',
    group: 'growth',
    points: 25,
    target: 1,
    href: '/cards',
    title: { EN: 'Watch a Card', ID: 'Pantau Kartu di Wishlist' },
    description: {
      EN: 'Add any card to your Market Wishlist.',
      ID: 'Tambahkan kartu ke Wishlist Market Anda.',
    },
  },
  {
    key: 'first_order',
    group: 'growth',
    points: 150,
    target: 1,
    href: '/market',
    title: { EN: 'Complete a Purchase', ID: 'Selesaikan Pembelian' },
    description: {
      EN: 'Complete your first paid order on VivrePlay Market.',
      ID: 'Selesaikan pesanan berbayar pertama Anda di VivrePlay Market.',
    },
  },
];

function progressForQuest(key: string, stats: QuestStats): number {
  switch (key) {
    case 'vault_first_cards':
    case 'vault_collector_25':
      return Math.max(0, stats.vaultCards);
    case 'deck_builder':
      return Math.max(0, stats.decks);
    case 'delivery_ready':
      return stats.hasDeliveryAddress ? 1 : 0;
    case 'first_listing':
      return Math.max(0, stats.listings);
    case 'first_wishlist':
      return Math.max(0, stats.wishlists);
    case 'first_order':
      return Math.max(0, stats.paidOrders);
    default:
      return 0;
  }
}

export function computeQuestBoard(stats: QuestStats, claimedKeys: Set<string>) {
  const quests: QuestItem[] = QUEST_DEFINITIONS.map((quest) => {
    const progress = Math.min(quest.target, progressForQuest(quest.key, stats));
    const completed = progress >= quest.target;
    const claimed = claimedKeys.has(quest.key);
    return { ...quest, progress, completed, claimed };
  });
  const totalPoints = quests.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = quests.reduce((sum, q) => sum + (q.claimed ? q.points : 0), 0);
  const claimedCount = quests.filter((q) => q.claimed).length;
  const readyCount = quests.filter((q) => q.completed && !q.claimed).length;
  const proRewardClaimed = claimedKeys.has(PRO_TRIAL_QUEST_KEY);
  const proRewardUnlocked = claimedCount >= PRO_TRIAL_REQUIRED_CLAIMS;

  return {
    quests,
    totalPoints,
    earnedPoints,
    claimedCount,
    readyCount,
    proRewardClaimed,
    proRewardUnlocked,
    proRewardRequiredClaims: PRO_TRIAL_REQUIRED_CLAIMS,
    proRewardDays: PRO_TRIAL_DAYS,
  };
}
