/**
 * 账单中心
 * 星币钱包 · 套餐管理 · GMV分成明细 · MCN分佣设置
 */
import React, { useState } from 'react';
import {
  Coins, TrendingUp, Receipt, Settings2, Plus, ArrowDownLeft,
  ArrowUpRight, Crown, Zap, CheckCircle2, Clock, ChevronRight,
  BarChart3, Users, Wallet, RefreshCw, ChevronDown, Check,
  AlertCircle, Star, BadgeCheck, Sparkles, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import type { Lang } from '../../translations';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingTab = 'wallet' | 'subscription' | 'gmv' | 'mcn';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COIN_TRANSACTIONS = [
  { id: 'tx1', type: 'topup',    desc: '星币充值', amount: +5500,  date: '2025-05-01', balance: 12340 },
  { id: 'tx2', type: 'spend',    desc: 'AI脚本生成 × 8',   amount: -400,   date: '2025-05-02', balance: 11940 },
  { id: 'tx3', type: 'spend',    desc: '账号报白申请 × 2', amount: -400,   date: '2025-05-03', balance: 11540 },
  { id: 'tx4', type: 'spend',    desc: 'AI声音配音 3分钟', amount: -360,   date: '2025-05-04', balance: 11180 },
  { id: 'tx5', type: 'topup',    desc: '星币充值',          amount: +12000, date: '2025-04-28', balance: 11540 },
  { id: 'tx6', type: 'spend',    desc: 'AI形象视频 × 2',   amount: -1000,  date: '2025-04-25', balance: -1000 },
  { id: 'tx7', type: 'reward',   desc: '套餐赠送星币',      amount: +500,   date: '2025-04-20', balance: 500 },
];

const GMV_RECORDS = [
  { id: 'g1', account: '潮品好物优选', platform: '抖音', celebrity: '贾乃亮', month: '2025-05', gmv: 2840000, platformFee: 42600, netGmv: 2797400 },
  { id: 'g2', account: '优品生活号',   platform: '视频号', celebrity: '贾乃亮', month: '2025-05', gmv: 680000,  platformFee: 10200, netGmv: 669800 },
  { id: 'g3', account: '潮品好物优选', platform: '抖音', celebrity: '郝邵文', month: '2025-05', gmv: 410000,  platformFee: 6150,  netGmv: 403850 },
  { id: 'g4', account: '潮品好物优选', platform: '抖音', celebrity: '贾乃亮', month: '2025-04', gmv: 1920000, platformFee: 28800, netGmv: 1891200 },
  { id: 'g5', account: '优品生活号',   platform: '视频号', celebrity: '贾乃亮', month: '2025-04', gmv: 530000,  platformFee: 7950,  netGmv: 522050 },
];

const MCN_ACCOUNTS = [
  { id: 'ma1', name: '潮品好物优选', platform: '抖音', celebrities: ['贾乃亮', '郝邵文'], operatorShare: 25, platformShare: 1.5, pendingShare: 73.5 },
  { id: 'ma2', name: '优品生活号',   platform: '视频号', celebrities: ['贾乃亮'], operatorShare: 20, platformShare: 1.5, pendingShare: 78.5 },
  { id: 'ma3', name: '明星好货铺',   platform: '抖音', celebrities: ['李立群'], operatorShare: 22, platformShare: 1.5, pendingShare: 76.5 },
];

const TOPUP_PACKAGES = [
  { amount: 100,  coins: 1000,  bonus: 0,   label: '入门包' },
  { amount: 500,  coins: 5500,  bonus: 10,  label: '标准包', popular: false },
  { amount: 1000, coins: 12000, bonus: 20,  label: '专业包', popular: true },
  { amount: 5000, coins: 65000, bonus: 30,  label: '旗舰包' },
];

const MONTHLY_BILLS = [
  { month: '2025-05', subscription: 5800, coinSpend: 2160, gmvFee: 58950, total: 66910, status: 'current' },
  { month: '2025-04', subscription: 5800, coinSpend: 1800, gmvFee: 36750, total: 44350, status: 'paid' },
  { month: '2025-03', subscription: 5800, coinSpend: 3200, gmvFee: 28400, total: 37400, status: 'paid' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; bg: string;
}) => (
  <div className={`${bg} border border-white/[0.06] rounded-xl p-4 flex items-start gap-3`}>
    <div className={`w-9 h-9 rounded-lg ${bg} border border-white/8 flex items-center justify-center shrink-0`}>
      <span className={color}>{icon}</span>
    </div>
    <div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
      {sub && <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Tab: 星币钱包 ────────────────────────────────────────────────────────────

const WalletTab = ({ zh }: { zh: boolean }) => {
  const [selectedTopup, setSelectedTopup] = useState<number | null>(2);
  const [showHistory, setShowHistory] = useState(false);
  const [topping, setTopping] = useState(false);
  const [topped, setTopped] = useState(false);
  const balance = 11180;

  const handleTopup = () => {
    setTopping(true);
    setTimeout(() => { setTopping(false); setTopped(true); setTimeout(() => setTopped(false), 2000); }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="relative bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-red-500/8 border border-amber-500/25 rounded-2xl p-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] text-amber-400/70 uppercase tracking-widest mb-1">{zh ? '当前星币余额' : 'Star Coin Balance'}</div>
              <div className="text-4xl font-black text-amber-400 flex items-baseline gap-2">
                ⬡ {balance.toLocaleString()}
                <span className="text-sm font-normal text-amber-400/60">{zh ? '星币' : 'SC'}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                {zh ? `≈ 可生成 AI脚本 ×${Math.floor(balance/50)} 次 / AI视频 ×${Math.floor(balance/500)} 条` : `≈ ${Math.floor(balance/50)} scripts / ${Math.floor(balance/500)} AI videos`}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Coins className="w-10 h-10 text-amber-400/30" />
              <div className="text-[9px] text-gray-600">{zh ? '本月消耗 ⬡2,160' : '↓ 2,160 this month'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-up packages */}
      <div>
        <div className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-amber-400" />{zh ? '充值星币' : 'Top Up Star Coins'}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {TOPUP_PACKAGES.map((pkg, i) => (
            <motion.button key={i} onClick={() => setSelectedTopup(i)}
              whileHover={{ y: -2 }}
              className={`relative p-3.5 rounded-xl border text-left transition-all ${selectedTopup === i ? 'border-amber-500/50 bg-amber-500/12' : 'border-white/8 bg-white/[0.02] hover:border-white/15'}`}>
              {pkg.popular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-bold whitespace-nowrap">
                  {zh ? '最划算' : 'BEST VALUE'}
                </div>
              )}
              <div className="text-[9px] text-gray-500 mb-1">{pkg.label}</div>
              <div className="text-amber-400 font-black">⬡ {pkg.coins.toLocaleString()}</div>
              {pkg.bonus > 0 && (
                <div className="text-[9px] text-green-400 mt-0.5">+{pkg.bonus}% {zh ? '赠送' : 'bonus'}</div>
              )}
              <div className="text-xs font-bold text-white mt-1.5">¥{pkg.amount}</div>
              {selectedTopup === i && <Check className="absolute top-2 right-2 w-3 h-3 text-amber-400" />}
            </motion.button>
          ))}
        </div>
        <Button onClick={handleTopup} disabled={selectedTopup === null || topping}
          className="mt-3 h-10 px-8 text-sm border-0 text-black font-bold"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
          {topping ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{zh ? '支付中...' : 'Processing...'}</>
            : topped ? <><Check className="w-4 h-4 mr-2" />{zh ? '充值成功！' : 'Success!'}</>
            : <><Coins className="w-4 h-4 mr-2" />{zh ? `立即充值 ¥${TOPUP_PACKAGES[selectedTopup!]?.amount}` : `Pay ¥${TOPUP_PACKAGES[selectedTopup!]?.amount}`}</>
          }
        </Button>
      </div>

      {/* Consumption guide */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
        <div className="text-xs font-semibold mb-3 text-gray-300">{zh ? '算力消耗参考' : 'Compute Cost Reference'}</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { name: zh ? 'AI脚本' : 'AI Script',   cost: '⬡ 50',  icon: 'SCR' },
            { name: zh ? 'AI配音/分钟' : 'AI Voice/min', cost: '⬡ 120', icon: 'MIC' },
            { name: zh ? 'AI形象视频' : 'AI Avatar',  cost: '⬡ 500', icon: 'VID' },
            { name: zh ? '账号报白' : 'Whitelist',   cost: '⬡ 200', icon: 'CHK' },
            { name: zh ? '合规审核' : 'Compliance',  cost: '⬡ 80',  icon: 'SHD' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-black/30 rounded-lg">
              <span className="text-base">{item.icon}</span>
              <div>
                <div className="text-[9px] text-gray-500">{item.name}</div>
                <div className="text-[10px] font-mono text-amber-400">{item.cost}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history toggle */}
      <button onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition py-1">
        <span className="flex items-center gap-2"><Receipt className="w-3.5 h-3.5" />{zh ? '交易记录' : 'Transaction History'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-1">
              {COIN_TRANSACTIONS.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tx.type === 'topup' ? 'bg-green-500/15' : tx.type === 'reward' ? 'bg-purple-500/15' : 'bg-red-500/10'}`}>
                      {tx.type === 'topup' ? <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" /> : tx.type === 'reward' ? <Sparkles className="w-3.5 h-3.5 text-purple-400" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    <div>
                      <div className="text-xs text-gray-300">{tx.desc}</div>
                      <div className="text-[9px] text-gray-600">{tx.date}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-mono font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab: 套餐管理 ────────────────────────────────────────────────────────────

const SubscriptionTab = ({ zh }: { zh: boolean }) => {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const PACKAGES = [
    {
      id: 'lite', name: 'Lite 轻享版', icon: 'LT',
      prices: { monthly: 1980, quarterly: 4980, annual: 16800 },
      color: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/25', glow: 'rgba(6,182,212,0.15)',
      features: { zh: ['1位明星合作', '2个报白账号', '基础切片素材库', 'AI脚本生成', 'GMV平台费 1.5%'], en: ['1 celebrity', '2 whitelisted accounts', 'Basic clip library', 'AI scripts', 'GMV fee 1.5%'] },
      limits: { celebrities: 1, accounts: 2 },
    },
    {
      id: 'pro', name: 'Pro 专业版', icon: 'PR',
      prices: { monthly: 5800, quarterly: 14800, annual: 52800 },
      color: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/25', glow: 'rgba(168,85,247,0.2)',
      features: { zh: ['3位明星合作', '5个报白账号', '全量切片素材库', 'AI脚本 + AI配音', 'GMV平台费 1.5%', '月赠星币 ⬡500'], en: ['3 celebrities', '5 whitelisted accounts', 'Full clip library', 'AI scripts + voice', 'GMV fee 1.5%', '⬡500 monthly bonus'] },
      limits: { celebrities: 3, accounts: 5 },
      recommended: true,
    },
    {
      id: 'elite', name: 'Elite 旗舰版', icon: 'EL',
      prices: { monthly: 16800, quarterly: 42000, annual: 138000 },
      color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/25', glow: 'rgba(245,158,11,0.2)',
      features: { zh: ['全部明星合作', '无限报白账号', '全量切片库', '全AI功能含形象视频', 'GMV平台费 1.0%（优惠）', '月赠星币 ⬡2000', '专属客服'], en: ['All celebrities', 'Unlimited accounts', 'Full clip library', 'Full AI incl. avatar video', 'GMV fee 1.0%', '⬡2000 monthly bonus', 'Dedicated support'] },
      limits: { celebrities: -1, accounts: -1 },
    },
  ];

  const PERIOD_LABELS = { monthly: zh ? '月度' : 'Monthly', quarterly: zh ? '季度 (85折)' : 'Quarterly (15% off)', annual: zh ? '年度 (68折)' : 'Annual (32% off)' };
  const PERIOD_DISCOUNT = { monthly: 1, quarterly: 0.84, annual: 0.68 };

  // Current active subscription mock
  const currentPkg = 'pro';

  const formatPrice = (base: number) => {
    if (period === 'monthly') return base;
    if (period === 'quarterly') return PACKAGES.find(p => true)?.prices.quarterly || base * 3 * 0.84;
    return base * 12 * 0.68;
  };

  return (
    <div className="space-y-5">
      {/* Current subscription banner */}
      <div className="flex items-center gap-3 bg-purple-500/8 border border-purple-500/25 rounded-xl p-3.5">
        <BadgeCheck className="w-5 h-5 text-purple-400 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-purple-300">{zh ? '当前套餐：Pro 专业版（月度）' : 'Current: Pro Monthly'}</div>
          <div className="text-[10px] text-gray-500">{zh ? '到期日：2025-06-01 · 自动续费开启' : 'Expires: 2025-06-01 · Auto-renew on'}</div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-purple-400 hover:bg-purple-500/10 h-7">
          {zh ? '管理' : 'Manage'} <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1 w-fit">
        {(Object.keys(PERIOD_LABELS) as Array<keyof typeof PERIOD_LABELS>).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${period === p ? 'bg-white text-black font-bold' : 'text-gray-500 hover:text-white'}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Package cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => {
          const price = pkg.prices[period];
          const isCurrent = pkg.id === currentPkg;
          return (
            <motion.div key={pkg.id} whileHover={{ y: -3 }}
              className={`relative p-5 rounded-2xl border ${pkg.bg} ${pkg.border} ${isCurrent ? 'ring-1 ring-current' : ''}`}
              style={isCurrent ? { boxShadow: `0 8px 30px ${pkg.glow}` } : {}}>
              {pkg.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] px-3 py-1 rounded-full bg-purple-500 text-white font-bold whitespace-nowrap">
                  {zh ? '✦ 推荐方案' : '✦ RECOMMENDED'}
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400">
                  {zh ? '当前套餐' : 'Current'}
                </div>
              )}
              <div className="text-2xl mb-2">{pkg.icon}</div>
              <div className={`text-sm font-bold ${pkg.color}`}>{pkg.name}</div>
              <div className="mt-3 mb-4">
                <span className="text-3xl font-black text-white">¥{price.toLocaleString()}</span>
                <span className="text-xs text-gray-500 ml-1">
                  /{period === 'monthly' ? (zh ? '月' : 'mo') : period === 'quarterly' ? (zh ? '季' : 'qtr') : (zh ? '年' : 'yr')}
                </span>
                {period !== 'monthly' && (
                  <div className="text-[10px] text-green-400 mt-0.5">
                    ≈ ¥{Math.round(price / (period === 'quarterly' ? 3 : 12)).toLocaleString()}/{zh ? '月' : 'mo'}
                  </div>
                )}
              </div>
              <div className="space-y-2 mb-5">
                {(zh ? pkg.features.zh : pkg.features.en).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-gray-300">
                    <Check className={`w-3 h-3 shrink-0 ${pkg.color}`} />{f}
                  </div>
                ))}
              </div>
              <Button disabled={isCurrent} className={`w-full h-9 text-xs border-0 ${isCurrent ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'text-white'}`}
                style={isCurrent ? {} : { background: `linear-gradient(135deg, ${pkg.glow.replace('0.', '0.8').replace('rgba', 'rgba')}, transparent)`, backgroundColor: pkg.bg.includes('amber') ? '#f59e0b' : pkg.bg.includes('purple') ? '#a855f7' : '#06b6d4' }}>
                {isCurrent ? (zh ? '当前套餐' : 'Current Plan') : (zh ? '切换到此套餐' : 'Switch to Plan')}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Monthly billing history */}
      <div>
        <div className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Receipt className="w-3.5 h-3.5 text-gray-400" />{zh ? '近期账单' : 'Recent Bills'}
        </div>
        <div className="space-y-2">
          {MONTHLY_BILLS.map(bill => (
            <div key={bill.month} className="flex items-center gap-4 p-3 bg-gray-900/40 border border-white/[0.05] rounded-xl hover:border-white/10 transition">
              <div className="w-16 text-xs text-gray-400 shrink-0">{bill.month}</div>
              <div className="flex-1 grid grid-cols-3 gap-2 text-[10px]">
                <div><span className="text-gray-600">{zh ? '套餐费' : 'Sub'} </span><span className="text-white">¥{bill.subscription.toLocaleString()}</span></div>
                <div><span className="text-gray-600">{zh ? '算力费' : 'Compute'} </span><span className="text-amber-400">⬡{bill.coinSpend.toLocaleString()}</span></div>
                <div><span className="text-gray-600">{zh ? 'GMV费' : 'GMV fee'} </span><span className="text-white">¥{bill.gmvFee.toLocaleString()}</span></div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-white">¥{bill.total.toLocaleString()}</div>
                <div className={`text-[9px] ${bill.status === 'current' ? 'text-amber-400' : 'text-green-400'}`}>
                  {bill.status === 'current' ? (zh ? '本月账单' : 'Current') : (zh ? '已结清' : 'Paid')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: GMV分成明细 ─────────────────────────────────────────────────────────

const GMVTab = ({ zh }: { zh: boolean }) => {
  const [filterMonth, setFilterMonth] = useState('2025-05');
  const months = ['2025-05', '2025-04', '2025-03'];
  const filtered = GMV_RECORDS.filter(r => r.month === filterMonth);
  const totalGMV = filtered.reduce((s, r) => s + r.gmv, 0);
  const totalFee = filtered.reduce((s, r) => s + r.platformFee, 0);

  const PLATFORM_ICONS: Record<string, string> = { '抖音': 'DY', '视频号': 'WX' };

  return (
    <div className="space-y-5">
      {/* Month selector */}
      <div className="flex gap-1.5">
        {months.map(m => (
          <button key={m} onClick={() => setFilterMonth(m)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${filterMonth === m ? 'bg-white/8 border-white/20 text-white' : 'border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-300'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: zh ? '月度总GMV' : 'Total GMV', val: `¥${(totalGMV / 10000).toFixed(0)}万`, color: 'text-white', bg: 'bg-white/[0.03]' },
          { label: zh ? '平台技术服务费 1.5%' : 'Platform fee 1.5%', val: `¥${totalFee.toLocaleString()}`, color: 'text-red-400', bg: 'bg-red-500/5' },
          { label: zh ? '净归MCN金额' : 'Net to MCN', val: `¥${((totalGMV - totalFee) / 10000).toFixed(0)}万`, color: 'text-green-400', bg: 'bg-green-500/5' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border border-white/[0.05] rounded-xl p-3 text-center`}>
            <div className={`text-lg font-black ${s.color}`}>{s.val}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* GMV table */}
      <div className="bg-gray-900/40 border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 px-4 py-2 border-b border-white/[0.05] text-[9px] text-gray-600 uppercase tracking-widest">
          {[zh ? '账号' : 'Account', zh ? '平台' : 'Platform', zh ? '明星' : 'Celebrity', zh ? 'GMV' : 'GMV', zh ? '平台服务费' : 'Fee'].map((h, i) => (
            <div key={i}>{h}</div>
          ))}
        </div>
        {filtered.map(r => (
          <div key={r.id} className="grid grid-cols-5 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition text-xs">
            <div className="text-gray-300 font-medium truncate">{r.account}</div>
            <div className="text-gray-400">{PLATFORM_ICONS[r.platform]} {r.platform}</div>
            <div className="text-gray-400">{r.celebrity}</div>
            <div className="text-white font-bold">¥{(r.gmv / 10000).toFixed(0)}万</div>
            <div className="text-red-400">-¥{r.platformFee.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: MCN分佣设置 ─────────────────────────────────────────────────────────

const MCNSplitTab = ({ zh }: { zh: boolean }) => {
  const [accounts, setAccounts] = useState(MCN_ACCOUNTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState(0);

  const handleSave = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, operatorShare: editVal, pendingShare: 100 - 1.5 - editVal } : a));
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-blue-500/6 border border-blue-500/20 rounded-xl p-3.5">
        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-300/80 leading-relaxed">
          {zh
            ? '分佣比例设置决定每个账号运营者从GMV中获得的收益。平台技术服务费固定为 1.5%（Elite套餐 1.0%），剩余部分由您作为MCN掌门人自由分配。明星方结算由平台内部处理，对账号不可见。'
            : 'Commission splits determine how much each account operator earns from GMV. Platform fee is fixed at 1.5% (1.0% for Elite). The rest is allocated by you as MCN head. Celebrity settlement is handled internally.'}
        </div>
      </div>

      {/* Split visualization */}
      <div className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4">
        <div className="text-xs font-semibold mb-3">{zh ? 'GMV分配结构示意' : 'GMV Distribution Structure'}</div>
        <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden">
          <div className="h-full flex items-center justify-center text-[9px] font-bold text-black bg-red-400 transition-all" style={{ width: '1.5%', minWidth: 28 }}>1.5%</div>
          <div className="h-full flex items-center justify-center text-[9px] font-bold text-black bg-amber-400 transition-all" style={{ width: '22%' }}>{zh ? '账号运营者' : 'Operator'}</div>
          <div className="h-full flex items-center justify-center text-[9px] text-gray-300 bg-gray-700/80 flex-1">{zh ? '明星方+MCN内部分配' : 'Celebrity + MCN (internal)'}</div>
        </div>
        <div className="flex gap-3 mt-2">
          {[{ color: 'bg-red-400', label: zh ? '平台技术服务费' : 'Platform fee', val: '1.5%' }, { color: 'bg-amber-400', label: zh ? '账号运营者分佣（可调）' : 'Operator share (adjustable)', val: '~20-25%' }, { color: 'bg-gray-700', label: zh ? '明星方+MCN（内部）' : 'Celebrity + MCN (internal)', val: '~73-78%' }].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
              <span className="text-[9px] text-gray-500">{item.label} {item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Account split table */}
      <div className="space-y-2">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{acc.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-gray-500 border border-white/8">{acc.platform}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{zh ? '授权明星：' : 'Celebrities: '}{acc.celebrities.join('、')}</div>
              </div>
              {editingId === acc.id ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={5} max={50} value={editVal} onChange={e => setEditVal(Number(e.target.value))}
                    className="w-16 h-7 bg-white/[0.05] border border-white/15 rounded-lg text-center text-xs text-white focus:outline-none" />
                  <span className="text-xs text-gray-500">%</span>
                  <button onClick={() => handleSave(acc.id)} className="text-[11px] px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-500 transition">
                    {zh ? '保存' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white transition">✕</button>
                </div>
              ) : (
                <button onClick={() => { setEditingId(acc.id); setEditVal(acc.operatorShare); }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/8 text-gray-400 hover:text-white hover:border-white/20 transition">
                  <Settings2 className="w-3 h-3" />{zh ? '调整分佣' : 'Edit Split'}
                </button>
              )}
            </div>

            {/* Split bars */}
            <div className="space-y-1.5">
              {[
                { label: zh ? '平台技术服务费' : 'Platform fee', pct: 1.5, color: 'bg-red-400' },
                { label: zh ? `账号运营者（${acc.name}）` : `Operator (${acc.name})`, pct: acc.operatorShare, color: 'bg-amber-400' },
                { label: zh ? '明星方+MCN内部分配' : 'Celebrity + MCN', pct: acc.pendingShare, color: 'bg-gray-600' },
              ].map((bar, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 text-[9px] text-gray-500 truncate shrink-0">{bar.label}</div>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className={`h-full rounded-full ${bar.color}`} animate={{ width: `${bar.pct}%` }} transition={{ duration: 0.4 }} />
                  </div>
                  <div className="w-10 text-right text-[10px] font-mono text-gray-300 shrink-0">{bar.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const BillingCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<BillingTab>('wallet');

  const TABS: { id: BillingTab; icon: React.ReactNode; zh: string; en: string }[] = [
    { id: 'wallet',       icon: <Coins className="w-3.5 h-3.5" />,    zh: '星币钱包',  en: 'Star Coins' },
    { id: 'subscription', icon: <Package className="w-3.5 h-3.5" />,  zh: '套餐管理',  en: 'Subscription' },
    { id: 'gmv',          icon: <TrendingUp className="w-3.5 h-3.5" />,zh: 'GMV分成',   en: 'GMV Share' },
    { id: 'mcn',          icon: <Users className="w-3.5 h-3.5" />,     zh: 'MCN分佣',   en: 'MCN Splits' },
  ];

  const stats = [
    { icon: <Coins className="w-4 h-4" />,     label: zh ? '星币余额' : 'SC Balance',   value: '⬡ 11,180', color: 'text-amber-400',  bg: 'bg-amber-500/8' },
    { icon: <Package className="w-4 h-4" />,   label: zh ? '当前套餐' : 'Current Plan',  value: 'Pro 专业版', color: 'text-purple-400', bg: 'bg-purple-500/8' },
    { icon: <TrendingUp className="w-4 h-4" />, label: zh ? '本月GMV' : 'Month GMV',    value: '¥393万',    color: 'text-green-400',  bg: 'bg-green-500/8' },
    { icon: <Receipt className="w-4 h-4" />,   label: zh ? '本月账单' : 'Month Bill',    value: '¥66,910',   color: 'text-white',      bg: 'bg-white/[0.03]' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            {zh ? '账单中心' : 'Billing Center'}
          </span>
          <Wallet className="w-5 h-5 text-amber-400" />
        </h1>
        <p className="text-gray-500 text-sm mt-1">{zh ? '星币钱包 · 套餐管理 · GMV分成明细 · MCN分佣设置' : 'Star coins · Subscriptions · GMV breakdown · MCN splits'}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.05] pb-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-amber-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.icon}{zh ? tab.zh : tab.en}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {activeTab === 'wallet'       && <WalletTab zh={zh} />}
          {activeTab === 'subscription' && <SubscriptionTab zh={zh} />}
          {activeTab === 'gmv'          && <GMVTab zh={zh} />}
          {activeTab === 'mcn'          && <MCNSplitTab zh={zh} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default BillingCenter;
