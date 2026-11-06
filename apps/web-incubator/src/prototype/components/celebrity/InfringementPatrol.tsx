/**
 * 侵权巡查页面
 * 监控未经授权的IP使用，处理侵权案例
 */
import React, { useState } from 'react';
import {
  AlertCircle, Shield, ExternalLink, Clock, CheckCircle2,
  XCircle, Eye, MessageSquare, Trash2, Plus, Filter
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";

interface InfringementCase {
  id: string;
  platform: string;
  url: string;
  ipName: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'investigating' | 'confirmed' | 'resolved';
  reportedBy: string;
  reportedAt: string;
  description: string;
}

interface InfringementPatrolProps {
  lang: Lang;
}

export const InfringementPatrol: React.FC<InfringementPatrolProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'investigating' | 'confirmed' | 'resolved'>('all');
  const [viewingCase, setViewingCase] = useState<InfringementCase | null>(null);
  const [actionNote, setActionNote] = useState('');

  // Mock data
  const cases: InfringementCase[] = [
    {
      id: 'INF-001',
      platform: 'YouTube',
      url: 'https://youtube.com/watch?v=xxxxx',
      ipName: '萧然声线',
      severity: 'high',
      status: 'pending',
      reportedBy: '粉丝举报',
      reportedAt: '2024-03-15 14:30',
      description: '发现未经授权使用萧然声线制作翻唱视频，已获得大量播放',
    },
    {
      id: 'INF-002',
      platform: 'Bilibili',
      url: 'https://bilibili.com/video/xxxxx',
      ipName: '林夕形象',
      severity: 'medium',
      status: 'investigating',
      reportedBy: '自动监测',
      reportedAt: '2024-03-14 09:15',
      description: '疑似使用林夕数字形象进行商业直播',
    },
    {
      id: 'INF-003',
      platform: 'TikTok',
      url: 'https://tiktok.com/@xxxxx',
      ipName: '萧然声线',
      severity: 'low',
      status: 'confirmed',
      reportedAt: '2024-03-13 16:45',
      reportedBy: '用户投诉',
      description: '使用萧然声线制作短视频片段',
    },
    {
      id: 'INF-004',
      platform: 'Douyin',
      url: 'https://douyin.com/xxxxx',
      ipName: '云梦音色',
      severity: 'high',
      status: 'resolved',
      reportedBy: '粉丝举报',
      reportedAt: '2024-03-12 11:20',
      description: '未经授权使用云梦音色制作ASMR内容',
    },
    {
      id: 'INF-005',
      platform: 'Weibo',
      url: 'https://weibo.com/xxxxx',
      ipName: '林夕形象',
      severity: 'medium',
      status: 'investigating',
      reportedBy: '自动监测',
      reportedAt: '2024-03-11 08:00',
      description: '疑似盗用林夕官方宣传图片',
    },
  ];

  const filteredCases = selectedStatus === 'all'
    ? cases
    : cases.filter((c) => c.status === selectedStatus);

  const severityConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: zh ? '高危' : 'High' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: zh ? '中危' : 'Medium' },
    low: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', label: zh ? '低危' : 'Low' },
  };

  const statusConfig = {
    pending: { color: 'text-amber-400', label: zh ? '待处理' : 'Pending' },
    investigating: { color: 'text-cyan-400', label: zh ? '调查中' : 'Investigating' },
    confirmed: { color: 'text-red-400', label: zh ? '已确认' : 'Confirmed' },
    resolved: { color: 'text-green-400', label: zh ? '已解决' : 'Resolved' },
  };

  const handleAction = (caseId: string, action: 'investigate' | 'confirm' | 'resolve' | 'dismiss') => {
    console.log('Handling infringement action:', { caseId, action, note: actionNote });
    setViewingCase(null);
    setActionNote('');
  };

  const stats = {
    total: cases.length,
    pending: cases.filter((c) => c.status === 'pending').length,
    investigating: cases.filter((c) => c.status === 'investigating').length,
    resolved: cases.filter((c) => c.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '侵权巡查' : 'Infringement Patrol'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '监控未经授权的IP使用，快速响应侵权行为' : 'Monitor unauthorized IP usage and respond to infringements'}
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          {zh ? '手动上报' : 'Manual Report'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '总案例数' : 'Total Cases'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '待处理' : 'Pending'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '调查中' : 'Investigating'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-400">{stats.investigating}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '已解决' : 'Resolved'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pending', 'investigating', 'confirmed', 'resolved'] as const).map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedStatus(status)}
            className={selectedStatus === status ? 'bg-purple-600' : 'hover:bg-white/5'}
          >
            {zh
              ? { all: '全部', pending: '待处理', investigating: '调查中', confirmed: '已确认', resolved: '已解决' }[status]
              : { all: 'All', pending: 'Pending', investigating: 'Investigating', confirmed: 'Confirmed', resolved: 'Resolved' }[status]}
          </Button>
        ))}
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.map((caseItem) => {
          const severityStyle = severityConfig[caseItem.severity];
          const statusStyle = statusConfig[caseItem.status];
          return (
            <motion.div
              key={caseItem.id}
              whileHover={{ scale: 1.01 }}
              className={`p-4 bg-gray-900/50 rounded-lg border border-white/10 hover:border-purple-500/30 transition-all ${
                caseItem.severity === 'high' ? 'ring-2 ring-red-500/20' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-gray-500">{caseItem.id}</span>
                    <Badge className={`${severityStyle.bg} ${severityStyle.color} border-none`}>
                      {severityStyle.label}
                    </Badge>
                    <Badge variant="outline" className={`${statusStyle.color} border-white/10`}>
                      {statusStyle.label}
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <span className="text-white font-medium">{zh ? '涉及IP：' : 'IP: '}</span>
                    <span className="text-purple-400">{caseItem.ipName}</span>
                    <span className="text-gray-500 mx-2">|</span>
                    <span className="text-white font-medium">{zh ? '平台：' : 'Platform: '}</span>
                    <span className="text-cyan-400">{caseItem.platform}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{caseItem.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{zh ? '举报来源：' : 'Reported by: '}{caseItem.reportedBy}</span>
                    <span>{caseItem.reportedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(caseItem.url, '_blank')}
                    className="hover:bg-white/5"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingCase(caseItem)}
                    className="hover:bg-purple-500/10"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {zh ? '处理' : 'Handle'}
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Modal */}
      <AnimatePresence>
        {viewingCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setViewingCase(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{zh ? '侵权案例详情' : 'Infringement Case Details'}</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewingCase(null)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '案例编号' : 'Case ID'}</div>
                    <div className="font-mono text-white">{viewingCase.id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '涉及IP' : 'IP Name'}</div>
                    <div className="text-purple-400">{viewingCase.ipName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '平台' : 'Platform'}</div>
                    <div className="text-cyan-400">{viewingCase.platform}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '严重程度' : 'Severity'}</div>
                    <Badge className={`${severityConfig[viewingCase.severity].bg} ${severityConfig[viewingCase.severity].color}`}>
                      {severityConfig[viewingCase.severity].label}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">{zh ? '侵权链接' : 'URL'}</div>
                  <a
                    href={viewingCase.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline text-sm flex items-center gap-1"
                  >
                    {viewingCase.url} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">{zh ? '描述' : 'Description'}</div>
                  <p className="text-white text-sm">{viewingCase.description}</p>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-2">{zh ? '处理意见' : 'Action Note'}</div>
                  <Textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={zh ? '请输入处理意见或备注...' : 'Enter action note or remarks...'}
                    className="bg-black/30 border-white/10 min-h-[100px]"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  {viewingCase.status === 'pending' && (
                    <Button
                      onClick={() => handleAction(viewingCase.id, 'investigate')}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      {zh ? '开始调查' : 'Start Investigation'}
                    </Button>
                  )}
                  {viewingCase.status === 'investigating' && (
                    <Button
                      onClick={() => handleAction(viewingCase.id, 'confirm')}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {zh ? '确认侵权' : 'Confirm Infringement'}
                    </Button>
                  )}
                  {(viewingCase.status === 'confirmed' || viewingCase.status === 'investigating') && (
                    <Button
                      onClick={() => handleAction(viewingCase.id, 'resolve')}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {zh ? '标记已解决' : 'Mark Resolved'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleAction(viewingCase.id, 'dismiss')}
                    className="flex-1 border-white/10 hover:bg-white/5"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {zh ? '驳回' : 'Dismiss'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resources */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">{zh ? '维权资源' : 'Legal Resources'}</h3>
              <p className="text-sm text-gray-400">
                {zh ? '查看维权记录、黑名单管理、法律咨询' : 'View legal records, blacklist, legal consultation'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-purple-500/30 hover:bg-purple-500/10">
                <Shield className="w-4 h-4 mr-2" />
                {zh ? '维权记录' : 'Legal Records'}
              </Button>
              <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10">
                <AlertCircle className="w-4 h-4 mr-2" />
                {zh ? '黑名单' : 'Blacklist'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
