/**
 * 法务中心页面
 * 处理侵权投诉、合同纠纷、法律咨询
 */
import React, { useState } from 'react';
import {
  Scale, AlertTriangle, FileText, MessageSquare, Users,
  Clock, CheckCircle2, XCircle, Eye, Send, Filter
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";

interface LegalCase {
  id: string;
  type: 'infringement' | 'dispute' | 'consultation';
  title: string;
  submitter: string;
  status: 'pending' | 'investigating' | 'resolved' | 'closed';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  assignedTo?: string;
  description: string;
}

interface LegalCenterProps {
  lang: Lang;
}

export const LegalCenter: React.FC<LegalCenterProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [selectedType, setSelectedType] = useState<'all' | 'infringement' | 'dispute' | 'consultation'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'closed'>('all');
  const [viewingCase, setViewingCase] = useState<LegalCase | null>(null);
  const [actionNote, setActionNote] = useState('');

  // Mock data
  const cases: LegalCase[] = [
    {
      id: 'LEG-2024-001',
      type: 'infringement',
      title: '未经授权使用IP制作商业内容',
      submitter: '林夕工作室',
      status: 'investigating',
      priority: 'high',
      createdAt: '2024-03-15 09:30',
      assignedTo: '张律师',
      description: '某MCN未经授权使用林夕声线制作商业广告，要求立即处理并索赔',
    },
    {
      id: 'LEG-2024-002',
      type: 'dispute',
      title: '授权合同费率争议',
      submitter: '星辰MCN',
      status: 'pending',
      priority: 'medium',
      createdAt: '2024-03-14 14:20',
      description: '对合同中的分成比例存在理解分歧，需要法务介入调解',
    },
    {
      id: 'LEG-2024-003',
      type: 'consultation',
      title: 'NFT铸造法律合规咨询',
      submitter: '潮音传媒',
      status: 'resolved',
      priority: 'low',
      createdAt: '2024-03-13 11:15',
      assignedTo: '王律师',
      description: '咨询NFT铸造和销售的法律合规要求',
    },
    {
      id: 'LEG-2024-004',
      type: 'infringement',
      title: '盗用数字形象案件',
      submitter: '萧然工作室',
      status: 'pending',
      priority: 'high',
      createdAt: '2024-03-12 16:45',
      description: '发现第三方盗用萧然数字形象进行直播带货',
    },
    {
      id: 'LEG-2024-005',
      type: 'dispute',
      title: '授权范围界定纠纷',
      submitter: '云梦工作室',
      status: 'closed',
      priority: 'medium',
      createdAt: '2024-03-10 10:00',
      assignedTo: '李律师',
      description: '关于授权范围的具体界定产生分歧，已协商解决',
    },
  ];

  const filteredCases = cases.filter((c) => {
    const matchesType = selectedType === 'all' || c.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    return matchesType && matchesStatus;
  });

  const typeConfig = {
    infringement: { color: 'text-red-400', bg: 'bg-red-500/10', label: zh ? '侵权投诉' : 'Infringement' },
    dispute: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: zh ? '合同纠纷' : 'Dispute' },
    consultation: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: zh ? '法律咨询' : 'Consultation' },
  };

  const statusConfig = {
    pending: { color: 'text-amber-400', label: zh ? '待处理' : 'Pending' },
    investigating: { color: 'text-cyan-400', label: zh ? '调查中' : 'Investigating' },
    resolved: { color: 'text-green-400', label: zh ? '已解决' : 'Resolved' },
    closed: { color: 'text-gray-500', label: zh ? '已关闭' : 'Closed' },
  };

  const priorityConfig = {
    high: { color: 'text-red-400', label: zh ? '高' : 'High' },
    medium: { color: 'text-amber-400', label: zh ? '中' : 'Medium' },
    low: { color: 'text-cyan-400', label: zh ? '低' : 'Low' },
  };

  const handleAssign = (caseId: string, lawyer: string) => {
    console.log('Assigning case:', { caseId, lawyer });
  };

  const handleAction = (caseId: string, action: 'investigate' | 'resolve' | 'close') => {
    console.log('Case action:', { caseId, action, note: actionNote });
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
          <h2 className="text-2xl font-bold">{zh ? '法务中心' : 'Legal Center'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '处理侵权投诉、合同纠纷和法律咨询' : 'Handle infringement complaints, disputes, and consultations'}
          </p>
        </div>
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
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2">
          {(['all', 'infringement', 'dispute', 'consultation'] as const).map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType(type)}
              className={selectedType === type ? 'bg-purple-600' : 'hover:bg-white/5'}
            >
              {zh
                ? { all: '全部', infringement: '侵权', dispute: '纠纷', consultation: '咨询' }[type]
                : { all: 'All', infringement: 'Infringement', dispute: 'Dispute', consultation: 'Consultation' }[type]}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'investigating', 'resolved', 'closed'] as const).map((status) => (
            <Button
              key={status}
              variant={selectedStatus === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedStatus(status)}
              className={selectedStatus === status ? 'bg-cyan-600' : 'hover:bg-white/5'}
            >
              {zh
                ? { all: '全部', pending: '待处理', investigating: '调查中', resolved: '已解决', closed: '已关闭' }[status]
                : { all: 'All', pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved', closed: 'Closed' }[status]}
            </Button>
          ))}
        </div>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.map((caseItem) => {
          const typeStyle = typeConfig[caseItem.type];
          const statusStyle = statusConfig[caseItem.status];
          const priorityStyle = priorityConfig[caseItem.priority];
          return (
            <motion.div
              key={caseItem.id}
              whileHover={{ scale: 1.01 }}
              className="p-4 bg-gray-900/50 rounded-lg border border-white/10 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono text-gray-500">{caseItem.id}</span>
                    <Badge className={`${typeStyle.bg} ${typeStyle.color} border-none text-xs`}>
                      {typeStyle.label}
                    </Badge>
                    <Badge variant="outline" className={`${statusStyle.color} border-white/10 text-xs`}>
                      {statusStyle.label}
                    </Badge>
                    <Badge variant="outline" className={`${priorityStyle.color} border-white/10 text-xs`}>
                      {priorityStyle.label}
                    </Badge>
                  </div>
                  <h3 className="text-white font-medium mb-2">{caseItem.title}</h3>
                  <p className="text-sm text-gray-400 mb-2">{caseItem.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{zh ? '提交者：' : 'Submitted by: '}{caseItem.submitter}</span>
                    <span>{caseItem.createdAt}</span>
                    {caseItem.assignedTo && (
                      <span className="text-cyan-400">{zh ? '负责人：' : 'Assigned to: '}{caseItem.assignedTo}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
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
                <h3 className="text-xl font-bold">{zh ? '案例详情' : 'Case Details'}</h3>
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
                    <div className="text-sm text-gray-500 mb-1">{zh ? '案例类型' : 'Type'}</div>
                    <Badge className={`${typeConfig[viewingCase.type].bg} ${typeConfig[viewingCase.type].color}`}>
                      {typeConfig[viewingCase.type].label}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '提交者' : 'Submitter'}</div>
                    <div className="text-white">{viewingCase.submitter}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">{zh ? '优先级' : 'Priority'}</div>
                    <Badge className={`${priorityConfig[viewingCase.priority].color}`}>
                      {priorityConfig[viewingCase.priority].label}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">{zh ? '案例描述' : 'Description'}</div>
                  <p className="text-white text-sm">{viewingCase.description}</p>
                </div>

                {!viewingCase.assignedTo && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2">{zh ? '分配给' : 'Assign to'}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAssign(viewingCase.id, '张律师')}>
                        张律师
                      </Button>
                      <Button size="sm" onClick={() => handleAssign(viewingCase.id, '王律师')}>
                        王律师
                      </Button>
                      <Button size="sm" onClick={() => handleAssign(viewingCase.id, '李律师')}>
                        李律师
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-500 mb-2">{zh ? '处理意见' : 'Action Note'}</div>
                  <Textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={zh ? '请输入处理意见或备注...' : 'Enter action note...'}
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
                      onClick={() => handleAction(viewingCase.id, 'resolve')}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {zh ? '标记已解决' : 'Mark Resolved'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleAction(viewingCase.id, 'close')}
                    className="flex-1 border-white/10 hover:bg-white/5"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {zh ? '关闭案例' : 'Close Case'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">{zh ? '合同模板库' : 'Contract Templates'}</h3>
                <p className="text-sm text-gray-400">
                  {zh ? '标准合同模板和法律文书模板' : 'Standard contract and legal document templates'}
                </p>
              </div>
              <Button variant="outline" className="border-purple-500/30 hover:bg-purple-500/10">
                <FileText className="w-4 h-4 mr-2" />
                {zh ? '访问' : 'Access'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">{zh ? '外部法律团队' : 'External Legal Team'}</h3>
                <p className="text-sm text-gray-400">
                  {zh ? '联系合作律师事务所和法律顾问' : 'Contact partner law firms and legal advisors'}
                </p>
              </div>
              <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10">
                <Users className="w-4 h-4 mr-2" />
                {zh ? '联系' : 'Contact'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
