import type {
  FinancialRecord,
  MintMetadata,
  Singer,
  StudioMode,
  Track,
  WardrobeItem,
} from '../types/entities';
import type {
  CoachDashboardData,
  FanDashboardData,
  ProducerDashboardData,
} from '../api/interfaces/IAppService';

const now = '2026-04-08T00:00:00.000Z';

export const STUDIO_MODES: Array<{ id: StudioMode; label: string; creditCost: number }> = [
  { id: 'text', label: 'Text Mode', creditCost: 5 },
  { id: 'melody', label: 'Melody Mode', creditCost: 5 },
  { id: 'advanced', label: 'Advanced Mode', creditCost: 5 },
  { id: 'interactive', label: 'Interactive Mode', creditCost: 5 },
  { id: 'lyricsToSong', label: 'Lyrics2Song', creditCost: 5 },
  { id: 'inspiration', label: 'Inspiration Mode', creditCost: 5 },
  { id: 'imageToSong', label: 'Image2Song', creditCost: 5 },
  { id: 'remixHit', label: 'Remix Hit', creditCost: 5 },
  { id: 'funMode', label: 'Fun Modes', creditCost: 5 },
  { id: 'acrostic', label: 'Acrostic', creditCost: 5 },
  { id: 'giftSong', label: 'Gift a Song', creditCost: 5 },
];

const wardrobeItems: WardrobeItem[] = [
  {
    id: 'w-top-aurora',
    name: 'Aurora Cropped Jacket',
    category: 'top',
    imageUrl: 'https://picsum.photos/seed/top1/300/300',
    rarity: 'rare',
    price: 120,
    tags: ['street', 'cyber'],
    isTrending: true,
  },
  {
    id: 'w-bottom-neon',
    name: 'Neon Pleated Skirt',
    category: 'bottom',
    imageUrl: 'https://picsum.photos/seed/bottom1/300/300',
    rarity: 'epic',
    price: 160,
    tags: ['idol', 'stage'],
    isNew: true,
  },
  {
    id: 'w-shoes-echo',
    name: 'Echo Pulse Sneakers',
    category: 'shoes',
    imageUrl: 'https://picsum.photos/seed/shoes1/300/300',
    rarity: 'common',
    price: 90,
    tags: ['sport', 'daily'],
  },
  {
    id: 'w-hair-violet',
    name: 'Violet Twin-tail',
    category: 'hair',
    imageUrl: 'https://picsum.photos/seed/hair1/300/300',
    rarity: 'legendary',
    price: 500,
    tags: ['anime', 'signature'],
    isLocked: true,
  },
  {
    id: 'w-accessory-halo',
    name: 'Holo Halo',
    category: 'accessory',
    imageUrl: 'https://picsum.photos/seed/acc1/300/300',
    rarity: 'epic',
    price: 210,
    tags: ['hologram', 'performance'],
  },
  {
    id: 'w-outfit-constellation',
    name: 'Constellation Full Set',
    category: 'outfit',
    imageUrl: 'https://picsum.photos/seed/outfit1/300/300',
    rarity: 'legendary',
    price: 880,
    tags: ['fullset', 'premium'],
    isLocked: true,
  },
];

const singers: Singer[] = [
  {
    id: 'singer-001',
    name: 'Astra Nova',
    avatar: 'https://picsum.photos/seed/singer1/512/512',
    style: 'Hyperpop',
    status: 'active',
    quality: 'epic',
    createdAt: now,
    tags: ['cyber', 'dance', 'idol'],
    stats: { songs: 17, fans: 32540, popularity: 91 },
    persona: {
      singerId: 'singer-001',
      sweetness: 74,
      energy: 92,
      mystery: 41,
      preset: 'youthful',
      traits: ['energetic', 'bold', 'optimistic'],
      voiceTone: 'bright mezzo',
      language: 'zh',
    },
    wardrobe: {
      top: 'w-top-aurora',
      bottom: 'w-bottom-neon',
      shoes: 'w-shoes-echo',
      accessory: 'w-accessory-halo',
      hair: 'w-hair-violet',
    },
    wardrobeInventory: wardrobeItems,
    favoriteWardrobeItemIds: ['w-accessory-halo', 'w-bottom-neon'],
    savedOutfitIds: ['look-stage-a', 'look-live-stream-b'],
    pose: {
      poseId: 'pose-dance-01',
      poseCategory: 'dancing',
      expressionId: 'exp-happy-01',
      expressionIntensity: 86,
      gestureId: 'gesture-v-sign',
    },
  },
];

const tracks: Track[] = STUDIO_MODES.map((mode, index) => ({
  id: `track-${index + 1}`,
  singerId: 'singer-001',
  title: `${mode.label} Demo ${index + 1}`,
  mode: mode.id,
  status: index < 7 ? 'published' : index === 7 ? 'processing' : 'draft',
  generationStage: index < 7 ? 'success' : index === 7 ? 'arranging' : 'idle',
  bpm: 88 + index * 4,
  key: ['C', 'Dm', 'Em', 'F', 'G', 'Am'][index % 6],
  durationSec: 150 + index * 8,
  prompt: `Mock prompt for ${mode.label}`,
  lyrics: `Sample lyrics prototype for ${mode.label}`,
  audioUrl: `https://example.com/audio/${mode.id}.mp3`,
  waveformUrl: `https://example.com/wave/${mode.id}.json`,
  createdAt: now,
  updatedAt: now,
}));

const mintDrafts: MintMetadata[] = [
  {
    collectionName: 'Astra Genesis Badge',
    tokenName: 'Astra #001',
    description: 'Founding support badge for Astra Nova.',
    image: 'https://picsum.photos/seed/nft1/1024/1024',
    attributes: [
      { trait_type: 'Tier', value: 'Genesis' },
      { trait_type: 'Rarity', value: 'Legendary' },
      { trait_type: 'Season', value: 1 },
    ],
    supply: 300,
    royaltyPercent: 7.5,
    rarity: 'legendary',
    chain: 'ethereum',
    externalUrl: 'https://example.com/collections/astra-genesis',
  },
];

const finance: FinancialRecord[] = [
  {
    id: 'fin-001',
    type: 'streaming',
    amount: 8450,
    currency: 'CNY',
    direction: 'in',
    status: 'completed',
    timestamp: now,
    description: 'March streaming settlement',
  },
  {
    id: 'fin-002',
    type: 'nftSale',
    amount: 2.35,
    currency: 'ETH',
    direction: 'in',
    status: 'completed',
    timestamp: now,
    description: 'Genesis badge mint income',
    referenceId: 'Astra #001',
  },
];

export const MOCK_PRODUCER_DATA: ProducerDashboardData = {
  singers,
  tracks,
  finance,
  mintDrafts,
  credits: 165,
};

export const MOCK_FAN_DATA: FanDashboardData = {
  featuredSingers: singers,
  trendingTracks: tracks.slice(0, 5),
  ownedBadges: mintDrafts,
};

export const MOCK_COACH_DATA: CoachDashboardData = {
  traineeSingers: singers,
  traineeTracks: tracks,
  kpi: {
    weeklyNewSongs: 23,
    successRate: 87,
    pendingReviews: 4,
    ecosystemValue: 3_850_000,
  },
};
