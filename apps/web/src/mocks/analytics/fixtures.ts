import type { EarningDataPoint, TraineeKPI, Transaction } from "@/types/contracts/analytics";

export const earningsFixtures: EarningDataPoint[] = [
  { period: "1", songRevenue: 4000, badgeRevenue: 2400 },
  { period: "2", songRevenue: 3000, badgeRevenue: 1398 },
  { period: "3", songRevenue: 2000, badgeRevenue: 9800 },
  { period: "4", songRevenue: 2780, badgeRevenue: 3908 },
  { period: "5", songRevenue: 1890, badgeRevenue: 4800 },
  { period: "6", songRevenue: 2390, badgeRevenue: 3800 },
  { period: "7", songRevenue: 3490, badgeRevenue: 4300 }
];

export const transactionFixtures: Transaction[] = [
  {
    id: "txn-1",
    userId: "user-demo",
    type: "royalty",
    direction: "in",
    amount: 12450,
    currency: "CNY",
    status: "completed",
    referenceId: "royalty-feb-2026",
    description: "Royalty Payout - Feb 2026",
    createdAt: "2026-03-15T10:00:00Z"
  },
  {
    id: "txn-2",
    userId: "user-demo",
    type: "nftSale",
    direction: "in",
    amount: 8920,
    currency: "CNY",
    status: "completed",
    referenceId: "nft-genesis-badge",
    description: "Mint Revenue - Genesis Badge",
    createdAt: "2026-03-14T14:30:00Z"
  },
  {
    id: "txn-3",
    userId: "user-demo",
    type: "aiCredit",
    direction: "out",
    amount: 200,
    currency: "CNY",
    status: "completed",
    referenceId: null,
    description: "AI Service Fee (Suno API)",
    createdAt: "2026-03-12T09:15:00Z"
  },
  {
    id: "txn-4",
    userId: "user-demo",
    type: "withdrawal",
    direction: "out",
    amount: 5000,
    currency: "CNY",
    status: "pending",
    referenceId: "wallet-0x8a2",
    description: "Withdrawal to Wallet (0x8...2a)",
    createdAt: "2026-03-10T16:45:00Z"
  }
];

export const coachTraineeFixtures: TraineeKPI[] = [
  {
    traineeId: "trainee-1",
    username: "Alex Chen",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100",
    status: "active",
    weeklySongs: 3,
    weeklyProgress: 75,
    weeklyRevenue: 1200,
    successRate: 80,
    pendingReviews: 1,
    weekStart: "2026-04-07"
  },
  {
    traineeId: "trainee-2",
    username: "Sarah V",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    status: "inactive",
    weeklySongs: 1,
    weeklyProgress: 30,
    weeklyRevenue: 450,
    successRate: 40,
    pendingReviews: 2,
    weekStart: "2026-04-07"
  },
  {
    traineeId: "trainee-3",
    username: "Mike D",
    avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100",
    status: "active",
    weeklySongs: 5,
    weeklyProgress: 88,
    weeklyRevenue: 3400,
    successRate: 90,
    pendingReviews: 0,
    weekStart: "2026-04-07"
  },
  {
    traineeId: "trainee-4",
    username: "Emma W",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    status: "graduated",
    weeklySongs: 7,
    weeklyProgress: 95,
    weeklyRevenue: 8900,
    successRate: 97,
    pendingReviews: 0,
    weekStart: "2026-04-07"
  }
];
