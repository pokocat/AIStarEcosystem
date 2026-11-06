/**
 * 平台分析页面
 * 用户增长、内容分析、收入分析、风控预警
 */
import React, { useState } from 'react';
import {
  TrendingUp, Users, FileText, DollarSign, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Calendar, Download
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { motion } from "motion/react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import type { Lang } from "../../translations";

interface PlatformAnalyticsProps {
  lang: Lang;
}

export const PlatformAnalytics: React.FC<PlatformAnalyticsProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // Mock data
  const userGrowthData = [
    { date: '01', mcn: 120, celebrity: 15, fan: 3200 },
    { date: '05', mcn: 145, celebrity: 18, fan: 4100 },
    { date: '10', mcn: 168, celebrity: 22, fan: 5300 },
    { date: '15', mcn: 195, celebrity: 26, fan: 6800 },
    { date: '20', mcn: 220, celebrity: 30, fan: 8500 },
    { date: '25', mcn: 245, celebrity: 34, fan: 10200 },
    { date: '30', mcn: 270, celebrity: 38, fan: 12400 },
  ];

  const contentData = [
    { date: '01', video: 450, audio: 180, image: 320, live: 90 },
    { date: '05', video: 520, audio: 210, image: 380, live: 110 },
    { date: '10', video: 610, audio: 240, image: 450, live: 130 },
    { date: '15', video: 690, audio: 280, image: 510, live: 160 },
    { date: '20', video: 780, audio: 320, image: 590, live: 190 },
    { date: '25', video: 860, audio: 360, image: 650, live: 220 },
    { date: '30', video: 950, audio: 410, image: 720, live: 250 },
  ];

  const revenueData = [
    { month: '1月', revenue: 180000, growth: 15.2 },
    { month: '2月', revenue: 220000, growth: 22.2 },
    { month: '3月', revenue: 280000, growth: 27.3 },
    { month: '4月', revenue: 320000, growth: 14.3 },
    { month: '5月', revenue: 410000, growth: 28.1 },
    { month: '6月', revenue: 520000, growth: 26.8 },
  ];

  const contentTypeDistribution = [
    { name: zh ? '视频' : 'Video', value: 42, color: '#a855f7' },
    { name: zh ? '音频' : 'Audio', value: 23, color: '#06b6d4' },
    { name: zh ? '图片' : 'Image', value: 28, color: '#ec4899' },
    { name: zh ? '直播' : 'Live', value: 7, color: '#f59e0b' },
  ];

  const stats = {
    totalUsers: '15,234',
    userGrowth: '+28.5%',
    totalContent: '89,456',
    contentGrowth: '+42.3%',
    totalRevenue: '¥2.3M',
    revenueGrowth: '+36.8%',
    activeRate: '68.2%',
    activeChange: '+5.2%',
  };

  const alerts = [
    { id: 1, type: 'warning', message: zh ? '检测到异常流量增长' : 'Abnormal traffic growth detected', time: '2小时前' },
    { id: 2, type: 'info', message: zh ? '新增MCN机构申请待审核' : 'New MCN applications pending review', time: '5小时前' },
    { id: 3, type: 'error', message: zh ? '支付网关响应超时' : 'Payment gateway timeout', time: '1天前' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '平台分析' : 'Platform Analytics'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '用户增长、内容分析、收入分析和风控预警' : 'User growth, content analysis, revenue, and risk alerts'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 hover:bg-white/5">
            <Calendar className="w-4 h-4 mr-2" />
            {zh ? '自定义时间' : 'Custom Range'}
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Download className="w-4 h-4 mr-2" />
            {zh ? '导出报表' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {zh ? '总用户数' : 'Total Users'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">{stats.userGrowth}</span>
              <span className="text-gray-500">{zh ? '较上月' : 'vs last month'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {zh ? '总内容数' : 'Total Content'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalContent}</div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">{stats.contentGrowth}</span>
              <span className="text-gray-500">{zh ? '较上月' : 'vs last month'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {zh ? '总收入' : 'Total Revenue'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalRevenue}</div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">{stats.revenueGrowth}</span>
              <span className="text-gray-500">{zh ? '较上月' : 'vs last month'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/30 to-amber-900/10 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {zh ? '活跃率' : 'Active Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.activeRate}</div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">{stats.activeChange}</span>
              <span className="text-gray-500">{zh ? '较上月' : 'vs last month'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Growth Chart */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{zh ? '用户增长趋势' : 'User Growth Trend'}</CardTitle>
            <div className="flex gap-2">
              {(['week', 'month', 'year'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className={timeRange === range ? 'bg-purple-600' : 'hover:bg-white/5'}
                >
                  {zh ? { week: '周', month: '月', year: '年' }[range] : { week: 'Week', month: 'Month', year: 'Year' }[range]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userGrowthData}>
              <defs>
                <linearGradient id="mcnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="celebrityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Area type="monotone" dataKey="fan" stroke="#ec4899" fill="url(#fanGradient)" name={zh ? '粉丝' : 'Fans'} />
              <Area type="monotone" dataKey="mcn" stroke="#06b6d4" fill="url(#mcnGradient)" name="MCN" />
              <Area type="monotone" dataKey="celebrity" stroke="#a855f7" fill="url(#celebrityGradient)" name={zh ? '明星' : 'Celebrities'} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Content Analysis */}
        <Card className="bg-gray-900/50 border-white/10">
          <CardHeader>
            <CardTitle>{zh ? '内容类型分析' : 'Content Type Analysis'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={contentData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="video" fill="#a855f7" name={zh ? '视频' : 'Video'} />
                <Bar dataKey="audio" fill="#06b6d4" name={zh ? '音频' : 'Audio'} />
                <Bar dataKey="image" fill="#ec4899" name={zh ? '图片' : 'Image'} />
                <Bar dataKey="live" fill="#f59e0b" name={zh ? '直播' : 'Live'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Type Distribution */}
        <Card className="bg-gray-900/50 border-white/10">
          <CardHeader>
            <CardTitle>{zh ? '内容类型分布' : 'Content Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={contentTypeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.name} ${entry.value}%`}
                >
                  {contentTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Growth */}
      <Card className="bg-gray-900/50 border-white/10">
        <CardHeader>
          <CardTitle>{zh ? '收入增长趋势' : 'Revenue Growth Trend'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                name={zh ? '收入' : 'Revenue'}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Risk Alerts */}
      <Card className="bg-gray-900/50 border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            {zh ? '风控预警' : 'Risk Alerts'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  alert.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : alert.type === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : 'bg-cyan-500/10 border border-cyan-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      alert.type === 'error'
                        ? 'text-red-400'
                        : alert.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  />
                  <span className="text-sm text-white">{alert.message}</span>
                </div>
                <span className="text-xs text-gray-500">{alert.time}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
