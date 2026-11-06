/**
 * 合同中心页面
 * 管理授权合同、补充协议、结算单据
 */
import React, { useState } from 'react';
import {
  FileText, Search, Filter, Download, Eye, Edit3,
  CheckCircle2, Clock, XCircle, AlertCircle, Calendar, DollarSign
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { motion } from "motion/react";
import type { Lang } from "../../translations";

interface Contract {
  id: string;
  title: string;
  type: 'authorization' | 'amendment' | 'settlement';
  mcnName: string;
  ipName: string;
  signDate: string;
  startDate: string;
  endDate: string;
  amount: string;
  status: 'active' | 'expired' | 'pending' | 'terminated';
}

interface ContractCenterProps {
  lang: Lang;
}

export const ContractCenter: React.FC<ContractCenterProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [selectedType, setSelectedType] = useState<'all' | 'authorization' | 'amendment' | 'settlement'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'expired' | 'pending' | 'terminated'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data
  const contracts: Contract[] = [
    {
      id: 'CON-2024-001',
      title: '萧然声线授权合同',
      type: 'authorization',
      mcnName: '星辰MCN',
      ipName: '萧然声线',
      signDate: '2024-01-15',
      startDate: '2024-01-20',
      endDate: '2025-01-19',
      amount: '¥500,000',
      status: 'active',
    },
    {
      id: 'CON-2024-002',
      title: '林夕形象授权合同',
      type: 'authorization',
      mcnName: '潮音传媒',
      ipName: '林夕形象',
      signDate: '2024-02-10',
      startDate: '2024-02-15',
      endDate: '2025-02-14',
      amount: '¥800,000',
      status: 'active',
    },
    {
      id: 'AMD-2024-001',
      title: '萧然声线授权范围补充协议',
      type: 'amendment',
      mcnName: '星辰MCN',
      ipName: '萧然声线',
      signDate: '2024-03-01',
      startDate: '2024-03-01',
      endDate: '2025-01-19',
      amount: '¥150,000',
      status: 'active',
    },
    {
      id: 'SET-2024-001',
      title: '2024年Q1结算单',
      type: 'settlement',
      mcnName: '星辰MCN',
      ipName: '萧然声线',
      signDate: '2024-04-05',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      amount: '¥125,600',
      status: 'active',
    },
    {
      id: 'CON-2023-005',
      title: '云梦音色授权合同',
      type: 'authorization',
      mcnName: '幻声工作室',
      ipName: '云梦音色',
      signDate: '2023-06-10',
      startDate: '2023-06-15',
      endDate: '2024-06-14',
      amount: '¥600,000',
      status: 'expired',
    },
    {
      id: 'CON-2024-003',
      title: '千羽声线授权合同',
      type: 'authorization',
      mcnName: '次元之声',
      ipName: '千羽声线',
      signDate: '2024-03-20',
      startDate: '2024-04-01',
      endDate: '2025-03-31',
      amount: '¥700,000',
      status: 'pending',
    },
  ];

  const filteredContracts = contracts.filter((contract) => {
    const matchesType = selectedType === 'all' || contract.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || contract.status === selectedStatus;
    const matchesSearch =
      searchQuery === '' ||
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.mcnName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.ipName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const typeConfig = {
    authorization: {
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      icon: FileText,
      label: zh ? '授权合同' : 'Authorization',
    },
    amendment: {
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      icon: Edit3,
      label: zh ? '补充协议' : 'Amendment',
    },
    settlement: {
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      icon: DollarSign,
      label: zh ? '结算单' : 'Settlement',
    },
  };

  const statusConfig = {
    active: { color: 'text-green-400', label: zh ? '生效中' : 'Active' },
    expired: { color: 'text-gray-500', label: zh ? '已过期' : 'Expired' },
    pending: { color: 'text-amber-400', label: zh ? '待签署' : 'Pending' },
    terminated: { color: 'text-red-400', label: zh ? '已终止' : 'Terminated' },
  };

  const stats = {
    total: contracts.length,
    active: contracts.filter((c) => c.status === 'active').length,
    pending: contracts.filter((c) => c.status === 'pending').length,
    expired: contracts.filter((c) => c.status === 'expired').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '合同中心' : 'Contract Center'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '管理IP授权合同、补充协议和结算单据' : 'Manage IP authorization contracts, amendments, and settlements'}
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <Download className="w-4 h-4 mr-2" />
          {zh ? '批量导出' : 'Batch Export'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '合同总数' : 'Total Contracts'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '生效中' : 'Active'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '待签署' : 'Pending'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">{zh ? '已过期' : 'Expired'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-500">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={zh ? '搜索合同标题、MCN或IP名称...' : 'Search contract title, MCN or IP...'}
              className="pl-10 bg-gray-900/50 border-white/10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-4 py-2 rounded-lg bg-gray-900/50 border border-white/10 text-white text-sm"
          >
            <option value="all">{zh ? '全部类型' : 'All Types'}</option>
            <option value="authorization">{zh ? '授权合同' : 'Authorization'}</option>
            <option value="amendment">{zh ? '补充协议' : 'Amendment'}</option>
            <option value="settlement">{zh ? '结算单' : 'Settlement'}</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-4 py-2 rounded-lg bg-gray-900/50 border border-white/10 text-white text-sm"
          >
            <option value="all">{zh ? '全部状态' : 'All Status'}</option>
            <option value="active">{zh ? '生效中' : 'Active'}</option>
            <option value="pending">{zh ? '待签署' : 'Pending'}</option>
            <option value="expired">{zh ? '已过期' : 'Expired'}</option>
            <option value="terminated">{zh ? '已终止' : 'Terminated'}</option>
          </select>
        </div>
      </div>

      {/* Contracts List */}
      <div className="space-y-3">
        {filteredContracts.map((contract) => {
          const typeStyle = typeConfig[contract.type];
          const statusStyle = statusConfig[contract.status];
          const TypeIcon = typeStyle.icon;
          return (
            <motion.div
              key={contract.id}
              whileHover={{ scale: 1.01 }}
              className="p-4 bg-gray-900/50 rounded-lg border border-white/10 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${typeStyle.bg}`}>
                      <TypeIcon className={`w-4 h-4 ${typeStyle.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{contract.title}</h3>
                        <Badge variant="outline" className={`${statusStyle.color} border-white/10 text-xs`}>
                          {statusStyle.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {contract.id} <span className="mx-2">|</span> {typeStyle.label}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs mb-1">{zh ? 'MCN机构' : 'MCN'}</div>
                      <div className="text-cyan-400">{contract.mcnName}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">{zh ? '涉及IP' : 'IP'}</div>
                      <div className="text-purple-400">{contract.ipName}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">{zh ? '合同期限' : 'Period'}</div>
                      <div className="text-white">
                        {contract.startDate} ~ {contract.endDate}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-1">{zh ? '合同金额' : 'Amount'}</div>
                      <div className="text-green-400 font-semibold">{contract.amount}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm" className="hover:bg-white/5">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:bg-purple-500/10">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredContracts.length === 0 && (
        <Card className="bg-gray-900/50 border-white/10">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">{zh ? '暂无符合条件的合同' : 'No contracts found'}</p>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">{zh ? '到期提醒' : 'Expiry Reminders'}</h3>
                <p className="text-sm text-gray-400">
                  {zh ? '30天内到期合同：2份' : '2 contracts expiring in 30 days'}
                </p>
              </div>
              <Button variant="outline" className="border-purple-500/30 hover:bg-purple-500/10">
                <Calendar className="w-4 h-4 mr-2" />
                {zh ? '查看' : 'View'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">{zh ? '合同模板库' : 'Contract Templates'}</h3>
                <p className="text-sm text-gray-400">
                  {zh ? '标准合同模板和条款库' : 'Standard contract templates and clauses'}
                </p>
              </div>
              <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10">
                <FileText className="w-4 h-4 mr-2" />
                {zh ? '访问' : 'Access'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
