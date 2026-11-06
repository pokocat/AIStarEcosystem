/**
 * 平台内容审核页面
 * 审核平台上所有MCN发布的内容
 */
import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Eye,
  Play, Music, Image, Video, Flag, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";

interface ModerationItem {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image' | 'live';
  mcnName: string;
  ipName?: string;
  submittedAt: string;
  thumbnail: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  priority: 'high' | 'medium' | 'low';
  reportCount?: number;
  platform: string;
}

interface ContentModerationProps {
  lang: Lang;
}

export const ContentModeration: React.FC<ContentModerationProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [filter, setFilter] = useState<'all' | 'pending' | 'flagged' | 'approved' | 'rejected'>('pending');
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [moderationNote, setModerationNote] = useState('');

  const moderationQueue: ModerationItem[] = [
    {
      id: 'm001',
      title: '明星A带货短视频 #新品推荐',
      type: 'video',
      mcnName: '星辰MCN-张三',
      ipName: '明星A短视频切片',
      submittedAt: '2024-05-15 10:30',
      thumbnail: 'VID',
      status: 'pending',
      priority: 'high',
      platform: '抖音',
    },
    {
      id: 'm002',
      title: '敏感内容测试',
      type: 'video',
      mcnName: '星辰MCN-王五',
      submittedAt: '2024-05-15 10:15',
      thumbnail: 'VID',
      status: 'flagged',
      priority: 'high',
      reportCount: 3,
      platform: 'B站',
    },
    {
      id: 'm003',
      title: '明星B虚拟直播 - 游戏互动',
      type: 'live',
      mcnName: '星辰MCN-李四',
      ipName: '明星B虚拟形象',
      submittedAt: '2024-05-15 09:15',
      thumbnail: 'LIV',
      status: 'pending',
      priority: 'medium',
      platform: 'Bilibili',
    },
    {
      id: 'm004',
      title: '明星C翻唱《星空》',
      type: 'audio',
      mcnName: '星辰MCN-王五',
      ipName: '明星C音乐IP',
      submittedAt: '2024-05-14 18:45',
      thumbnail: 'AUD',
      status: 'approved',
      priority: 'low',
      platform: '网易云音乐',
    },
    {
      id: 'm005',
      title: '违规广告内容',
      type: 'image',
      mcnName: '星辰MCN-张三',
      submittedAt: '2024-05-14 16:20',
      thumbnail: 'IMG',
      status: 'rejected',
      priority: 'medium',
      platform: '小红书',
    },
    {
      id: 'm006',
      title: '疑似侵权内容',
      type: 'video',
      mcnName: '星辰MCN-李四',
      submittedAt: '2024-05-14 14:00',
      thumbnail: 'VID',
      status: 'flagged',
      priority: 'high',
      reportCount: 5,
      platform: 'B站',
    },
  ];

  const filteredQueue = filter === 'all'
    ? moderationQueue
    : moderationQueue.filter((item) => item.status === filter);

  const stats = {
    pending: moderationQueue.filter((i) => i.status === 'pending').length,
    flagged: moderationQueue.filter((i) => i.status === 'flagged').length,
    approved: moderationQueue.filter((i) => i.status === 'approved').length,
    rejected: moderationQueue.filter((i) => i.status === 'rejected').length,
  };

  const typeIcons = {
    video: Video,
    audio: Music,
    image: Image,
    live: Play,
  };

  const statusConfig = {
    pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: { zh: '待审核', en: 'Pending' }, icon: Clock },
    approved: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: { zh: '已通过', en: 'Approved' }, icon: CheckCircle2 },
    rejected: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: { zh: '已拒绝', en: 'Rejected' }, icon: XCircle },
    flagged: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: { zh: '已标记', en: 'Flagged' }, icon: Flag },
  };

  const priorityConfig = {
    high: { color: 'text-red-400', label: { zh: '高', en: 'High' } },
    medium: { color: 'text-amber-400', label: { zh: '中', en: 'Medium' } },
    low: { color: 'text-gray-400', label: { zh: '低', en: 'Low' } },
  };

  const handleModerate = (itemId: string, action: 'approve' | 'reject' | 'flag') => {
    console.log(`Moderate ${itemId}: ${action}`, moderationNote);
    setSelectedItem(null);
    setModerationNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '内容审核' : 'Content Moderation'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '审核平台上所有MCN发布的内容，处理举报和违规内容' : 'Review all content, handle reports and violations'}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-base px-4 py-1.5">
            {stats.pending} {zh ? '待审核' : 'Pending'}
          </Badge>
          {stats.flagged > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-base px-4 py-1.5">
              {stats.flagged} {zh ? '已标记' : 'Flagged'}
            </Badge>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['all', 'pending', 'flagged', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              filter === tab
                ? 'text-purple-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {zh
              ? { all: '全部', pending: '待审核', flagged: '已标记', approved: '已通过', rejected: '已拒绝' }[tab]
              : { all: 'All', pending: 'Pending', flagged: 'Flagged', approved: 'Approved', rejected: 'Rejected' }[tab]}
            {tab !== 'all' && (
              <Badge className="ml-2 text-xs">
                {stats[tab]}
              </Badge>
            )}
            {filter === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '待审核' : 'Pending'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '已标记' : 'Flagged'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-400">{stats.flagged}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '已通过' : 'Approved'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '已拒绝' : 'Rejected'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue */}
      <div className="grid grid-cols-1 gap-4">
        {filteredQueue.map((item) => {
          const TypeIcon = typeIcons[item.type];
          const statusStyle = statusConfig[item.status];
          const StatusIcon = statusStyle.icon;
          const priorityStyle = priorityConfig[item.priority];

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className={`bg-gray-900/50 border-white/10 hover:border-purple-500/30 transition-all ${
                item.status === 'flagged' ? 'ring-2 ring-orange-500/20' : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-gradient-to-br from-purple-900/30 to-cyan-900/30 rounded-lg flex items-center justify-center text-2xl font-bold text-white/50 flex-shrink-0">
                      {item.thumbnail}
                    </div>

                    {/* Content Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white">{item.title}</h3>
                            {item.reportCount && item.reportCount > 0 && (
                              <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                                <Flag className="w-3 h-3 mr-1" />
                                {item.reportCount} {zh ? '举报' : 'Reports'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm mb-3">
                            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {zh ? { video: '视频', audio: '音频', image: '图片', live: '直播' }[item.type] : item.type}
                            </Badge>
                            <span className="text-gray-500 text-xs">{item.mcnName}</span>
                            {item.ipName && (
                              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                                {item.ipName}
                              </Badge>
                            )}
                            <span className="text-gray-500 text-xs">{item.platform}</span>
                            <span className={`text-xs ${priorityStyle.color} font-semibold`}>
                              {zh ? priorityStyle.label.zh : priorityStyle.label.en} {zh ? '优先级' : 'Priority'}
                            </span>
                          </div>
                        </div>

                        <Badge className={`${statusStyle.bg} ${statusStyle.border} ${statusStyle.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {zh ? statusStyle.label.zh : statusStyle.label.en}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {zh ? '提交时间' : 'Submitted'}: {item.submittedAt}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                            className="hover:bg-cyan-500/10 hover:text-cyan-400"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {zh ? '查看详情' : 'View'}
                          </Button>
                          {(item.status === 'pending' || item.status === 'flagged') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleModerate(item.id, 'approve')}
                                className="hover:bg-green-500/10 hover:text-green-400"
                              >
                                <ThumbsUp className="w-4 h-4 mr-1" />
                                {zh ? '通过' : 'Approve'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleModerate(item.id, 'reject')}
                                className="hover:bg-red-500/10 hover:text-red-400"
                              >
                                <ThumbsDown className="w-4 h-4 mr-1" />
                                {zh ? '拒绝' : 'Reject'}
                              </Button>
                              {item.status !== 'flagged' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleModerate(item.id, 'flag')}
                                  className="hover:bg-orange-500/10 hover:text-orange-400"
                                >
                                  <Flag className="w-4 h-4 mr-1" />
                                  {zh ? '标记' : 'Flag'}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Moderation Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-xl max-w-2xl w-full p-6"
            >
              <h3 className="text-xl font-bold mb-4">{zh ? '审核内容' : 'Moderate Content'}</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{zh ? '内容标题' : 'Title'}</p>
                  <p className="text-white">{selectedItem.title}</p>
                </div>
                {selectedItem.reportCount && selectedItem.reportCount > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">
                      <Flag className="w-4 h-4 inline mr-2" />
                      {zh ? `该内容已被举报 ${selectedItem.reportCount} 次` : `This content has been reported ${selectedItem.reportCount} times`}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400 mb-1">{zh ? '审核意见' : 'Moderation Note'}</p>
                  <Textarea
                    value={moderationNote}
                    onChange={(e) => setModerationNote(e.target.value)}
                    placeholder={zh ? '请输入审核意见或违规原因' : 'Enter moderation note or violation reason'}
                    className="bg-black/30 border-white/10 min-h-[100px]"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleModerate(selectedItem.id, 'approve')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {zh ? '通过' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => handleModerate(selectedItem.id, 'reject')}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {zh ? '拒绝' : 'Reject'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedItem(null)}
                    className="border-white/10 hover:bg-white/5"
                  >
                    {zh ? '取消' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
