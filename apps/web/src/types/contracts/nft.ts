// ─────────────────────────────────────────────────────────────────────────────
// nft.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type NFTRarity = "common" | "rare" | "epic" | "legendary";

export type MintStatus = "pending" | "minting" | "success" | "failed";

export type MintStage =
  | "preparing"     // 准备链上交易
  | "ipfsUpload"    // 上传元数据到 IPFS
  | "contractCall"  // 调用智能合约
  | "confirming"    // 等待区块确认
  | "completed";

export type WalletType = "metamask" | "walletconnect" | "coinbase";

// ── 2.10 NFTCollection ───────────────────────────────────────────────────────

/** NFT 持有者权益 */
export interface NftPerks {
  futureAirdrop: boolean;   // 未来空投权益
  exclusiveAccess: boolean; // 独家访问权益
  meetupPriority: boolean;  // 线下见面会优先权
}

/** NFT 合集完整数据 */
export interface NftCollection {
  id: string;
  creatorId: string;
  trackId: string;
  singerId: string | null;
  name: string;
  description: string | null;
  coverUrl: string | null;
  supply: number;           // 1–10000
  priceEth: string;         // decimal 字符串，如 "0.05"
  royaltyPct: number;       // 0–100，默认 10；>30 时前端警告
  rarity: NFTRarity;
  enableAirdrop: boolean;
  perks: NftPerks;
  contractAddress: string | null;
  tokenIdRangeStart: number | null;
  tokenIdRangeEnd: number | null;
  mintedCount: number;
  status: MintStatus;
  chain: string;            // 默认 "ethereum"
  ipfsMetadataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** NFT 合集列表摘要视图 */
export interface NftCollectionSummary {
  id: string;
  name: string;
  coverUrl: string | null;
  priceEth: string;  // decimal 字符串
  remaining: number;
  rarity: NFTRarity;
  trackId?: string;
}

// ── 2.8 NFT Mint Request ────────────────────────────────────────────────────

export interface NftMintRequest {
  trackId: string;
  collectionName: string;
  supply: number;
  priceEth: number;
  royaltyPct: number;
  rarity: NFTRarity;
  enableAirdrop: boolean;
}

// ── 2.11 NFTMintJob ──────────────────────────────────────────────────────────

/** 铸造任务状态（轮询响应） */
export interface NftMintJob {
  id: string;
  collectionId: string;
  userId: string;
  walletAddress: string;
  walletType: WalletType;
  status: MintStatus;
  currentStage: MintStage;
  txHash: string | null;
  gasFeeEth: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Workspace payload ────────────────────────────────────────────────────────

export interface NftCollectionsPayload {
  collections: NftCollectionSummary[];
}
