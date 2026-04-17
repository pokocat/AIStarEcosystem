"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Coins, CheckCircle2, Wallet, Shield, Zap,
  Gift, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Rarity } from '@/types/_shared';
import {
  NFT_DIALOG_STRINGS as S,
  NFT_RARITY_CONFIG,
  RARITY_LABELS,
} from '@/constants/nft-dialog-ui';

interface NFTMintingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  track?: any;
}

export default function NFTMintingDialog({
  isOpen,
  onClose,
  onSuccess,
  track
}: NFTMintingDialogProps) {
  const [step, setStep] = useState<'config' | 'wallet' | 'minting' | 'success'>('config');
  const [collectionName, setCollectionName] = useState('');
  const [supply, setSupply] = useState('100');
  const [price, setPrice] = useState('0.05');
  const [royalty, setRoyalty] = useState('10');
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [enableAirdrop, setEnableAirdrop] = useState(false);
  const [mintProgress, setMintProgress] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);

  const handleConnectWallet = (_wallet: string) => {
    // Simulate wallet connection
    setTimeout(() => {
      setWalletConnected(true);
      setStep('config');
    }, 1000);
  };

  const mintingStageText = (progress: number): string => {
    const stageIdx = Math.min(Math.floor(progress / 20) + 1, 5);
    switch (stageIdx) {
      case 1: return S.mintingStage1;
      case 2: return S.mintingStage2;
      case 3: return S.mintingStage3;
      case 4: return S.mintingStage4;
      default: return S.mintingStage5;
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden max-h-[90vh]">
        <div className="px-8 pt-8 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Coins className="w-6 h-6 text-yellow-400" />
              </div>
              {S.title}
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">{S.subtitle}</p>
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
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{S.collectionName}</Label>
                  <Input
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder={S.collectionPlaceholder}
                    className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                  />
                </div>

                {/* Supply & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{S.supply}</Label>
                    <Input
                      type="number"
                      value={supply}
                      onChange={(e) => setSupply(e.target.value)}
                      className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                    />
                    <p className="text-xs text-gray-500">{S.supplyDesc}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{S.price}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                    />
                    <p className="text-xs text-gray-500">{S.priceDesc}</p>
                  </div>
                </div>

                {/* Royalty */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{S.royalty}</Label>
                  <Input
                    type="number"
                    value={royalty}
                    onChange={(e) => setRoyalty(e.target.value)}
                    className="bg-black/50 border-white/10 h-12 focus:border-yellow-500/50"
                  />
                  <p className="text-xs text-gray-500">{S.royaltyDesc}</p>
                </div>

                {/* Rarity Selection */}
                <div className="space-y-3">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{S.rarity}</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {(Object.keys(NFT_RARITY_CONFIG) as Rarity[]).map((r) => {
                      const config = NFT_RARITY_CONFIG[r];
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
                            {RARITY_LABELS[r]}
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
                    {S.perks}
                  </Label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{S.perkAirdrop}</div>
                          <div className="text-xs text-gray-500">{S.perkAirdropDesc}</div>
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
                      <span className="text-gray-400">{S.supply}</span>
                      <span className="font-bold text-white">{supply} NFTs</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{S.price}</span>
                      <span className="font-bold text-white">{price} ETH</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">{S.estGasFee}</span>
                      <span className="font-bold text-yellow-400">~0.003 ETH</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1 h-12 border-white/10">
                    {S.back}
                  </Button>
                  <Button
                    onClick={handleMint}
                    className="flex-1 h-12 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {walletConnected ? S.mint : S.connectMetaMask}
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
                  <h3 className="text-xl font-bold text-white mb-2">{S.walletTitle}</h3>
                  <p className="text-gray-400 text-sm">{S.walletDesc}</p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => handleConnectWallet('metamask')}
                    className="w-full h-14 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                      <Wallet className="w-5 h-5" />
                    </div>
                    {S.connectMetaMask}
                  </Button>

                  <Button
                    onClick={() => handleConnectWallet('walletconnect')}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    {S.connectWalletConnect}
                  </Button>

                  <Button
                    onClick={() => handleConnectWallet('coinbase')}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 justify-start"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3">
                      <Coins className="w-5 h-5 text-blue-400" />
                    </div>
                    {S.connectCoinbase}
                  </Button>
                </div>

                <Button variant="outline" onClick={() => setStep('config')} className="w-full h-12 border-white/10">
                  {S.back}
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
                  <h3 className="text-2xl font-black text-white mb-2">{S.minting}</h3>
                  <p className="text-gray-400">{mintingStageText(mintProgress)}</p>
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
                    <span className="text-gray-500">{S.mintProgressLabel}</span>
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
                  <h3 className="text-3xl font-black text-white mb-3">{S.success}</h3>
                  <p className="text-gray-400">{S.successDesc}</p>
                </div>

                {/* NFT Info */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{S.contractAddress}</span>
                    <span className="font-mono text-emerald-400 text-xs">0x7a...b3f2</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{S.tokenId}</span>
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
                    {S.viewOnMarket}
                  </Button>
                  <Button
                    onClick={() => setStep('config')}
                    variant="outline"
                    className="h-12 border-white/10"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {S.mintAnother}
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
