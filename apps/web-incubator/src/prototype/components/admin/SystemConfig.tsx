/**
 * 系统配置页面
 * 权限管理、费率配置、审核规则、平台参数
 */
import React, { useState } from 'react';
import {
  Settings, Shield, DollarSign, CheckCircle2, Sliders,
  Save, RotateCcw, Eye, Edit3, Plus, Trash2, AlertTriangle, Download
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { motion } from "motion/react";
import type { Lang } from "../../translations";

interface SystemConfigProps {
  lang: Lang;
}

export const SystemConfig: React.FC<SystemConfigProps> = ({ lang }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<'permissions' | 'rates' | 'rules' | 'params'>('permissions');

  // Mock configuration data
  const [permissions, setPermissions] = useState({
    mcnCreateArtist: true,
    mcnSignCelebrity: true,
    mcnPublishContent: true,
    celebrityReviewContent: true,
    celebrityViewRevenue: true,
    fanPurchaseNFT: true,
    fanCommentContent: true,
  });

  const [rates, setRates] = useState({
    mcnPlatformCommission: '5',
    celebrityMinRate: '20',
    celebrityMaxRate: '50',
    fanPlatformFee: '3',
    nftTransactionFee: '2.5',
  });

  const [rules, setRules] = useState({
    autoReview: false,
    sensitiveWordFilter: true,
    minContentLength: '50',
    maxContentSize: '100',
    allowAnonymous: false,
  });

  const [params, setParams] = useState({
    sessionTimeout: '30',
    maxUploadSize: '500',
    enableCache: true,
    enableAnalytics: true,
    maintenanceMode: false,
  });

  const permissionLabels = {
    mcnCreateArtist: { zh: 'MCN创建AI艺人', en: 'MCN Create AI Artist' },
    mcnSignCelebrity: { zh: 'MCN签约明星', en: 'MCN Sign Celebrity' },
    mcnPublishContent: { zh: 'MCN发布内容', en: 'MCN Publish Content' },
    celebrityReviewContent: { zh: '明星审核内容', en: 'Celebrity Review Content' },
    celebrityViewRevenue: { zh: '明星查看收益', en: 'Celebrity View Revenue' },
    fanPurchaseNFT: { zh: '粉丝购买NFT', en: 'Fan Purchase NFT' },
    fanCommentContent: { zh: '粉丝评论内容', en: 'Fan Comment' },
  };

  const rateLabels = {
    mcnPlatformCommission: { zh: 'MCN平台佣金', en: 'MCN Platform Commission', unit: '%' },
    celebrityMinRate: { zh: '明星最低分成', en: 'Celebrity Min Rate', unit: '%' },
    celebrityMaxRate: { zh: '明星最高分成', en: 'Celebrity Max Rate', unit: '%' },
    fanPlatformFee: { zh: '粉丝交易手续费', en: 'Fan Transaction Fee', unit: '%' },
    nftTransactionFee: { zh: 'NFT交易手续费', en: 'NFT Transaction Fee', unit: '%' },
  };

  const ruleLabels = {
    autoReview: { zh: '自动审核', en: 'Auto Review' },
    sensitiveWordFilter: { zh: '敏感词过滤', en: 'Sensitive Word Filter' },
    minContentLength: { zh: '内容最小长度', en: 'Min Content Length', unit: zh ? '字' : 'chars' },
    maxContentSize: { zh: '内容最大大小', en: 'Max Content Size', unit: 'MB' },
    allowAnonymous: { zh: '允许匿名访问', en: 'Allow Anonymous' },
  };

  const paramLabels = {
    sessionTimeout: { zh: '会话超时时间', en: 'Session Timeout', unit: zh ? '分钟' : 'min' },
    maxUploadSize: { zh: '最大上传大小', en: 'Max Upload Size', unit: 'MB' },
    enableCache: { zh: '启用缓存', en: 'Enable Cache' },
    enableAnalytics: { zh: '启用数据分析', en: 'Enable Analytics' },
    maintenanceMode: { zh: '维护模式', en: 'Maintenance Mode' },
  };

  const handleSave = () => {
    console.log('Saving configuration...', { permissions, rates, rules, params });
  };

  const handleReset = () => {
    console.log('Resetting to defaults...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{zh ? '系统配置' : 'System Configuration'}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {zh ? '管理平台权限、费率、审核规则和系统参数' : 'Manage permissions, rates, review rules, and system parameters'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="border-white/10 hover:bg-white/5">
            <RotateCcw className="w-4 h-4 mr-2" />
            {zh ? '重置' : 'Reset'}
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            {zh ? '保存配置' : 'Save Config'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['permissions', 'rates', 'rules', 'params'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
              activeTab === tab ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {zh
              ? { permissions: '权限管理', rates: '费率配置', rules: '审核规则', params: '系统参数' }[tab]
              : { permissions: 'Permissions', rates: 'Rates', rules: 'Rules', params: 'Parameters' }[tab]}
            {activeTab === tab && (
              <motion.div layoutId="activeConfigTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
            )}
          </button>
        ))}
      </div>

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <Card className="bg-gray-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                {zh ? '权限控制' : 'Permission Control'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(permissions).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-white/5">
                  <div>
                    <Label htmlFor={key} className="text-base font-medium text-white">
                      {zh ? permissionLabels[key as keyof typeof permissionLabels].zh : permissionLabels[key as keyof typeof permissionLabels].en}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      {zh ? '控制此功能的访问权限' : 'Control access to this feature'}
                    </p>
                  </div>
                  <Switch
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, [key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rates Tab */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          <Card className="bg-gray-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                {zh ? '费率配置' : 'Rate Configuration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(rates).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-white/5">
                  <div className="flex-1">
                    <Label htmlFor={key} className="text-base font-medium text-white">
                      {zh ? rateLabels[key as keyof typeof rateLabels].zh : rateLabels[key as keyof typeof rateLabels].en}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      {zh ? '调整费率比例' : 'Adjust rate percentage'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={key}
                      type="number"
                      value={value}
                      onChange={(e) => setRates({ ...rates, [key]: e.target.value })}
                      className="w-24 bg-black/30 border-white/10 text-right"
                    />
                    <span className="text-gray-400 text-sm min-w-[30px]">
                      {rateLabels[key as keyof typeof rateLabels].unit}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/20 to-cyan-900/20 border-green-500/20">
            <CardContent className="p-6">
              <p className="text-sm text-gray-400">
                {zh
                  ? '注意：费率调整将影响所有新签约合同，已签约合同不受影响'
                  : 'Note: Rate changes apply to new contracts only, existing contracts are not affected'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <Card className="bg-gray-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                {zh ? '审核规则' : 'Review Rules'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(rules).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-white/5">
                  <div className="flex-1">
                    <Label htmlFor={key} className="text-base font-medium text-white">
                      {zh ? ruleLabels[key as keyof typeof ruleLabels].zh : ruleLabels[key as keyof typeof ruleLabels].en}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      {zh ? '配置内容审核规则' : 'Configure content review rules'}
                    </p>
                  </div>
                  {typeof value === 'boolean' ? (
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => setRules({ ...rules, [key]: checked })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        id={key}
                        type="number"
                        value={value}
                        onChange={(e) => setRules({ ...rules, [key]: e.target.value })}
                        className="w-24 bg-black/30 border-white/10 text-right"
                      />
                      <span className="text-gray-400 text-sm min-w-[30px]">
                        {(ruleLabels[key as keyof typeof ruleLabels] as { unit?: string }).unit}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Parameters Tab */}
      {activeTab === 'params' && (
        <div className="space-y-4">
          <Card className="bg-gray-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                {zh ? '系统参数' : 'System Parameters'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-white/5">
                  <div className="flex-1">
                    <Label htmlFor={key} className="text-base font-medium text-white">
                      {zh ? paramLabels[key as keyof typeof paramLabels].zh : paramLabels[key as keyof typeof paramLabels].en}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      {zh ? '调整系统运行参数' : 'Adjust system parameters'}
                    </p>
                  </div>
                  {typeof value === 'boolean' ? (
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => setParams({ ...params, [key]: checked })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        id={key}
                        type="number"
                        value={value}
                        onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                        className="w-24 bg-black/30 border-white/10 text-right"
                      />
                      <span className="text-gray-400 text-sm min-w-[50px]">
                        {(paramLabels[key as keyof typeof paramLabels] as { unit?: string }).unit}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {params.maintenanceMode && (
            <Card className="bg-red-900/20 border-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="font-semibold">
                    {zh ? '维护模式已启用' : 'Maintenance Mode Enabled'}
                  </p>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {zh
                    ? '平台当前处于维护模式，仅管理员可访问'
                    : 'Platform is in maintenance mode, admin access only'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">{zh ? '配置管理提示' : 'Configuration Tips'}</h3>
              <p className="text-sm text-gray-400">
                {zh
                  ? '请谨慎修改系统配置，重大变更建议先在测试环境验证'
                  : 'Modify with caution, test major changes in staging environment first'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-purple-500/30 hover:bg-purple-500/10">
                <Eye className="w-4 h-4 mr-2" />
                {zh ? '查看日志' : 'View Logs'}
              </Button>
              <Button variant="outline" className="border-cyan-500/30 hover:bg-cyan-500/10">
                <Download className="w-4 h-4 mr-2" />
                {zh ? '导出配置' : 'Export Config'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
