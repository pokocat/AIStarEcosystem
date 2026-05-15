"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ai-star-eco/ui/ui/dialog';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Badge } from '@ai-star-eco/ui/ui/badge';
import { Input } from '@ai-star-eco/ui/ui/input';
import { Label } from '@ai-star-eco/ui/ui/label';
import { Textarea } from '@ai-star-eco/ui/ui/textarea';
import { Switch } from '@ai-star-eco/ui/ui/switch';
import { Globe2, TrendingUp, CheckCircle2, Sparkles, DollarSign, Users, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ArtistAvatar } from './producer/_shared/ArtistAvatar';

interface Artist {
  id: number;
  name: string;
  style: string;
  avatar: string;
}

interface ArtistListingDialogProps {
  artist: Artist | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang: 'zh' | 'en';
}

export default function ArtistListingDialog({ artist, isOpen, onClose, onSuccess, lang }: ArtistListingDialogProps) {
  const [price, setPrice] = useState('8800');
  const [description, setDescription] = useState('');
  const [enableAutoReply, setEnableAutoReply] = useState(true);
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [isProcessing, setIsProcessing] = useState(false);

  const t = {
    zh: {
      title: '发布艺人到市场',
      formTitle: '发布设置',
      previewTitle: '发布预览',
      successTitle: '发布成功！',
      artistInfo: '艺人信息',
      pricingTitle: '定价设置',
      price: '签约价格',
      priceHint: '建议价格范围: ¥5,000 - ¥15,000',
      description: '艺人简介',
      descriptionPlaceholder: '介绍这位AI歌手的特点、风格、适合的音乐类型等...',
      settings: '市场设置',
      autoReply: '自动回复询价',
      autoReplyDesc: '当有人咨询时自动发送预设消息',
      preview: '预览发布',
      back: '返回',
      publish: '确认发布',
      processing: '发布中...',
      successDesc: '您的艺人已成功发布到市场',
      marketStats: '预估数据',
      estimatedViews: '预估浏览量',
      estimatedInquiries: '预估询价数',
      viewListing: '查看发布',
      createAnother: '继续发布',
      splitInfo: '收益分成',
      splitDesc: '您将获得签约费的 80%，平台收取 20% 服务费',
      youEarn: '您的收益',
      platformFee: '平台服务费'
    },
    en: {
      title: 'List Artist to Market',
      formTitle: 'Listing Setup',
      previewTitle: 'Listing Preview',
      successTitle: 'Successfully Listed!',
      artistInfo: 'Artist Info',
      pricingTitle: 'Pricing',
      price: 'Signing Price',
      priceHint: 'Suggested range: ¥5,000 - ¥15,000',
      description: 'Artist Description',
      descriptionPlaceholder: 'Describe this AI artist\'s characteristics, style, suitable music types, etc...',
      settings: 'Market Settings',
      autoReply: 'Auto-reply to Inquiries',
      autoReplyDesc: 'Automatically send preset message when inquired',
      preview: 'Preview Listing',
      back: 'Back',
      publish: 'Confirm & Publish',
      processing: 'Publishing...',
      successDesc: 'Your artist has been successfully listed on the market',
      marketStats: 'Estimated Stats',
      estimatedViews: 'Est. Views',
      estimatedInquiries: 'Est. Inquiries',
      viewListing: 'View Listing',
      createAnother: 'List Another',
      splitInfo: 'Revenue Split',
      splitDesc: 'You receive 80% of signing fees, platform takes 20% service fee',
      youEarn: 'Your Earnings',
      platformFee: 'Platform Fee'
    }
  };

  const text = t[lang];

  const handleClose = () => {
    setStep('form');
    setPrice('8800');
    setDescription('');
    onClose();
  };

  const handlePublish = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2500);
    }, 2000);
  };

  if (!artist) return null;

  const calculatedSplit = {
    total: parseInt(price) || 0,
    yourEarnings: Math.floor((parseInt(price) || 0) * 0.8),
    platformFee: Math.floor((parseInt(price) || 0) * 0.2)
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-3xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden max-h-[90vh]">
        <div className="px-8 pt-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Globe2 className="w-6 h-6 text-emerald-400" />
              </div>
              {text.title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <AnimatePresence mode="wait">
          {/* Form Step */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-8 pb-8 overflow-y-auto max-h-[calc(90vh-120px)]"
            >
              <div className="space-y-6">
                {/* Artist Info */}
                <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 flex items-center gap-4">
                  <ArtistAvatar artist={artist} size={80} className="rounded-xl" />
                  <div>
                    <h4 className="text-xl font-bold text-white mb-1">{artist.name}</h4>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">{artist.style}</Badge>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {text.pricingTitle}
                  </h4>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.price}</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-gray-400 text-lg font-mono">¥</span>
                      <Input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="bg-black/50 border-white/10 h-14 pl-10 text-xl font-mono focus:border-emerald-500/50"
                        placeholder="8800"
                      />
                    </div>
                    <p className="text-xs text-gray-500">{text.priceHint}</p>
                  </div>

                  {/* Revenue Split Info */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{text.youEarn}</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        ¥ {calculatedSplit.yourEarnings.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{text.platformFee} (20%)</span>
                      <span className="text-lg font-bold text-gray-500 font-mono">
                        ¥ {calculatedSplit.platformFee.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.description}</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={text.descriptionPlaceholder}
                    className="bg-black/50 border-white/10 h-32 resize-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{text.settings}</h4>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">{text.autoReply}</div>
                      <div className="text-xs text-gray-500">{text.autoReplyDesc}</div>
                    </div>
                    <Switch
                      checked={enableAutoReply}
                      onCheckedChange={setEnableAutoReply}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1 h-12 border-white/10"
                  >
                    {text.back}
                  </Button>
                  <Button
                    onClick={() => setStep('preview')}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {text.preview}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-8 pb-8"
            >
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
                  <div className="flex items-center gap-2 mb-4 text-sm text-emerald-400">
                    <Eye className="w-4 h-4" />
                    <span className="font-bold">{text.previewTitle}</span>
                  </div>
                  
                  {/* Preview Card */}
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0c0c0e]">
                    <div className="relative h-48">
                      <ArtistAvatar artist={artist} size="full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      <Badge className="absolute top-3 right-3 bg-cyan-500/80 text-white border-0 shadow-lg">
                        {lang === 'zh' ? '可签约' : 'Available'}
                      </Badge>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl font-black text-white mb-1">{artist.name}</h3>
                        <p className="text-xs text-cyan-400 font-mono">{artist.style}</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {description && (
                        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
                      )}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                        <span className="text-xs text-gray-400">{text.price}</span>
                        <span className="text-xl font-black text-cyan-400 font-mono">¥ {parseInt(price).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Stats */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                      <div className="text-xs text-gray-500 mb-1">{text.estimatedViews}</div>
                      <div className="text-lg font-bold text-cyan-400">800-1,200</div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                      <div className="text-xs text-gray-500 mb-1">{text.estimatedInquiries}</div>
                      <div className="text-lg font-bold text-purple-400">5-10</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('form')}
                    className="flex-1 h-12 border-white/10"
                    disabled={isProcessing}
                  >
                    {text.back}
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={isProcessing}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        {text.processing}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        {text.publish}
                      </>
                    )}
                  </Button>
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
                <p className="text-gray-400 mb-8">{text.successDesc}</p>

                {/* Success Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                    <Globe2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400">Listed</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                    <TrendingUp className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400">Promoted</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                    <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <div className="text-xs text-gray-400">Visible</div>
                  </div>
                </div>

                {/* Artist Summary */}
                <div className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mb-8">
                  <ArtistAvatar artist={artist} size={64} className="rounded-xl" />
                  <div className="text-left">
                    <h4 className="text-lg font-bold text-white">{artist.name}</h4>
                    <p className="text-sm text-cyan-400">¥ {parseInt(price).toLocaleString()}</p>
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
