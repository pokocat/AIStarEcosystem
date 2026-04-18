"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Sparkles, Smile, Music, Hand, ArrowLeft,
  Play, Save, Share2, Eye, Wand2, Download
} from 'lucide-react';
import type { Pose, Expression, Gesture } from "@/types/pose";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";
import { PoseApi, StoreApi } from "@/api";
import type { StoreItemType } from "@/api/store";
import { POSE_DIFFICULTY_COLORS, POSE_CATEGORY_OPTIONS } from "@/constants/pose-ui";

interface PoseLibraryProps {
  lang: 'zh' | 'en';
  onBack: () => void;
  activeSinger: any;
}

export function PoseLibrary({ lang, onBack, activeSinger }: PoseLibraryProps) {
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);
  const [selectedExpression, setSelectedExpression] = useState<Expression | null>(null);
  const [selectedGesture, setSelectedGesture] = useState<string | null>(null);
  const [customIntensity, setCustomIntensity] = useState(80);

  const [poseDatabase, setPoseDatabase] = useState<Pose[]>(POSE_DATABASE);
  const [expressionDatabase, setExpressionDatabase] = useState<Expression[]>(EXPRESSION_DATABASE);
  const [gestureDatabase, setGestureDatabase] = useState<Gesture[]>(GESTURE_DATABASE);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  type OwnedLike = { id: string; saleStatus?: string; priceCredits?: number; owned?: boolean; name: string };
  const requiresPurchase = (item: OwnedLike): boolean =>
    (item.saleStatus ?? "FREE") === "PAID" && !item.owned && (item.priceCredits ?? 0) > 0;

  async function tryRedeem<T extends OwnedLike>(
    item: T,
    type: StoreItemType,
    setList: React.Dispatch<React.SetStateAction<T[]>>,
  ): Promise<boolean> {
    if (!requiresPurchase(item)) return true;
    const confirmed = typeof window !== "undefined"
      ? window.confirm(`购买「${item.name}」需消耗 ${item.priceCredits} 积分，确定？`)
      : true;
    if (!confirmed) return false;
    setPurchasing(item.id);
    try {
      await StoreApi.redeem(type, item.id);
      setList(prev => prev.map(p => (p.id === item.id ? { ...p, owned: true } : p)));
      setToast({ type: "ok", msg: `已购买：${item.name}` });
      return true;
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "购买失败" });
      return false;
    } finally {
      setPurchasing(null);
      setTimeout(() => setToast(null), 2500);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      PoseApi.listPoses().catch(() => [] as Pose[]),
      PoseApi.listExpressions().catch(() => [] as Expression[]),
      PoseApi.listGestures().catch(() => [] as Gesture[]),
    ]).then(([p, e, g]) => {
      if (cancelled) return;
      if (p.length > 0) setPoseDatabase(p);
      if (e.length > 0) setExpressionDatabase(e);
      if (g.length > 0) setGestureDatabase(g);
    });
    return () => { cancelled = true; };
  }, []);
  const poseCategories = POSE_CATEGORY_OPTIONS.map(opt => ({
    ...opt,
    count: poseDatabase.filter(p => p.category === opt.id).length,
  }));
  const difficultyColors = POSE_DIFFICULTY_COLORS;

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {toast && (
        <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-bold border ${
          toast.type === "ok"
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>{toast.msg}</div>
      )}
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Sparkles className="w-3 h-3"/> {lang === 'zh' ? '动作捕捉系统' : 'Motion Capture'}
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? '姿态动作库' : 'Pose & Motion Library'}</h2>
          <p className="text-gray-400 text-sm">{lang === 'zh' ? '30+预设姿态，自定义表情和手势' : '30+ preset poses, custom expressions and gestures'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5 h-10 px-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {lang === 'zh' ? '返回' : 'Back'}
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="poses" className="h-full flex flex-col">
          {/* Tab切换 */}
          <TabsList className="bg-black/60 border border-white/5 w-full rounded-xl p-1.5 gap-1.5 mb-6 flex-wrap justify-start h-auto">
            <TabsTrigger value="poses" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 flex items-center gap-2 px-4 py-2">
              <Music className="w-4 h-4" />
              {lang === 'zh' ? '姿态库' : 'Poses'}
            </TabsTrigger>
            <TabsTrigger value="expressions" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 flex items-center gap-2 px-4 py-2">
              <Smile className="w-4 h-4" />
              {lang === 'zh' ? '表情' : 'Expressions'}
            </TabsTrigger>
            <TabsTrigger value="gestures" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center gap-2 px-4 py-2">
              <Hand className="w-4 h-4" />
              {lang === 'zh' ? '手势' : 'Gestures'}
            </TabsTrigger>
            <TabsTrigger value="custom" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 flex items-center gap-2 px-4 py-2">
              <Wand2 className="w-4 h-4" />
              {lang === 'zh' ? '自定义' : 'Custom'}
            </TabsTrigger>
          </TabsList>

          {/* 姿态库 */}
          <TabsContent value="poses" className="flex-1 overflow-hidden mt-0 grid lg:grid-cols-12 gap-6">
            {/* 左侧列表 */}
            <div className="lg:col-span-7 space-y-4 overflow-hidden flex flex-col">
              {/* 分类筛选 */}
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {poseCategories.map(cat => (
                  <Button
                    key={cat.id}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 border-white/10 hover:bg-white/5"
                  >
                    {cat.label}
                    <Badge variant="outline" className="ml-2 text-xs border-white/20">{cat.count}</Badge>
                  </Button>
                ))}
              </div>

              {/* 姿态网格 */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4">
                  {poseDatabase.map((pose, index) => (
                    <motion.div
                      key={pose.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card
                        className={`relative bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer group overflow-hidden ${
                          selectedPose?.id === pose.id ? 'ring-2 ring-cyan-500/50' : ''
                        } ${pose.isLocked || pose.saleStatus === "LOCKED" ? 'opacity-50' : ''}`}
                        onClick={async () => {
                          if (pose.isLocked || pose.saleStatus === "LOCKED") return;
                          const ok = await tryRedeem(pose, "POSE", setPoseDatabase);
                          if (ok) setSelectedPose(pose);
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="relative aspect-square overflow-hidden">
                            <img src={pose.thumbnail} alt={pose.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                            
                            {/* 标签 */}
                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                              <div className="flex flex-col gap-1">
                                {pose.isNew && (
                                  <Badge className="bg-green-500/80 text-white text-xs border-0 font-bold">NEW</Badge>
                                )}
                                <Badge variant="outline" className={`text-xs ${difficultyColors[pose.difficulty]}`}>
                                  {pose.difficulty.toUpperCase()}
                                </Badge>
                              </div>
                              {pose.isLocked && (
                                <div className="bg-black/60 backdrop-blur-sm p-2 rounded-lg">
                                  <Sparkles className="w-4 h-4 text-yellow-400" />
                                </div>
                              )}
                            </div>

                            {/* 播放按钮 */}
                            {selectedPose?.id === pose.id && !pose.isLocked && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div className="bg-cyan-500/90 text-white rounded-full p-4 shadow-lg animate-pulse">
                                  <Play className="w-6 h-6" />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-bold text-sm text-white line-clamp-1">{pose.name}</h4>
                              <span className="text-xs font-mono">
                                {pose.owned ? (
                                  <span className="text-green-400">{lang === 'zh' ? '已拥有' : 'Owned'}</span>
                                ) : (pose.saleStatus ?? 'FREE') === 'PAID' && (pose.priceCredits ?? 0) > 0 ? (
                                  <span className="text-yellow-400">{pose.priceCredits}⭐</span>
                                ) : (
                                  <span className="text-cyan-300">{lang === 'zh' ? '免费' : 'Free'}</span>
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 capitalize">{pose.category}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧预览 */}
            <div className="lg:col-span-5 bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
              
              {selectedPose ? (
                <>
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-purple-500 rounded-3xl blur-3xl opacity-20" />
                    <div className="relative w-72 h-72 rounded-3xl overflow-hidden border-2 border-white/20">
                      <img src={selectedPose.thumbnail} alt={selectedPose.name} className="w-full h-full object-cover" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-white mb-2">{selectedPose.name}</h3>
                  <p className="text-cyan-400 text-sm mb-6 capitalize">{selectedPose.category} • {selectedPose.difficulty}</p>

                  <div className="w-full space-y-3">
                    <Button className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold">
                      <Play className="w-4 h-4 mr-2" />
                      {lang === 'zh' ? '应用姿态' : 'Apply Pose'}
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="border-white/10 hover:bg-white/5">
                        <Save className="w-4 h-4 mr-2" />
                        {lang === 'zh' ? '收藏' : 'Save'}
                      </Button>
                      <Button variant="outline" className="border-white/10 hover:bg-white/5">
                        <Share2 className="w-4 h-4 mr-2" />
                        {lang === 'zh' ? '分享' : 'Share'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                    <Eye className="w-12 h-12 text-cyan-400/50" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{lang === 'zh' ? '选择姿态' : 'Select a Pose'}</h3>
                  <p className="text-sm text-gray-400">{lang === 'zh' ? '点击左侧姿态查看详情' : 'Click a pose on the left to preview'}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 表情库 */}
          <TabsContent value="expressions" className="flex-1 overflow-y-auto custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto space-y-6">
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle>{lang === 'zh' ? '表情选择器' : 'Expression Selector'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {expressionDatabase.map((expr) => (
                      <motion.div
                        key={expr.id}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (expr.saleStatus === "LOCKED") return;
                          const ok = await tryRedeem(expr, "EXPRESSION", setExpressionDatabase);
                          if (ok) setSelectedExpression(expr);
                        }}
                        className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                          selectedExpression?.id === expr.id
                            ? 'bg-pink-500/20 border-pink-500/50 shadow-lg shadow-pink-500/20'
                            : 'bg-black/40 border-white/10 hover:border-pink-500/30'
                        } ${expr.saleStatus === "LOCKED" ? 'opacity-50' : ''}`}
                      >
                        <div className="text-5xl mb-2">{expr.emoji}</div>
                        <div className="text-xs font-bold text-white">{expr.name}</div>
                        {expr.owned ? (
                          <div className="text-[10px] text-green-400 mt-1">{lang === 'zh' ? '已拥有' : 'Owned'}</div>
                        ) : (expr.saleStatus ?? 'FREE') === 'PAID' && (expr.priceCredits ?? 0) > 0 ? (
                          <div className="text-[10px] text-yellow-400 mt-1">{expr.priceCredits}⭐</div>
                        ) : null}
                      </motion.div>
                    ))}
                  </div>

                  {selectedExpression && (
                    <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-pink-900/20 to-purple-900/20 border border-pink-500/20">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="text-lg font-bold text-white mb-1">{selectedExpression.name}</h4>
                          <p className="text-sm text-gray-400">{lang === 'zh' ? '强度调节' : 'Intensity'}: {customIntensity}%</p>
                        </div>
                        <div className="text-6xl">{selectedExpression.emoji}</div>
                      </div>

                      <div className="space-y-4">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={customIntensity}
                          onChange={(e) => setCustomIntensity(parseInt(e.target.value))}
                          className="w-full accent-pink-500 h-3 bg-gray-800 rounded-lg"
                        />
                        <Button className="w-full h-12 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold">
                          <Sparkles className="w-4 h-4 mr-2" />
                          {lang === 'zh' ? '应用表情' : 'Apply Expression'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 手势库 */}
          <TabsContent value="gestures" className="flex-1 overflow-y-auto custom-scrollbar mt-0">
            <div className="max-w-4xl mx-auto">
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle>{lang === 'zh' ? '手势库' : 'Gesture Library'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {gestureDatabase.map((gesture) => (
                      <motion.div
                        key={gesture.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (gesture.saleStatus === "LOCKED") return;
                          const ok = await tryRedeem(gesture, "GESTURE", setGestureDatabase);
                          if (ok) setSelectedGesture(gesture.id);
                        }}
                        className={`p-6 rounded-2xl border-2 flex flex-col items-center cursor-pointer transition-all ${
                          selectedGesture === gesture.id
                            ? 'bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
                            : 'bg-black/40 border-white/10 hover:border-purple-500/30'
                        } ${gesture.saleStatus === "LOCKED" ? 'opacity-50' : ''}`}
                      >
                        <div className="text-6xl mb-3">{gesture.icon}</div>
                        <div className="text-sm font-bold text-white text-center">{gesture.name}</div>
                        <Badge variant="outline" className="mt-2 text-xs border-white/20">{gesture.category}</Badge>
                        {gesture.owned ? (
                          <div className="text-[10px] text-green-400 mt-1">{lang === 'zh' ? '已拥有' : 'Owned'}</div>
                        ) : (gesture.saleStatus ?? 'FREE') === 'PAID' && (gesture.priceCredits ?? 0) > 0 ? (
                          <div className="text-[10px] text-yellow-400 mt-1">{gesture.priceCredits}⭐</div>
                        ) : null}
                      </motion.div>
                    ))}
                  </div>

                  {selectedGesture && (
                    <Button className="w-full mt-6 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold">
                      <Hand className="w-4 h-4 mr-2" />
                      {lang === 'zh' ? '应用手势' : 'Apply Gesture'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 自定义编辑 */}
          <TabsContent value="custom" className="flex-1 overflow-y-auto custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto">
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-yellow-400" />
                    {lang === 'zh' ? '高级自定义编辑器' : 'Advanced Custom Editor'}
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-2">{lang === 'zh' ? '精确控制每个关节点，创造独特姿态' : 'Fine-tune every joint to create unique poses'}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-20 text-gray-500">
                    <Wand2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-lg font-bold">{lang === 'zh' ? '关键帧编辑器' : 'Keyframe Editor'}</p>
                    <p className="text-sm">{lang === 'zh' ? '此功能正在开发中...' : 'Coming soon...'}</p>
                    <Button className="mt-6" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      {lang === 'zh' ? '导入BVH文件' : 'Import BVH File'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}