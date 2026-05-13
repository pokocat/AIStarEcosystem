"use client";

import React, { useEffect, useState } from 'react';
import {
  User, Shield, Bell, Palette, Globe, CreditCard, Key,
  Save, ChevronRight, Moon, Sun, Monitor, Check, Mail,
  Smartphone, Lock, Eye, EyeOff, LogOut, Trash2, Download,
  Building2, Calendar, Link as LinkIcon
} from 'lucide-react';
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { motion } from "motion/react";
import { useTheme, themeConfig } from "@ai-star-eco/ui";
import { ThemeSwitcher } from "../ThemeSwitcher";
import type { Lang } from "../../translations";
import { SETTINGS_SECTIONS } from "@/constants/settings-sections";
import { RECHARGE_HISTORY } from "@/mocks/settings";
import type { RechargeRecord } from "@ai-star-eco/types/settings";
import type { Studio } from "@ai-star-eco/types/account";
import { STUDIO_KIND_LABEL_ZH } from "@ai-star-eco/types/account";
import { SettingsApi, AccountApi } from "@/api";
import { formatCredits, formatCurrency } from "@/lib/format";

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button onClick={onChange}
    className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-700'}`}>
    <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${checked ? 'left-5' : 'left-0.5'}`} />
  </button>
);

export const SettingsPage = ({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) => {
  const zh = lang === 'zh';
  const { theme } = useTheme();
  const [section, setSection] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profile 从 /api/me 拉取，保存后回写同一接口
  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    bio: '',
    phone: '',
  });
  const [studio, setStudio] = useState<Studio | null>(null);
  const [username, setUsername] = useState<string>('');

  const [notifications, setNotifications] = useState({
    email: true, push: true, sms: false,
    newFan: true, revenue: true, contentReview: true, systemUpdate: false, marketing: false,
  });

  const [rechargeHistory, setRechargeHistory] = useState<RechargeRecord[]>(RECHARGE_HISTORY);

  useEffect(() => {
    let cancelled = false;
    SettingsApi.listRechargeHistory()
      .then(list => { if (!cancelled && list.length > 0) setRechargeHistory(list); })
      .catch(() => { /* mock 兜底 */ });
    AccountApi.getMe()
      .then(me => {
        if (cancelled) return;
        setProfile({
          displayName: me.displayName ?? '',
          email: me.email ?? '',
          bio: me.bio ?? '',
          phone: me.phone ?? '',
        });
        setStudio(me.studio ?? null);
        setUsername(me.username ?? '');
      })
      .catch(() => { /* 未登录或接口失败，保持空表单 */ });
    return () => { cancelled = true; };
  }, []);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('zh-CN'); } catch { return iso; }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await AccountApi.updateProfile({
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        phone: profile.phone,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err?.message ?? (zh ? '保存失败' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '设置' : 'Settings'}</h1>
        <p className="text-gray-400 font-light mt-1">{zh ? '管理你的账号、通知和外观偏好' : 'Manage account, notifications and preferences'}</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-2 space-y-0.5">
            {SETTINGS_SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  section === s.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
                <s.icon className="w-4 h-4" />
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <motion.div key={section} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .2 }}>
            {/* Profile */}
            {section === 'profile' && (
              <div className="space-y-6">
                {/* 经纪公司资料（仅 studio 账户可见） */}
                {studio && (
                  <div className="bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>
                            {studio.name}
                          </h3>
                          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
                              {STUDIO_KIND_LABEL_ZH[studio.kind] ?? studio.kind}
                            </Badge>
                            <Badge className={studio.status === 'active'
                              ? 'bg-green-500/10 text-green-300 border-green-500/20'
                              : 'bg-red-500/10 text-red-300 border-red-500/20'}>
                              {studio.status === 'active' ? '运营中' : studio.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">经纪公司 ID</div>
                        <div className="text-gray-200 font-mono break-all">{studio.id}</div>
                      </div>
                      <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">运营账户</div>
                        <div className="text-gray-200">@{username}</div>
                      </div>
                      {studio.contactEmail && (
                        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> 对外联系邮箱</div>
                          <div className="text-gray-200 break-all">{studio.contactEmail}</div>
                        </div>
                      )}
                      <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> 成立时间</div>
                        <div className="text-gray-200">{formatDate(studio.createdAt)}</div>
                      </div>
                      {studio.bio && (
                        <div className="bg-black/30 border border-white/5 rounded-lg p-3 sm:col-span-2">
                          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">简介</div>
                          <div className="text-gray-200 leading-relaxed">{studio.bio}</div>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      修改经纪公司档案需联系平台运营（admin 控制台）。此处为 1:1 关联当前登录账户的只读视图。
                    </p>
                  </div>
                )}

              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '个人资料' : 'Profile'}</h3>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center text-3xl">👤</div>
                  <div>
                    <Button variant="outline" size="sm" className="border-white/10 text-gray-400 text-xs mb-1">{zh ? '更换头像' : 'Change Avatar'}</Button>
                    <p className="text-[10px] text-gray-600">{zh ? '支持 JPG, PNG, 最大 2MB' : 'JPG, PNG, max 2MB'}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '显示名称' : 'Display Name'}</label>
                    <input value={profile.displayName} onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '邮箱' : 'Email'}</label>
                    <input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '个人简介' : 'Bio'}</label>
                  <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none transition h-20 resize-none" />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1 disabled:opacity-60">
                    {saving
                      ? <>{zh ? '保存中...' : 'Saving...'}</>
                      : saved
                        ? <><Check className="w-4 h-4" /> {zh ? '已保存' : 'Saved'}</>
                        : <><Save className="w-4 h-4" /> {zh ? '保存更改' : 'Save Changes'}</>}
                  </Button>
                  {saveError && <span className="text-xs text-red-400">{saveError}</span>}
                </div>
              </div>
              </div>
            )}

            {/* Account Security */}
            {section === 'account' && (
              <div className="space-y-4">
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                  <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '账号安全' : 'Account Security'}</h3>
                  {[
                    { icon: Lock, label: zh ? '修改密码' : 'Change Password', desc: zh ? '上次修改: 30天前' : 'Last changed: 30 days ago', action: zh ? '修改' : 'Change' },
                    { icon: Smartphone, label: zh ? '两步验证' : 'Two-Factor Auth', desc: zh ? '已启用 (手机验证)' : 'Enabled (SMS)', action: zh ? '管理' : 'Manage', badge: true },
                    { icon: Key, label: 'API Key', desc: 'sk-****...****a8b3', action: zh ? '重新生成' : 'Regenerate' },
                    { icon: Shield, label: zh ? '登录设备' : 'Login Devices', desc: zh ? '3个活跃设备' : '3 active devices', action: zh ? '查看' : 'View' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-white/5 hover:border-white/10 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center"><item.icon className="w-4 h-4 text-gray-400" /></div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">{item.label} {item.badge && <Badge className="text-[10px] bg-green-500/10 text-green-400 border-0">{zh ? '已开启' : 'On'}</Badge>}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="border-white/10 text-gray-400 text-xs">{item.action}</Button>
                    </div>
                  ))}
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                  <h4 className="text-sm font-bold text-red-400 mb-2">{zh ? '危险区域' : 'Danger Zone'}</h4>
                  <p className="text-xs text-gray-500 mb-3">{zh ? '此操作不可撤销，所有数据将永久删除。' : 'This action is irreversible. All data will be permanently deleted.'}</p>
                  <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1 text-xs"><Trash2 className="w-3 h-3" /> {zh ? '删除账号' : 'Delete Account'}</Button>
                </div>
              </div>
            )}

            {/* Notifications */}
            {section === 'notification' && (
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '通知设置' : 'Notifications'}</h3>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{zh ? '通知渠道' : 'Channels'}</div>
                  <div className="space-y-3">
                    {[
                      { key: 'email' as const, icon: Mail, label: zh ? '邮件通知' : 'Email' },
                      { key: 'push' as const, icon: Bell, label: zh ? '推送通知' : 'Push' },
                      { key: 'sms' as const, icon: Smartphone, label: zh ? '短信通知' : 'SMS' },
                    ].map(ch => (
                      <div key={ch.key} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3"><ch.icon className="w-4 h-4 text-gray-400" /><span className="text-sm">{ch.label}</span></div>
                        <Toggle checked={notifications[ch.key]} onChange={() => setNotifications(n => ({ ...n, [ch.key]: !n[ch.key] }))} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{zh ? '通知类型' : 'Types'}</div>
                  <div className="space-y-3">
                    {[
                      { key: 'newFan' as const, label: zh ? '新粉丝关注' : 'New Followers' },
                      { key: 'revenue' as const, label: zh ? '收益到账' : 'Revenue Received' },
                      { key: 'contentReview' as const, label: zh ? '内容审核结果' : 'Content Review' },
                      { key: 'systemUpdate' as const, label: zh ? '系统更新' : 'System Updates' },
                      { key: 'marketing' as const, label: zh ? '营销推广' : 'Marketing' },
                    ].map(t => (
                      <div key={t.key} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                        <span className="text-sm">{t.label}</span>
                        <Toggle checked={notifications[t.key]} onChange={() => setNotifications(n => ({ ...n, [t.key]: !n[t.key] }))} />
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSave} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1">
                  {saved ? <><Check className="w-4 h-4" /> {zh ? '已保存' : 'Saved'}</> : <><Save className="w-4 h-4" /> {zh ? '保存' : 'Save'}</>}
                </Button>
              </div>
            )}

            {/* Appearance */}
            {section === 'appearance' && (
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-6">
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>外观</h3>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">主题</div>
                  <p className="text-[11px] text-gray-500 mb-3">切换后自动保存到本地，下次打开自动应用。</p>
                  <ThemeSwitcher lang="zh" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">字体</div>
                  <div className="flex gap-2 flex-wrap">
                    {['Inter', 'Space Grotesk', 'JetBrains Mono'].map(f => (
                      <button key={f} className="px-4 py-2.5 rounded-lg border border-white/5 text-sm text-gray-400 hover:border-white/15 transition" style={{ fontFamily: f }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Spend Flow */}
            {section === 'billing' && (
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '消费流水' : 'Spend History'}</h3>
                <div className="space-y-2">
                  {rechargeHistory.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 text-xs">
                      <div><span className="text-gray-500">{r.date}</span> <span className="text-white ml-2">{r.desc}</span></div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{r.priceCents > 0 ? formatCurrency(r.priceCents, "CNY") : (zh ? '免费' : 'Free')}</span>
                        <span className="text-cyan-400 font-semibold">+{formatCredits(r.creditsAdded)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Management */}
            {section === 'data' && (
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '数据管理' : 'Data Management'}</h3>
                {[
                  { label: zh ? '导出全部艺人数据' : 'Export All Artist Data', desc: zh ? 'JSON格式，含才艺、统计、作品数据' : 'JSON format, talents, stats, works', icon: Download, color: 'text-cyan-400' },
                  { label: zh ? '导出财务报表' : 'Export Financial Report', desc: zh ? 'CSV格式，含交易明细和收益汇总' : 'CSV format, transactions & revenue', icon: CreditCard, color: 'text-green-400' },
                  { label: zh ? '导出版权资产清单' : 'Export Copyright Assets', desc: zh ? '含链上ID和版权证书' : 'With chain IDs and certificates', icon: Shield, color: 'text-purple-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-white/5 hover:border-white/10 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center"><item.icon className={`w-4 h-4 ${item.color}`} /></div>
                      <div>
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-white/10 text-gray-400 text-xs gap-1"><Download className="w-3 h-3" /> {zh ? '导出' : 'Export'}</Button>
                  </div>
                ))}
                <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{zh ? '存储空间' : 'Storage'}</span>
                    <span className="text-cyan-400 font-semibold">42.8 GB / 100 GB</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" style={{ width: '42.8%' }} />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
