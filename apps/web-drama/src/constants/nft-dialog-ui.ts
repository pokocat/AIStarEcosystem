// ─────────────────────────────────────────────────────────────────────────────
// nft-dialog-ui.ts — NFT 铸造对话框文案与稀有度图标配置。
// ─────────────────────────────────────────────────────────────────────────────

import { Star, Sparkles, Crown, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Rarity } from "@ai-star-eco/types/_shared";

/** 铸造流程四个阶段对应的页面文案。 */
export const NFT_DIALOG_STRINGS = {
  title: "NFT 铸造",
  subtitle: "将你的音乐铸造为链上资产",
  step1: "配置 NFT",
  step2: "连接钱包",
  step3: "铸造中",
  step4: "铸造成功",
  collectionName: "合集名称",
  collectionPlaceholder: "例如：Neon Dreams Collection",
  supply: "发行数量",
  supplyDesc: "限量发行，售完即止",
  price: "铸造价格 (ETH)",
  priceDesc: "每个 NFT 的售价",
  royalty: "版税比例 (%)",
  royaltyDesc: "二级市场交易时的创作者分成",
  rarity: "稀有度",
  rarityCommon: "普通",
  rarityRare: "稀有",
  rarityEpic: "史诗",
  rarityLegendary: "传说",
  perks: "持有者权益",
  perkAirdrop: "未来空投",
  perkAirdropDesc: "自动获得新作品空投",
  perkAccess: "独家访问",
  perkAccessDesc: "访问私密社群和内容",
  perkMeetup: "线下见面会",
  perkMeetupDesc: "优先参与线下活动",
  walletTitle: "连接 Web3 钱包",
  walletDesc: "请连接你的钱包以完成铸造",
  connectMetaMask: "连接 MetaMask",
  connectWalletConnect: "连接 WalletConnect",
  connectCoinbase: "连接 Coinbase Wallet",
  walletConnected: "钱包已连接",
  walletAddress: "钱包地址",
  balance: "余额",
  networkFee: "网络费用（Gas）",
  total: "总计",
  minting: "铸造中...",
  mintingStage1: "准备链上交易",
  mintingStage2: "上传元数据到 IPFS",
  mintingStage3: "调用智能合约",
  mintingStage4: "等待区块确认",
  mintingStage5: "铸造完成",
  success: "铸造成功！",
  successDesc: "你的 NFT 已成功上链",
  viewOnMarket: "前往市场",
  shareNFT: "分享 NFT",
  mintAnother: "继续铸造",
  back: "返回",
  next: "下一步",
  mint: "确认铸造",
  estGasFee: "预计 Gas 费",
  contractAddress: "合约地址",
  tokenId: "Token ID",
  mintProgressLabel: "铸造进度",
} as const;

/** 稀有度 → 配色 + 图标（NFT 对话框专用，包含 icon，区别于 fan-ui 的 RARITY_STYLES）。 */
export interface NFTRarityConfig {
  color: string;
  bg: string;
  border: string;
  icon: LucideIcon;
}

export const NFT_RARITY_CONFIG: Record<Rarity, NFTRarityConfig> = {
  common:    { color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/20",   icon: Star },
  rare:      { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: Sparkles },
  epic:      { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Crown },
  legendary: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: Zap },
};

/** 稀有度中文名映射（对应 NFT_DIALOG_STRINGS 的 rarityXxx 字段）。 */
export const RARITY_LABELS: Record<Rarity, string> = {
  common:    NFT_DIALOG_STRINGS.rarityCommon,
  rare:      NFT_DIALOG_STRINGS.rarityRare,
  epic:      NFT_DIALOG_STRINGS.rarityEpic,
  legendary: NFT_DIALOG_STRINGS.rarityLegendary,
};
