/**
 * 用户管理页面
 * 管理MCN账号、明星账号、粉丝账号
 */
import React, { useState } from 'react';
import {
  Users, Search, Filter, MoreVertical, Shield, Star,
  Ban, CheckCircle2, Clock, Eye, Edit3, Trash2, UserPlus
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { motion } from "motion/react";
import type { Lang } from "../../translations";

interface User {
  id: string;
  name: string;
  email: string;
  type: 'mcn' | 'celebrity' | 'fan';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
  lastActive: string;
  revenue?: string;
  content?: number;
}

interface UserManagementProps {
  lang: Lang;
}

export const UserManagement: React.FC<UserManagementProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mcn' | 'celebrity' | 'fan'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');

  const users: User[] = [
    {
      id: 'u001',
      name: '星辰MCN-张三',
      email: 'zhangsan@stellar-mcn.com',
      type: 'mcn',
      status: 'active',
      joinedAt: '2024-01-15',
      lastActive: '2024-05-15 10:30',
      revenue: '¥125,600',
      content: 48,
    },
    {
      id: 'u002',
      name: '星辰MCN-李四',
      email: 'lisi@stellar-mcn.com',
      type: 'mcn',
      status: 'active',
      joinedAt: '2024-02-20',
      lastActive: '2024-05-15 09:15',
      revenue: '¥89,400',
      content: 32,
    },
    {
      id: 'u003',
      name: '明星A工作室',
      email: 'celebrity-a@studio.com',
      type: 'celebrity',
      status: 'active',
      joinedAt: '2024-01-01',
      lastActive: '2024-05-14 18:00',
      revenue: '¥45,200',
    },
    {
      id: 'u004',
      name: '明星B工作室',
      email: 'celebrity-b@studio.com',
      type: 'celebrity',
      status: 'active',
      joinedAt: '2024-03-10',
      lastActive: '2024-05-15 08:45',
      revenue: '¥28,600',
    },
    {
      id: 'u005',
      name: 'CyberFan_01',
      email: 'fan01@example.com',
      type: 'fan',
      status: 'active',
      joinedAt: '2024-04-05',
      lastActive: '2024-05-15 11:20',
    },
    {
      id: 'u006',
      name: '星辰MCN-王五',
      email: 'wangwu@stellar-mcn.com',
      type: 'mcn',
      status: 'suspended',
      joinedAt: '2024-02-28',
      lastActive: '2024-05-10 16:30',
      revenue: '¥12,800',
      content: 8,
    },
  ];

  const typeConfig = {
    mcn: { label: { zh: 'MCN机构', en: 'MCN' }, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: Users },
    celebrity: { label: { zh: '明星艺人', en: 'Celebrity' }, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: Star },
    fan: { label: { zh: '粉丝用户', en: 'Fan' }, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', icon: Users },
  };

  const statusConfig = {
    active: { label: { zh: '正常', en: 'Active' }, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckCircle2 },
    suspended: { label: { zh: '封禁', en: 'Suspended' }, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: Ban },
    pending: { label: { zh: '待审核', en: 'Pending' }, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock },
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || user.type === filterType;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: users.length,
    mcn: users.filter((u) => u.type === 'mcn').length,
    celebrity: users.filter((u) => u.type === 'celebrity').length,
    fan: users.filter((u) => u.type === 'fan').length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '用户管理' : 'User Management'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '管理MCN、明星、粉丝账号，查看用户活跃度和收益数据' : 'Manage MCN, celebrity, and fan accounts'}
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <UserPlus className="w-4 h-4 mr-2" />
          {zh ? '新增用户' : 'Add User'}
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gray-900/50 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">{zh ? '总用户' : 'Total'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">MCN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-400">{stats.mcn}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">{zh ? '明星' : 'Celebrity'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{stats.celebrity}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-pink-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">{zh ? '粉丝' : 'Fan'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-400">{stats.fan}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">{zh ? '正常' : 'Active'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400">{zh ? '封禁' : 'Suspended'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{stats.suspended}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <Input
                  placeholder={zh ? '搜索用户名或邮箱...' : 'Search by name or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/30 border-white/10 pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white hover:bg-white/5"
              >
                <option value="all">{zh ? '全部类型' : 'All Types'}</option>
                <option value="mcn">MCN</option>
                <option value="celebrity">{zh ? '明星' : 'Celebrity'}</option>
                <option value="fan">{zh ? '粉丝' : 'Fan'}</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white hover:bg-white/5"
              >
                <option value="all">{zh ? '全部状态' : 'All Status'}</option>
                <option value="active">{zh ? '正常' : 'Active'}</option>
                <option value="suspended">{zh ? '封禁' : 'Suspended'}</option>
                <option value="pending">{zh ? '待审核' : 'Pending'}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardHeader>
          <CardTitle>
            {zh ? '用户列表' : 'User List'} ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const typeStyle = typeConfig[user.type];
              const statusStyle = statusConfig[user.status];
              const TypeIcon = typeStyle.icon;
              const StatusIcon = statusStyle.icon;

              return (
                <motion.div
                  key={user.id}
                  whileHover={{ scale: 1.005 }}
                  className="p-4 bg-black/30 rounded-lg border border-white/10 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{user.name}</h3>
                        <Badge className={`${typeStyle.bg} ${typeStyle.border} ${typeStyle.color} text-xs`}>
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {zh ? typeStyle.label.zh : typeStyle.label.en}
                        </Badge>
                        <Badge className={`${statusStyle.bg} ${statusStyle.border} ${statusStyle.color} text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {zh ? statusStyle.label.zh : statusStyle.label.en}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">{zh ? '邮箱' : 'Email'}</p>
                          <p className="text-gray-300 text-xs truncate">{user.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1">{zh ? '加入时间' : 'Joined'}</p>
                          <p className="text-gray-300 text-xs">{user.joinedAt}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1">{zh ? '最后活跃' : 'Last Active'}</p>
                          <p className="text-gray-300 text-xs">{user.lastActive}</p>
                        </div>
                        {user.revenue && (
                          <div>
                            <p className="text-gray-500 text-xs mb-1">{zh ? '累计收益' : 'Revenue'}</p>
                            <p className="text-green-400 font-semibold text-xs">{user.revenue}</p>
                          </div>
                        )}
                        {user.content !== undefined && (
                          <div>
                            <p className="text-gray-500 text-xs mb-1">{zh ? '内容数量' : 'Content'}</p>
                            <p className="text-cyan-400 font-semibold text-xs">{user.content}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-cyan-500/10 hover:text-cyan-400">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-purple-500/10 hover:text-purple-400">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
