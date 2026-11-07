/**
 * 星云运营端 (StarCloud Admin Portal)
 * 面向平台运营团队、法务、审核人员
 * 核心功能：平台治理、内容审核、法务中心、运营分析
 */
import React, { useState } from 'react';
import {
  Shield, Users, CheckCircle2, Scale, BarChart3, Settings,
  Globe as GlobeIcon, LogOut, ChevronRight, AlertTriangle,
  FileText, TrendingUp, Bell, Menu, X, Eye, Ban
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { motion } from "motion/react";
import { sidebarStyle } from "../ThemeProvider";
import { ColorModeToggle } from "../ColorModeToggle";
import type { Lang } from "../../translations";
import { UserManagement } from "./UserManagement";
import { ContentModeration } from "./ContentModeration";
import { LegalCenter } from "./LegalCenter";
import { PlatformAnalytics } from "./PlatformAnalytics";
import { SystemConfig } from "./SystemConfig";

interface AdminConsoleProps {
  onLogout: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const AdminConsole: React.FC<AdminConsoleProps> = ({ onLogout, lang, setLang }) => {
  const zh = lang === 'zh';
  const themeStyles = sidebarStyle;
  const [activePage, setActivePage] = useState('dashboard');
  const isNarrow = () => window.matchMedia('(max-width: 767px)').matches;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isNarrow);

  // Mock data
  const platformStats = {
    totalUsers: '15,234',
    totalContent: '89,456',
    pendingReview: 127,
    monthlyRevenue: '¥2.3M',
  };

  const sidebarMenu = [
    { id: 'dashboard', icon: BarChart3, label: { zh: '运营总览', en: 'Dashboard' } },
    { id: 'users', icon: Users, label: { zh: '用户管理', en: 'User Management' } },
    { id: 'moderation', icon: CheckCircle2, label: { zh: '内容审核', en: 'Content Moderation' } },
    { id: 'legal', icon: Scale, label: { zh: '法务中心', en: 'Legal Center' } },
    { id: 'analytics', icon: TrendingUp, label: { zh: '平台分析', en: 'Platform Analytics' } },
    { id: 'config', icon: Settings, label: { zh: '系统配置', en: 'System Config' } },
  ];

  return (
    <div className="h-screen w-full flex bg-black text-white overflow-hidden">
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 280 }}
        className={`${themeStyles.bg} ${themeStyles.border} border-r flex flex-col shrink-0`}
      >
        {/* Header */}
        <div className={`h-16 flex items-center border-b border-white/10 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-cyan-400" />
              <span className="font-bold text-lg">{zh ? '星云运营端' : 'StarCloud'}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hover:bg-white/10"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarMenu.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActivePage(item.id); if (isNarrow()) setSidebarCollapsed(true); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activePage === item.id
                    ? themeStyles.itemActive
                    : themeStyles.itemBase
                }`}
              >
                <IconComponent size={18} />
                {!sidebarCollapsed && <span>{zh ? item.label.zh : item.label.en}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={onLogout}
            className="w-full justify-start hover:bg-white/10"
            size="sm"
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span className="ml-2">{zh ? '退出登录' : 'Logout'}</span>}
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 flex items-center justify-between gap-2 px-3 md:px-6 border-b border-white/10 bg-black/50 backdrop-blur-sm">
          <h1 className="text-base md:text-xl font-bold whitespace-nowrap">
            {zh
              ? sidebarMenu.find((m) => m.id === activePage)?.label.zh
              : sidebarMenu.find((m) => m.id === activePage)?.label.en}
          </h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden md:inline-flex border-red-500/30 text-red-400">
              {zh ? '管理员' : 'Admin'}
            </Badge>
            <ColorModeToggle lang={zh ? 'zh' : 'en'} />
            <Button variant="ghost" size="sm">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {activePage === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gray-900/50 border-cyan-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-400">{zh ? '平台用户' : 'Total Users'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-cyan-400">{platformStats.totalUsers}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-purple-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-400">{zh ? '平台内容' : 'Total Content'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-400">{platformStats.totalContent}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-amber-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-400">{zh ? '待审核' : 'Pending Review'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-400">{platformStats.pendingReview}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-green-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-400">{zh ? '月度收入' : 'Monthly Revenue'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-400">{platformStats.monthlyRevenue}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Info */}
              <Card className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-500/20">
                <CardHeader>
                  <CardTitle>{zh ? '欢迎来到星云运营端' : 'Welcome to StarCloud Admin Portal'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    {zh
                      ? '平台治理中心，管理用户、审核内容、处理法务事宜、分析运营数据。'
                      : 'Platform governance center. Manage users, review content, handle legal matters, and analyze operational data.'}
                  </p>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card className="bg-gray-900/50 border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    {zh ? '待处理告警' : 'Pending Alerts'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                      <span className="text-sm">{zh ? '疑似侵权内容 #12345' : 'Suspected Infringement #12345'}</span>
                      <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                        {zh ? '紧急' : 'Urgent'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                      <span className="text-sm">{zh ? '用户投诉未处理' : 'Unresolved User Complaint'}</span>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                        {zh ? '高' : 'High'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activePage === 'users' && <UserManagement lang={lang} />}

          {activePage === 'moderation' && <ContentModeration lang={lang} />}

          {activePage === 'legal' && <LegalCenter lang={lang} />}

          {activePage === 'analytics' && <PlatformAnalytics lang={lang} />}

          {activePage === 'config' && <SystemConfig lang={lang} />}
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
