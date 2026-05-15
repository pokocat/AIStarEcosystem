"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ai-star-eco/ui/ui/dialog';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Badge } from '@ai-star-eco/ui/ui/badge';
import { Input } from '@ai-star-eco/ui/ui/input';
import { Label } from '@ai-star-eco/ui/ui/label';
import { Progress } from '@ai-star-eco/ui/ui/progress';
import { CheckCircle2, ShoppingBag, FileText, CreditCard, Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ArtistAvatar } from './producer/_shared/ArtistAvatar';

interface Artist {
  id: number;
  name: string;
  style: string;
  avatar: string;
  price: string;
  owner: string;
  songs: number;
  followers: string;
}

interface ArtistSigningDialogProps {
  artist: Artist | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (artist: Artist) => void;
  lang: 'zh' | 'en';
}

export default function ArtistSigningDialog({ artist, isOpen, onClose, onSuccess, lang }: ArtistSigningDialogProps) {
  const [step, setStep] = useState<'details' | 'contract' | 'payment' | 'success'>('details');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const t = {
    zh: {
      title: '艺人签约',
      step1: '查看详情',
      step2: '合同条款',
      step3: '支付确认',
      step4: '签约成功',
      artistInfo: '艺人信息',
      style: '音乐风格',
      works: '作品数',
      followers: '粉丝数',
      creator: '创建者',
      signingPrice: '签约价格',
      next: '下一步',
      back: '返回',
      contractTitle: '艺人签约合同',
      contractDesc: '请仔细阅读以下合同条款',
      terms: [
        '• 签约后，您将获得该艺人的独家运营权，包括音乐发行、商业合作等权益',
        '• 原创者将保留艺人的所有权，您作为运营方享有收益分成权',
        '• 收益分成比例：您 70% / 原创者 30%',
        '• 合同期限：永久（除非双方协商解约）',
        '• 您需遵守平台社区规范，不得从事违法违规活动',
        '• 平台保留最终解释权'
      ],
      agreeTerms: '我已阅读并同意上述条款',
      confirmContract: '确认并继续',
      paymentTitle: '支付确认',
      paymentDesc: '请确认支付信息',
      paymentMethod: '支付方式',
      walletBalance: '钱包余额',
      amount: '支付金额',
      confirmPayment: '确认支付',
      processing: '处理中...',
      successTitle: '签约成功！',
      successDesc: '恭喜！您已成功签约该艺人',
      artistAdded: '艺人已添加到您的阵容',
      startCreating: '开始创作',
      viewArtist: '查看艺人'
    },
    en: {
      title: 'Artist Signing',
      step1: 'Details',
      step2: 'Contract',
      step3: 'Payment',
      step4: 'Success',
      artistInfo: 'Artist Info',
      style: 'Style',
      works: 'Songs',
      followers: 'Followers',
      creator: 'Creator',
      signingPrice: 'Signing Price',
      next: 'Next',
      back: 'Back',
      contractTitle: 'Artist Signing Agreement',
      contractDesc: 'Please read the following terms carefully',
      terms: [
        '• Upon signing, you will obtain exclusive operation rights, including music distribution and commercial partnerships',
        '• The creator retains ownership, you as operator enjoy revenue sharing rights',
        '• Revenue split: You 70% / Creator 30%',
        '• Contract duration: Permanent (unless mutually agreed to terminate)',
        '• You must comply with platform community guidelines and refrain from illegal activities',
        '• Platform reserves the right of final interpretation'
      ],
      agreeTerms: 'I have read and agree to the terms above',
      confirmContract: 'Confirm & Continue',
      paymentTitle: 'Payment Confirmation',
      paymentDesc: 'Please confirm payment details',
      paymentMethod: 'Payment Method',
      walletBalance: 'Wallet Balance',
      amount: 'Amount',
      confirmPayment: 'Confirm Payment',
      processing: 'Processing...',
      successTitle: 'Signing Successful!',
      successDesc: 'Congratulations! You have successfully signed this artist',
      artistAdded: 'Artist added to your roster',
      startCreating: 'Start Creating',
      viewArtist: 'View Artist'
    }
  };

  const text = t[lang];

  const handleClose = () => {
    setStep('details');
    setAgreedToTerms(false);
    onClose();
  };

  const handleNextStep = () => {
    if (step === 'details') setStep('contract');
    else if (step === 'contract' && agreedToTerms) setStep('payment');
  };

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
      setTimeout(() => {
        if (artist) {
          onSuccess(artist);
          handleClose();
        }
      }, 2500);
    }, 2000);
  };

  if (!artist) return null;

  const steps = [
    { key: 'details', label: text.step1 },
    { key: 'contract', label: text.step2 },
    { key: 'payment', label: text.step3 },
    { key: 'success', label: text.step4 }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden">
        {/* Progress Steps */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    index <= currentStepIndex 
                      ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                      : 'bg-black border-white/20'
                  }`}>
                    {index < currentStepIndex ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${index <= currentStepIndex ? 'text-cyan-400' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? 'bg-cyan-500' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Details */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-8 pb-8"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-black">{text.artistInfo}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Artist Card */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
                  <div className="flex gap-6 p-6">
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden shrink-0">
                      <ArtistAvatar artist={artist} size="full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black text-white mb-2">{artist.name}</h3>
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-4">{artist.style}</Badge>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">{text.works}</div>
                          <div className="text-lg font-bold text-white">{artist.songs}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">{text.followers}</div>
                          <div className="text-lg font-bold text-cyan-400">{artist.followers}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="p-6 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">{text.signingPrice}</div>
                      <div className="text-3xl font-black text-cyan-400 font-mono">{artist.price}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 mb-1">{text.creator}</div>
                      <div className="text-sm font-medium text-gray-200">{artist.owner}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleClose} className="flex-1 h-12 border-white/10">
                    {text.back}
                  </Button>
                  <Button onClick={handleNextStep} className="flex-1 h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
                    {text.next} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Contract */}
          {step === 'contract' && (
            <motion.div
              key="contract"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-8 pb-8"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-black">{text.contractTitle}</DialogTitle>
                <p className="text-sm text-gray-400 mt-2">{text.contractDesc}</p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Contract Terms */}
                <div className="max-h-80 overflow-y-auto p-6 rounded-xl bg-black/40 border border-white/5 custom-scrollbar">
                  <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    {text.terms.map((term, index) => (
                      <p key={index}>{term}</p>
                    ))}
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-cyan-500 rounded"
                  />
                  <span className="text-sm text-gray-300">{text.agreeTerms}</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('details')} className="flex-1 h-12 border-white/10">
                    {text.back}
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={!agreedToTerms}
                    className="flex-1 h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {text.confirmContract}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-8 pb-8"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-black">{text.paymentTitle}</DialogTitle>
                <p className="text-sm text-gray-400 mt-2">{text.paymentDesc}</p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Payment Info */}
                <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                    <div className="text-sm text-gray-400 mb-1">{text.walletBalance}</div>
                    <div className="text-3xl font-black text-emerald-400 font-mono">¥ 125,890.00</div>
                  </div>

                  <div className="p-6 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-400">{text.signingPrice}</span>
                      <span className="text-2xl font-black text-white font-mono">{artist.price}</span>
                    </div>
                    <div className="h-px bg-white/10 my-4" />
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-white">{text.amount}</span>
                      <span className="text-2xl font-black text-cyan-400 font-mono">{artist.price}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('contract')} disabled={isProcessing} className="flex-1 h-12 border-white/10">
                    {text.back}
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        {text.processing}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        {text.confirmPayment}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="px-8 pb-8"
            >
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="relative mx-auto w-24 h-24 mb-8"
                >
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.5)]">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </motion.div>

                <h3 className="text-3xl font-black text-white mb-3">{text.successTitle}</h3>
                <p className="text-gray-400 mb-2">{text.successDesc}</p>
                <div className="flex items-center justify-center gap-2 mb-8">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">{text.artistAdded}</span>
                </div>

                {/* Artist Summary */}
                <div className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                  <ArtistAvatar artist={artist} size={64} className="rounded-xl" />
                  <div className="text-left">
                    <h4 className="text-lg font-bold text-white">{artist.name}</h4>
                    <p className="text-sm text-cyan-400">{artist.style}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
