"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select } from './ui/select';
import { Switch } from './ui/switch';
import { 
  Coins, Sparkles, CheckCircle2, Wallet, Shield, Zap,
  Gift, Crown, Star, TrendingUp, Users, AlertCircle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NFTMintingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang: 'zh' | 'en';
  track?: any;
}

export default function NFTMintingDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  lang,
  track 
}: NFTMintingDialogProps) {
  const [step, setStep] = useState<'config' | 'wallet' | 'minting' | 'success'>('config');
  const [collectionName, setCollectionName] = useState('');
  const [supply, setSupply] = useState('100');
  const [price, setPrice] = useState('0.05');
  const [royalty, setRoyalty] = useState('10');
  const [rarity, setRarity] = useState<'common' | 'rare' | 'epic' | 'legendary'>('rare');
  const [enableAirdrop, setEnableAirdrop] = useState(false);
  const [mintProgress, setMintProgress] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);

  const t = {
    zh: {
      title: 'NFT 铸造',
      subtitle: '将你的音乐铸造为链上资产',
      step1: '配置 NFT',
      step2: '连接钱包',
      step3: '铸造中',
      step4: '铸造成功',
      collectionName: '合集名称',
      collectionPlaceholder: '例如：Neon Dreams Collection',
      supply: '发行数量',
      supplyDesc: '限量发行，售完即止',
      price: '铸造价格 (ETH)',
      priceDesc: '每个 NFT 的售价',
      royalty: '版税比例 (%)',
      royaltyDesc: '二级市场交易时的创作者分成',
      rarity: '稀有度',
      rarityCommon: '普通',
      rarityRare: '稀有',
      rarityEpic: '史诗',
      rarityLegendary: '传说',
      perks: '持有者权益',
      perkAirdrop: '未来空投',
      perkAirdropDesc: '自动获得新作品空投',
      perkAccess: '独家访问',
      perkAccessDesc: '访问私密社群和内容',
      perkMeetup: '线下见面会',
      perkMeetupDesc: '优先参与线下活动',
      walletTitle: '连接 Web3 钱包',
      walletDesc: '请连接你的钱包以完成铸造',
      connectMetaMask: '连接 MetaMask',
      connectWalletConnect: '连接 WalletConnect',
      connectCoinbase: '连接 Coinbase Wallet',
      walletConnected: '钱包已连接',
      walletAddress: '钱包地址',
      balance: '余额',
      networkFee: '网络费用（Gas）',
      total: '总计',
      minting: '铸造中...',
      mintingStage1: '准备链上交易',
      mintingStage2: '上传元数据到 IPFS',
      mintingStage3: '调用智能合约',
      mintingStage4: '等待区块确认',
      mintingStage5: '铸造完成',
      success: '铸造成功！',
      successDesc: '你的 NFT 已成功上链',
      viewOnMarket: '前往市场',
      shareNFT: '分享 NFT',
      mintAnother: '继续铸造',
      back: '返回',
      next: '下一步',
      mint: '确认铸造',
      estGasFee: '预计 Gas 费',
      contractAddress: '合约地址',
      tokenId: 'Token ID'
    },
    en: {
      title: 'NFT Minting',
      subtitle: 'Mint your music as on-chain assets',
      step1: 'Configure NFT',
      step2: 'Connect Wallet',
      step3: 'Minting',
      step4: 'Success',
      collectionName: 'Collection Name',
      collectionPlaceholder: 'e.g., Neon Dreams Collection',
      supply: 'Supply',
      supplyDesc: 'Limited edition, sold out means sold out',
      price: 'Mint Price (ETH)',
      priceDesc: 'Price per NFT',
      royalty: 'Royalty (%)',
      royaltyDesc: 'Creator earnings from secondary sales',
      rarity: 'Rarity',
      rarityCommon: 'Common',
      rarityRare: 'Rare',
      rarityEpic: 'Epic',
      rarityLegendary: 'Legendary',
      perks: 'Holder Perks',
      perkAirdrop: 'Future Airdrops',
      perkAirdropDesc: 'Auto-receive new releases',
      perkAccess: 'Exclusive Access',
      perkAccessDesc: 'Access private community & content',
      perkMeetup: 'Meetups',
      perkMeetupDesc: 'Priority for offline events',
      walletTitle: 'Connect Web3 Wallet',
      walletDesc: 'Connect your wallet to complete minting',
      connectMetaMask: 'Connect MetaMask',
      connectWalletConnect: 'Connect WalletConnect',
      connectCoinbase: 'Connect Coinbase Wallet',
      walletConnected: 'Wallet Connected',
      walletAddress: 'Wallet Address',
      balance: 'Balance',
      networkFee: 'Network Fee (Gas)',
      total: 'Total',
      minting: 'Minting...',
      mintingStage1: 'Preparing transaction',
      mintingStage2: 'Uploading metadata to IPFS',
      mintingStage3: 'Calling smart contract',
      mintingStage4: 'Waiting for confirmation',
      mintingStage5: 'Mint complete',
      success: 'Minting Successful!',
      successDesc: 'Your NFT is now on-chain',
      viewOnMarket: 'View on Market',
      shareNFT: 'Share NFT',
      mintAnother: 'Mint Another',
      back: 'Back',
      next: 'Next',
      mint: 'Confirm Mint',
      estGasFee: 'Est. Gas Fee',
      contractAddress: 'Contract Address',
      tokenId: 'Token ID'
    }
  };

  const text = t[lang];

  const rarityConfig = {
    common: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: Star },
    rare: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Sparkles },
    epic: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: Crown },
    legendary: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Zap }
  };

  const handleConnectWallet = (wallet: string) => {
    // Simulate wallet connection
    setTimeout(() => {
      setWalletConnected(true);
      setStep('config');
    }, 1000);
  };

  const handleMint = () => {
    if (!walletConnected) {
      setStep('wallet');
      return;
    }

    setStep('minting');
    setMintProgress(0);

    const stages = [
      { progress: 20, duration: 1500 },
      { progress: 40, duration: 2000 },
      { progress: 60, duration: 2500 },
      { progress: 80, duration: 2000 },
      { progress: 100, duration: 1000 }
    ];

    let currentStage = 0;

    const runStage = () => {
      if (currentStage >= stages.length) {
        setStep('success');
        return;
      }

      const stage = stages[currentStage];
      setTimeout(() => {
        setMintProgress(stage.progress);
        currentStage++;
        runStage();
      }, stage.duration);
    };

    runStage();
  };

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  const RarityIcon = rarityConfig[rarity].icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden max-h-[90vh]">
        <div className="px-8 pt-8 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Coins className="w-6 h-6 text-yellow-400" />
              </div>
              {text.title}
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">{text.subtitle}</p>
          </DialogHeader>
        </div>

        <AnimatePresence mode="wait">
          {/* Config Step */}
          {step === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8 overflow-y-auto max-h-[calc(90vh-140px)]"
            >
              <div className="space-y-6">
                {/* Track Info */}
                {track && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Coins className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white mb-1">{track.title}</div>
                      <div className="text-xs text-gray-400">{track.style} • {track.duration}</div>
                    </div>
                  </div>
                )}

                {/* Collection Name */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.collectionName}</Label>
                  <Input
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder={text.collectionPlaceholder}
                    className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                  />
                </div>

                {/* Supply & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.supply}</Label>
                    <Input
                      type="number"
                      value={supply}
                      onChange={(e) => setSupply(e.target.value)}
                      className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                    />
                    <p className="text-xs text-gray-500">{text.supplyDesc}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.price}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                    />
                    <p className="text-xs text-gray-500">{text.priceDesc}</p>
                  </div>
                </div>

                {/* Royalty */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.royalty}</Label>
                  <Input
                    type="number"
                    value={royalty}
                    onChange={(e) => setRoyalty(e.target.value)}
                    className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                  />
                  <p className="text-xs text-gray-500">{text.royaltyDesc}</p>
                </div>

                {/* Rarity Selection */}
                <div className="space-y-3">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.rarity}</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {(['common', 'rare', 'epic', 'legendary'] as const).map((r) => {
                      const config = rarityConfig[r];
                      const Icon = config.icon;
                      const isSelected = rarity === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setRarity(r)}
                          className={`p-4 rounded-xl border transition-all ${
                            isSelected
                              ? `${config.bg} ${config.border} border-2`
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? config.color : 'text-gray-500'}`} />
                          <div className={`text-xs font-bold ${isSelected ? config.color : 'text-gray-400'}`}>
                            {text[`rarity${r.charAt(0).toUpperCase() + r.slice(1)}` as keyof typeof text]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Holder Perks */}
                <div className="space-y-3">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    {text.perks}
                  </Label>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{text.perkAirdrop}</div>
                          <div className="text-xs text-gray-500">{text.perkAirdropDesc}</div>
                        </div>
                      </div>
                      <Switch checked={enableAirdrop} onCheckedChange={setEnableAirdrop} />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{text.supply}</span>
                      <span className="font-bold text-white">{supply} NFTs</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{text.price}</span>
                      <span className="font-bold text-white">{price} ETH</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">{text.estGasFee}</span>
                      <span className="font-bold text-yellow-400">~0.003 ETH</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1 h-12 border-white/10">
                    {text.back}
                  </Button>
                  <Button
                    onClick={handleMint}
                    className="flex-1 h-12 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {walletConnected ? text.mint : text.connectMetaMask}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Wallet Connection Step */}
          {step === 'wallet' && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8"
            >
              <div className="space-y-6 py-8">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{text.walletTitle}</h3>
                  <p className="text-gray-400 text-sm">{text.walletDesc}</p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => handleConnectWallet('metamask')}
                    className="w-full h-14 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                      <Wallet className="w-5 h-5" />
                    </div>
                    {text.connectMetaMask}
                  </Button>

                  <Button
                    onClick={() => handleConnectWallet('walletconnect')}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    {text.connectWalletConnect}
                  </Button>

                  <Button
                    onClick={() => handleConnectWallet('coinbase')}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3">
                      <Coins className="w-5 h-5 text-blue-400" />
                    </div>
                    {text.connectCoinbase}
                  </Button>
                </div>

                <Button variant="outline" onClick={() => setStep('config')} className="w-full h-12 border-white/10">
                  {text.back}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Minting Step */}
          {step === 'minting' && (
            <motion.div
              key="minting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-8 pb-8"
            >
              <div className="py-12 space-y-8">
                <div className="relative mx-auto w-32 h-32">
                  <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Coins className="w-16 h-16 text-yellow-400" />
                    </motion.div>
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="text-2xl font-black text-white mb-2">{text.minting}</h3>
                  <p className="text-gray-400">{text[`mintingStage${Math.min(Math.floor(mintProgress / 20) + 1, 5)}` as keyof typeof text]}</p>
                </div>

                <div className="space-y-3">
                  <motion.div 
                    className="h-2 bg-white/5 rounded-full overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${mintProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </motion.div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">铸造进度</span>
                    <span className="text-yellow-400 font-mono font-bold">{mintProgress}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-8 pb-8"
            >
              <div className="text-center py-12 space-y-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="relative mx-auto w-24 h-24"
                >
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </motion.div>

                <div>
                  <h3 className="text-3xl font-black text-white mb-3">{text.success}</h3>
                  <p className="text-gray-400">{text.successDesc}</p>
                </div>

                {/* NFT Info */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{text.contractAddress}</span>
                    <span className="font-mono text-emerald-400 text-xs">0x7a...b3f2</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{text.tokenId}</span>
                    <span className="font-mono text-cyan-400">#1234</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleSuccess}
                    className="h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    {text.viewOnMarket}
                  </Button>
                  <Button
                    onClick={() => setStep('config')}
                    variant="outline"
                    className="h-12 border-white/10"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {text.mintAnother}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
