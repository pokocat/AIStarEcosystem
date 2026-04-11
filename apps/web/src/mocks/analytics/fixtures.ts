export const earningsFixtures = [
  { name: "1", song: 4000, badge: 2400 },
  { name: "2", song: 3000, badge: 1398 },
  { name: "3", song: 2000, badge: 9800 },
  { name: "4", song: 2780, badge: 3908 },
  { name: "5", song: 1890, badge: 4800 },
  { name: "6", song: 2390, badge: 3800 },
  { name: "7", song: 3490, badge: 4300 }
];

export const transactionFixtures = [
  { id: "txn-1", date: "2026-03-15", description: "Royalty Payout - Feb 2026", amountLabel: "+ ¥12,450", status: "Completed" as const },
  { id: "txn-2", date: "2026-03-14", description: "Mint Revenue - Genesis Badge", amountLabel: "+ ¥8,920", status: "Completed" as const },
  { id: "txn-3", date: "2026-03-12", description: "AI Service Fee (Suno API)", amountLabel: "- ¥200", status: "Completed" as const },
  { id: "txn-4", date: "2026-03-10", description: "Withdrawal to Wallet (0x8...2a)", amountLabel: "- ¥5,000", status: "Processing" as const }
];

export const coachTraineeFixtures = [
  { id: "coach-1", name: "Alex Chen", status: "On Track" as const, progress: 75, revenue: 1200, lastActive: "2h ago", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100", latestSubmissionTitle: "Neon Nights.mp3" },
  { id: "coach-2", name: "Sarah V", status: "Warning" as const, progress: 30, revenue: 450, lastActive: "3d ago", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", latestSubmissionTitle: "Skyline Dusk.mp3" },
  { id: "coach-3", name: "Mike D", status: "On Track" as const, progress: 88, revenue: 3400, lastActive: "15m ago", avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100", latestSubmissionTitle: "Arc Reactor.mp3" },
  { id: "coach-4", name: "Emma W", status: "Star" as const, progress: 95, revenue: 8900, lastActive: "Just now", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", latestSubmissionTitle: "Aurora Bloom.mp3" }
];
