"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '@/lib/toast';
import { Card, CardContent } from '@ai-star-eco/ui/ui/card';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Badge } from '@ai-star-eco/ui/ui/badge';
import { Input } from '@ai-star-eco/ui/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ai-star-eco/ui/ui/tabs';
import {
  Megaphone, Music, Film, Tv, ShoppingBag, Mic2, Trophy,
  Clock, DollarSign, TrendingUp, Zap, Target, CheckCircle2,
  AlertCircle, Filter, Search, Flame, Crown, Sparkles,
  Eye, Tag, RefreshCw,
} from 'lucide-react';
import type { Artist, TalentKey } from "@ai-star-eco/types/artist";
import type { Notice, NoticeType, NoticeDifficulty } from "@ai-star-eco/types/notice";
import { NOTICES } from "@/mocks/notice";

interface NoticeBoardProps {
  artist: Artist;
}

const TYPE_LABELS: Record<NoticeType, string> = {
  music: "音乐",
  film: "影视",
  variety: "综艺",
  ad: "广告",
  voice: "配音",
  stage: "舞台",
  special: "特殊",
};

const DIFFICULTY_LABELS: Record<NoticeDifficulty, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
};

const TALENT_LABELS: Record<TalentKey, string> = {
  singing: "唱功",
  acting: "演技",
  dancing: "舞蹈",
  hosting: "主持",
  comedy: "喜剧",
  variety: "综艺感",
};

const TYPE_COLORS: Record<NoticeType, string> = {
  music: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  film: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  variety: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ad: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  voice: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  stage: 'bg-green-500/20 text-green-300 border-green-500/30',
  special: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const DIFFICULTY_COLORS: Record<NoticeDifficulty, string> = {
  easy: 'bg-green-500/20 text-green-300 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  hard: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  expert: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const TYPE_ICONS: Record<NoticeType, typeof Megaphone> = {
  music: Music,
  film: Film,
  variety: Tv,
  ad: ShoppingBag,
  voice: Mic2,
  stage: Trophy,
  special: Zap,
};

const TYPE_ICON_BG: Record<NoticeType, string> = {
  music: 'bg-gradient-to-br from-pink-500 to-purple-500',
  film: 'bg-gradient-to-br from-cyan-500 to-blue-500',
  variety: 'bg-gradient-to-br from-yellow-500 to-orange-500',
  ad: 'bg-gradient-to-br from-orange-500 to-red-500',
  voice: 'bg-gradient-to-br from-purple-500 to-pink-500',
  stage: 'bg-gradient-to-br from-green-500 to-cyan-500',
  special: 'bg-gradient-to-br from-red-500 to-pink-500',
};

export function NoticeBoard({ artist }: NoticeBoardProps) {
  const [activeTab, setActiveTab] = useState<NoticeType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setSelectedNotice] = useState<Notice | null>(null);

  const filteredNotices = NOTICES.filter(notice => {
    if (activeTab !== 'all' && notice.type !== activeTab) return false;
    if (searchQuery && !notice.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const checkRequirements = (notice: Notice) => {
    const levelOk = artist.level >= notice.requirements.minLevel;
    const talents = Object.entries(notice.requirements.talents || {}).map(([key, value]) => ({
      key: key as TalentKey,
      required: value as number,
      current: artist.talents[key as TalentKey] || 0,
      passed: (artist.talents[key as TalentKey] || 0) >= (value as number),
    }));
    const allPassed = levelOk && talents.every(t => t.passed);
    return { level: levelOk, talents, allPassed };
  };

  const formatDeadline = (iso: string) => new Date(iso).toLocaleDateString('zh-CN');

  return (
    <div className="h-full flex flex-col">
      {/* 顶部统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border-pink-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Megaphone className="w-5 h-5 text-pink-400" />
              <Badge variant="outline" className="text-pink-400 border-pink-400/30 text-xs">今日</Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{NOTICES.length}</div>
            <div className="text-xs text-gray-400">全部通告</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border-orange-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <TrendingUp className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">{NOTICES.filter(n => n.hot).length}</div>
            <div className="text-xs text-gray-400">热门通告</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {NOTICES.filter(n => checkRequirements(n).allPassed).length}
            </div>
            <div className="text-xs text-gray-400">可接通告</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <Sparkles className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              ¥{(NOTICES.reduce((sum, n) => sum + n.reward, 0) / 10000).toFixed(0)}W
            </div>
            <div className="text-xs text-gray-400">总价值</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索通告..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/50 border-white/10"
          />
        </div>
        <Button variant="outline" className="border-white/10 hover:bg-white/5">
          <Filter className="w-4 h-4 mr-2" />筛选
        </Button>
        <Button variant="outline" className="border-white/10 hover:bg-white/5">
          <RefreshCw className="w-4 h-4 mr-2" />刷新
        </Button>
      </div>

      {/* 主内容 Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NoticeType | 'all')} className="h-full flex flex-col">
          <TabsList className="bg-black/60 border border-white/5 rounded-xl p-1.5 gap-1.5 mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white/10 whitespace-nowrap">
              全部 ({NOTICES.length})
            </TabsTrigger>
            <TabsTrigger value="music" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 whitespace-nowrap">
              <Music className="w-3 h-3 mr-1" />音乐
            </TabsTrigger>
            <TabsTrigger value="film" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 whitespace-nowrap">
              <Film className="w-3 h-3 mr-1" />影视
            </TabsTrigger>
            <TabsTrigger value="variety" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 whitespace-nowrap">
              <Tv className="w-3 h-3 mr-1" />综艺
            </TabsTrigger>
            <TabsTrigger value="ad" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 whitespace-nowrap">
              <ShoppingBag className="w-3 h-3 mr-1" />广告
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredNotices.map((notice, index) => {
                  const Icon = TYPE_ICONS[notice.type];
                  const requirements = checkRequirements(notice);

                  return (
                    <motion.div
                      key={notice.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        className={`bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer ${
                          notice.featured ? 'ring-2 ring-yellow-500/30' : ''
                        }`}
                        onClick={() => setSelectedNotice(notice)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {/* 左侧图标 */}
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_ICON_BG[notice.type]}`}>
                              <Icon className="w-8 h-8 text-white" />
                            </div>

                            {/* 右侧内容 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-white line-clamp-1">{notice.title}</h3>
                                    {notice.hot && (
                                      <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs">
                                        <Flame className="w-3 h-3 mr-1" />HOT
                                      </Badge>
                                    )}
                                    {notice.featured && (
                                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                                        <Crown className="w-3 h-3 mr-1" />精选
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <Badge variant="outline" className={`text-xs ${TYPE_COLORS[notice.type]}`}>
                                      {TYPE_LABELS[notice.type]}
                                    </Badge>
                                    <span>·</span>
                                    <span>{notice.client}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className={`text-xs whitespace-nowrap ${DIFFICULTY_COLORS[notice.difficulty]}`}>
                                  {DIFFICULTY_LABELS[notice.difficulty]}
                                </Badge>
                              </div>

                              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{notice.description}</p>

                              <div className="flex flex-wrap gap-2 mb-3">
                                {notice.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs border-white/10 text-gray-400">
                                    <Tag className="w-3 h-3 mr-1" />{tag}
                                  </Badge>
                                ))}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">报酬</div>
                                  <div className="text-sm font-bold text-green-400">¥{(notice.reward / 1000).toFixed(1)}K</div>
                                </div>
                                {notice.bonus && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">奖金</div>
                                    <div className="text-sm font-bold text-yellow-400">+¥{(notice.bonus / 1000).toFixed(1)}K</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">周期</div>
                                  <div className="text-sm font-bold text-cyan-400">{notice.duration}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">名额</div>
                                  <div className="text-sm font-bold text-purple-400">{notice.slotsLeft}/{notice.slots}</div>
                                </div>
                              </div>

                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2">
                                  {requirements.level ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className={`text-xs ${requirements.level ? 'text-green-400' : 'text-red-400'}`}>
                                    等级要求: Lv.{notice.requirements.minLevel}
                                    {requirements.level ? ` ✓` : ` (当前: Lv.${artist.level})`}
                                  </span>
                                </div>
                                {requirements.talents.map(talent => (
                                  <div key={talent.key} className="flex items-center gap-2">
                                    {talent.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={`text-xs ${talent.passed ? 'text-green-400' : 'text-red-400'}`}>
                                      {TALENT_LABELS[talent.key] || talent.key}: {talent.required}
                                      {talent.passed ? ` ✓` : ` (当前: ${talent.current})`}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                {requirements.allPassed ? (
                                  <Button
                                    className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast.success("通告已接取", { description: notice.title });
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />立即接单
                                  </Button>
                                ) : (
                                  <Button variant="outline" className="border-white/10" disabled>
                                    <AlertCircle className="w-4 h-4 mr-2" />不符合要求
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  className="border-white/10 hover:bg-white/5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="w-4 h-4 mr-2" />查看详情
                                </Button>
                              </div>

                              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                截止时间: {formatDeadline(notice.deadline)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredNotices.length === 0 && (
                <div className="text-center py-20">
                  <Megaphone className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-xl font-bold text-gray-400 mb-2">暂无通告</h3>
                  <p className="text-sm text-gray-500">明天会有新的通告发布</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
