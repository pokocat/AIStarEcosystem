"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 V4 · 其余子页面
//   设置 / 会员与算力 / 存储用量 / 声音克隆录制 / 衍生物查看器
// ============================================================
const hMM : any = React.createElement;
const { useState: useStateMM, useEffect: useEffectMM } = React;
const { WxNav: WxNavMM } = MShell;
const { MStatus: MStatusMM, CornerTicks: CornerTicksMM } = MKit;

// 通用：分组标题
function GroupTitle({ children }) {
  return hMM('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, children);
}
// 通用：列表行
function Row({ icon, label, sub, value, badge, toggle, on, onClick, last, danger }) {
  return hMM('button', { onClick, className: 'm-tap', style: {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 15px', textAlign: 'left', cursor: onClick || toggle ? 'pointer' : 'default',
    background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--line)' } },
    icon && hMM('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, display: 'grid', placeItems: 'center',
      background: danger ? 'var(--err-s)' : 'var(--surface-3)', color: danger ? 'var(--err)' : 'var(--ink-2)' } }, hMM(icon, { size: 18, stroke: 1.9 })),
    hMM('div', { style: { flex: 1, minWidth: 0 } },
      hMM('div', { style: { fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--err)' : 'var(--ink)' } }, label),
      sub && hMM('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, sub)),
    value && hMM('span', { style: { fontSize: 13, color: 'var(--ink-3)', flex: '0 0 auto' } }, value),
    badge != null && hMM(UI.Badge, { tone: 'primary' }, badge),
    toggle
      ? hMM('span', { style: { width: 44, height: 26, borderRadius: 99, flex: '0 0 auto', background: on ? 'var(--primary)' : 'var(--line-3)', position: 'relative', transition: 'background .2s' } },
          hMM('span', { style: { position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-1)', transition: 'left .2s' } }))
      : onClick && hMM(Icons.chevR, { size: 17, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }));
}

// ============================================================
// 设置
// ============================================================
function MSettings({ ctx }) {
  const [push, setPush] = useStateMM(true);
  const [taskNotify, setTaskNotify] = useStateMM(true);
  const [watermark, setWatermark] = useStateMM(true);
  const [autoArchive, setAutoArchive] = useStateMM(false);

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '设置' },
    hMM(WxNavMM, { title: '设置', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '6px 18px 30px' } },
      hMM(GroupTitle, null, '通知'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.bell, label: '推送通知', sub: '接收平台消息与活动', toggle: true, on: push, onClick: () => setPush(v => !v) }),
        hMM(Row, { icon: Icons.bolt, label: '任务完成提醒', sub: '生成完成后通知我', toggle: true, on: taskNotify, onClick: () => setTaskNotify(v => !v), last: true })),

      hMM(GroupTitle, null, '创作偏好'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.scan, label: '生成默认加水印', sub: '导出成片带平台标识', toggle: true, on: watermark, onClick: () => setWatermark(v => !v) }),
        hMM(Row, { icon: Icons.archive, label: '定稿后自动归档', sub: '完成创建即存入名录', toggle: true, on: autoArchive, onClick: () => setAutoArchive(v => !v) }),
        hMM(Row, { icon: Icons.globe, label: '默认语言', value: '简体中文', onClick: () => ctx.toast('切换语言'), last: true })),

      hMM(GroupTitle, null, '隐私与合规'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.shield, label: '肖像授权管理', sub: '已签署 ' + DATA.LICENSES.filter(l => l.status === 'active').length + ' 份', onClick: () => ctx.go('licenses') }),
        hMM(Row, { icon: Icons.lock, label: '隐私与数据', sub: '素材加密 · 可申请删除', onClick: () => ctx.toast('隐私设置') }),
        hMM(Row, { icon: Icons.doc, label: '合规规范', sub: '《数字人肖像合规规范》', onClick: () => ctx.toast('查看规范'), last: true })),

      hMM(GroupTitle, null, '账户'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.idcard, label: '账户与实名', value: '已实名', onClick: () => ctx.toast('账户信息') }),
        hMM(Row, { icon: Icons.folder, label: '存储用量', sub: '68 / 200 GB', onClick: () => ctx.go('storage') }),
        hMM(Row, { icon: Icons.trash, label: '清除缓存', value: '126 MB', onClick: () => ctx.toast('已清除缓存', { tone: 'ok' }), last: true })),

      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.info, label: '关于', value: 'v4.0', onClick: () => ctx.toast('数字人资产平台 v4.0') }),
        hMM(Row, { label: '退出登录', danger: true, icon: Icons.plug, onClick: () => ctx.toast('已退出登录'), last: true }))));
}

// ============================================================
// 会员与算力
// ============================================================
const PLANS = [
  { key: 'free', name: '体验版', price: '¥0', credits: '50 点/月', feats: ['基础形象生成', '标准图集', '带水印导出'], cur: false },
  { key: 'pro', name: 'PRO', price: '¥99', unit: '/月', credits: '1,500 点/月', feats: ['高清无水印', '全部衍生类型', '真人复刻 5 个', '优先队列'], cur: true, hot: true },
  { key: 'studio', name: '工作室版', price: '¥399', unit: '/月', credits: '8,000 点/月', feats: ['团队协作', '商用授权批量', 'API 接入', '专属客服'], cur: false },
];
const PACKS = [
  { c: '500', price: '¥39', tag: null },
  { c: '1,200', price: '¥89', tag: '超值' },
  { c: '3,000', price: '¥199', tag: '热门' },
  { c: '8,000', price: '¥499', tag: null },
];

function MMembership({ ctx }) {
  const [pack, setPack] = useStateMM(1);
  return hMM('div', { className: 'm-overlay', 'data-screen-label': '会员与算力' },
    hMM(WxNavMM, { title: '会员与算力', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '4px 18px 30px' } },
      // 余额卡
      hMM('div', { style: { position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-xl)', padding: '18px 20px', background: 'linear-gradient(155deg,#1C2B3A,#14202B)', color: '#fff', boxShadow: 'var(--sh-2)', marginBottom: 22 } },
        hMM('div', { style: { position: 'absolute', right: -14, bottom: -18, opacity: .1 } }, hMM(Icons.gem, { size: 110 })),
        hMM('div', { style: { position: 'relative' } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
            hMM('span', { style: { fontSize: 12.5, fontWeight: 600, opacity: .85 } }, '当前可用算力'),
            hMM('span', { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 'var(--r-pill)' } }, 'PRO')),
          hMM('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6 } },
            hMM('span', { className: 'mono', style: { fontSize: 34, fontWeight: 800, letterSpacing: '-.02em' } }, '1,240'),
            hMM('span', { style: { fontSize: 13, opacity: .85 } }, '点')),
          hMM('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 } },
            hMM('span', { style: { fontSize: 11.5, opacity: .8 } }, '本月赠送 1,500 · 已用 860 · 6 月 30 日刷新'),
            hMM('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 } }, '约可生成 28 个', hMM(Icons.user, { size: 13 }))))),

      // 充值点数
      hMM(GroupTitle, null, '充值算力'),
      hMM('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 14 } },
        PACKS.map((p, i) => {
          const on = pack === i;
          return hMM('button', { key: i, onClick: () => setPack(i), className: 'm-press', style: {
            position: 'relative', textAlign: 'left', padding: '14px 15px', cursor: 'pointer',
            background: on ? 'var(--primary-tint)' : 'var(--surface)', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'),
            borderRadius: 'var(--r-lg)', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)' } },
            p.tag && hMM('span', { style: { position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 7px', borderRadius: 'var(--r-pill)' } }, p.tag),
            hMM('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4 } },
              hMM('span', { className: 'mono', style: { fontSize: 22, fontWeight: 800, color: 'var(--ink)' } }, p.c),
              hMM('span', { style: { fontSize: 12, color: 'var(--ink-3)' } }, '点')),
            hMM('div', { style: { fontSize: 15, fontWeight: 700, color: on ? 'var(--primary)' : 'var(--ink)', marginTop: 6 } }, p.price));
        })),
      hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.gem, onClick: () => ctx.toast('充值 ' + PACKS[pack].c + ' 点 · ' + PACKS[pack].price, { tone: 'ok' }), style: { marginBottom: 24 } }, '立即充值 · ' + PACKS[pack].price),

      // 订阅套餐
      hMM(GroupTitle, null, '订阅套餐'),
      hMM('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        PLANS.map(p => hMM('div', { key: p.key, style: {
          position: 'relative', overflow: 'hidden', padding: '16px 17px', borderRadius: 'var(--r-lg)',
          background: 'var(--surface)', border: '1.5px solid ' + (p.cur ? 'var(--primary)' : 'var(--line-2)'), boxShadow: p.cur ? 'var(--sh-2)' : 'var(--sh-1)' } },
          hMM('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 } },
            hMM('div', null,
              hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                hMM('span', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 18 } }, p.name),
                p.hot && hMM(UI.Badge, { tone: 'primary' }, '当前'),
                p.cur && !p.hot && hMM(UI.Badge, { tone: 'ok' }, '使用中')),
              hMM('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 3 } }, p.credits)),
            hMM('div', { style: { textAlign: 'right' } },
              hMM('span', { className: 'mono', style: { fontSize: 22, fontWeight: 800, color: 'var(--ink)' } }, p.price),
              p.unit && hMM('span', { style: { fontSize: 12, color: 'var(--ink-3)' } }, p.unit))),
          hMM('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginBottom: p.cur ? 0 : 13 } },
            p.feats.map(f => hMM('span', { key: f, style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-2)' } },
              hMM(Icons.check, { size: 13, stroke: 2.4, style: { color: 'var(--primary)' } }), f))),
          !p.cur && hMM(UI.Button, { variant: p.key === 'studio' ? 'dark' : 'soft', full: true, onClick: () => ctx.toast('升级到 ' + p.name) }, p.key === 'free' ? '降级到体验版' : '升级到 ' + p.name))))));
}

// ============================================================
// 存储用量
// ============================================================
const STORAGE = [
  { name: '形象图集', size: 28.4, color: 'var(--primary)', icon: 'image' },
  { name: '衍生视频', size: 19.2, color: '#1AA06E', icon: 'film' },
  { name: '3D 资产', size: 11.6, color: '#D9920E', icon: 'cube' },
  { name: '声音文件', size: 5.3, color: '#8A6BFF', icon: 'mic' },
  { name: '授权素材', size: 3.5, color: 'var(--ink-3)', icon: 'shield' },
];
function MStorage({ ctx }) {
  const used = STORAGE.reduce((a, s) => a + s.size, 0);
  const total = 200;
  return hMM('div', { className: 'm-overlay', 'data-screen-label': '存储用量' },
    hMM(WxNavMM, { title: '存储用量', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '4px 18px 30px' } },
      // 总览
      hMM('div', { className: 'm-card', style: { padding: '20px 18px', marginBottom: 20, textAlign: 'center' } },
        hMM('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4 } },
          hMM('span', { className: 'mono', style: { fontSize: 34, fontWeight: 800, color: 'var(--ink)' } }, used.toFixed(1)),
          hMM('span', { style: { fontSize: 14, color: 'var(--ink-3)' } }, '/ ' + total + ' GB')),
        hMM('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 } }, 'PRO 会员 · 共 ' + total + ' GB 空间'),
        // 堆叠条
        hMM('div', { style: { display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-3)', marginBottom: 14 } },
          STORAGE.map(s => hMM('div', { key: s.name, style: { width: (s.size / total * 100) + '%', background: s.color } }))),
        hMM(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.gem, onClick: () => ctx.go('membership') }, '扩容空间')),

      hMM(GroupTitle, null, '分类占用'),
      hMM('div', { className: 'm-card' },
        STORAGE.map((s, i) => hMM('div', { key: s.name, style: { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderBottom: i < STORAGE.length - 1 ? '1px solid var(--line)' : 'none' } },
          hMM('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,' + s.color + ' 13%, transparent)', color: s.color } }, hMM(Icons[s.icon], { size: 18, stroke: 1.9 })),
          hMM('div', { style: { flex: 1, minWidth: 0 } },
            hMM('div', { style: { fontSize: 14, fontWeight: 600 } }, s.name),
            hMM('div', { style: { marginTop: 6 } }, hMM('div', { style: { height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' } },
              hMM('div', { style: { width: (s.size / used * 100) + '%', height: '100%', background: s.color, borderRadius: 99 } })))),
          hMM('span', { className: 'mono', style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flex: '0 0 auto' } }, s.size + ' GB')))),

      hMM('div', { style: { marginTop: 16 } },
        hMM(UI.Button, { variant: 'line', full: true, icon: Icons.trash, onClick: () => ctx.toast('已清理临时文件 · 释放 1.2 GB', { tone: 'ok' }) }, '清理临时文件'))));
}

// ============================================================
// 声音克隆 · 录制流程
// ============================================================
const VOICE_SCRIPT = '你好，这是我的声音样本。我正在用平台克隆我自己的声线，用清晰自然的语气朗读这段文字，方便系统更准确地学习我的音色与节奏。';
function MVoiceClone({ ctx }) {
  const [stage, setStage] = useStateMM('intro'); // intro | rec | done
  const [count, setCount] = useStateMM(3);
  const [progress, setProgress] = useStateMM(0);

  useEffectMM(() => {
    if (stage !== 'rec') return;
    if (count > 0) { const t = setTimeout(() => setCount(c => c - 1), 800); return () => clearTimeout(t); }
    const iv = setInterval(() => setProgress(p => { const n = Math.min(100, p + 100 / 50); if (n >= 100) { clearInterval(iv); setTimeout(() => setStage('done'), 400); } return n; }), 100);
    return () => clearInterval(iv);
  }, [stage, count]);

  const read = Math.floor((progress / 100) * VOICE_SCRIPT.length);
  const recording = stage === 'rec' && count === 0;

  // 波形
  const bars = Array.from({ length: 38 }, (_, i) => 6 + Math.abs(Math.sin(i * 0.9)) * 22);

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '声音克隆' },
    hMM(WxNavMM, { title: '克隆我的声音', onBack: ctx.back }),

    stage === 'intro' && hMM('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMM('div', { className: 'm-body', style: { padding: '6px 20px 0' } },
        hMM('div', { className: 'm-fade' },
          hMM('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 14 } },
            hMM(Icons.bolt, { size: 13, stroke: 2 }), '约 10 秒采样'),
          hMM('h1', { style: { fontSize: 24, lineHeight: 1.18, letterSpacing: '-.02em', fontWeight: 800, margin: '0 0 8px' } }, '朗读一段文字，', hMM('br', null), '克隆你的专属声线'),
          hMM('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 22px' } }, '在安静环境正对手机朗读屏幕脚本，生成的声线可绑定到任意数字人，随时配音。')),
        // 麦克风可视
        hMM('div', { style: { display: 'grid', placeItems: 'center', padding: '20px 0 24px' } },
          hMM('div', { style: { position: 'relative', width: 120, height: 120, display: 'grid', placeItems: 'center' } },
            hMM('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, background: 'var(--primary-soft)', opacity: .5 } }),
            hMM('div', { style: { position: 'absolute', inset: 16, borderRadius: 99, background: 'var(--primary-soft)' } }),
            hMM('div', { style: { position: 'relative', width: 72, height: 72, borderRadius: 99, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 10px 24px rgba(18,179,222,.35)' } }, hMM(Icons.mic, { size: 32, stroke: 1.9 })))),
        // 要点
        hMM('div', { style: { display: 'flex', gap: 10 } },
          [['安静环境', '避免背景噪音', Icons.bell], ['正常语速', '自然不做作', Icons.wave], ['完整朗读', '约 3 句话', Icons.type]].map(([t, d, ic]) =>
            hMM('div', { key: t, style: { flex: 1, textAlign: 'center', padding: '13px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
              hMM('div', { style: { width: 32, height: 32, borderRadius: 9, margin: '0 auto 7px', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--primary)' } }, hMM(ic, { size: 16, stroke: 1.9 })),
              hMM('div', { style: { fontSize: 12, fontWeight: 700 } }, t),
              hMM('div', { style: { fontSize: 10, color: 'var(--ink-3)', marginTop: 2 } }, d))))),
      hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
        hMM(UI.Button, { variant: 'line', icon: Icons.upload, onClick: () => { setStage('done'); } }, '上传'),
        hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.mic, onClick: () => { setStage('rec'); setCount(3); setProgress(0); } }, '开始录音'))),

    stage === 'rec' && hMM('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMM('div', { className: 'm-body', style: { padding: '6px 20px 0' } },
        // 提词器
        hMM('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: '18px 18px', boxShadow: 'var(--sh-1)', marginBottom: 22 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 } },
            hMM(Icons.type, { size: 14, style: { color: 'var(--ink-3)' } }),
            hMM('span', { style: { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)' } }, '跟读脚本')),
          hMM('p', { style: { fontSize: 17, lineHeight: 1.75, fontWeight: 600, margin: 0 } },
            hMM('span', { style: { color: 'var(--primary)' } }, VOICE_SCRIPT.slice(0, read)),
            hMM('span', { style: { color: 'var(--ink-4)' } }, VOICE_SCRIPT.slice(read)))),
        // 波形 + 状态
        hMM('div', { style: { display: 'grid', placeItems: 'center', padding: '10px 0' } },
          recording
            ? hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 3, height: 60 } },
                bars.map((b, i) => hMM('span', { key: i, style: { width: 3.5, flex: '0 0 3.5px', height: b + 'px', borderRadius: 9, background: 'var(--primary)', opacity: i / 38 < progress / 100 ? 1 : .25, animation: `pulse ${0.6 + (i % 5) * 0.1}s ease-in-out infinite` } })))
            : hMM('div', { style: { width: 96, height: 96, borderRadius: 99, background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-disp)', fontSize: 40, fontWeight: 800 } }, count === 0 ? '·' : count)),
        recording && hMM('div', { style: { marginTop: 22 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, color: 'var(--err)', fontSize: 13.5, fontWeight: 700 } },
            hMM('span', { style: { width: 9, height: 9, borderRadius: 99, background: 'var(--err)', animation: 'pulse 1s infinite' } }), '录音中 · ', hMM('span', { className: 'mono' }, '00:' + String(Math.floor(progress / 100 * 5)).padStart(2, '0'))),
          hMM(UI.Progress, { pct: Math.round(progress), tone: 'primary' }))),
      !recording && hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' } }, '即将开始，请准备…')),

    stage === 'done' && hMM('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMM('div', { className: 'm-body', style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
        hMM('div', { className: 'm-fade' },
          hMM('div', { style: { width: 84, height: 84, borderRadius: 99, background: 'var(--ok-s)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', boxShadow: '0 10px 30px rgba(26,160,110,.26)' } }, hMM(Icons.checkc, { size: 44 })),
          hMM('h2', { style: { fontSize: 22, marginBottom: 8 } }, '声线克隆完成'),
          hMM('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22 } }, '已生成你的专属声线「我的声音 01」，可绑定到数字人或直接用于配音。'),
          hMM('div', { style: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 26 } },
            [['时长', '10s'], ['采样率', '48kHz'], ['相似度', '98%']].map(([k, v]) =>
              hMM('div', { key: k, style: { padding: '11px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
                hMM('div', { className: 'mono', style: { fontSize: 15, fontWeight: 700 } }, v),
                hMM('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, k)))))),
      hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
        hMM(UI.Button, { variant: 'line', icon: Icons.play, onClick: () => ctx.toast('试听声线…') }, '试听'),
        hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.checkc, onClick: () => { ctx.toast('已保存到我的声音', { tone: 'ok' }); ctx.back(); } }, '保存声线'))));
}

// ============================================================
// 衍生物查看器
// ============================================================
function MDerivView({ char, deriv, ctx }) {
  const d = DATA.DERIVS.find(x => x.key === deriv) || DATA.DERIVS[0];
  const count = (char.counts && char.counts[d.key]) || 6;
  const [sel, setSel] = useStateMM(0);
  const variants = ['key', 'threeq', 'side', 'look', 'key', 'threeq', 'side', 'look'];
  const exprs = ['calm', 'smile', 'calm', 'serious', 'smile', 'calm', 'serious', 'calm'];
  const isVid = d.key === 'video';
  const is3d = d.key === 'd3';

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '衍生查看' },
    hMM(WxNavMM, { title: char.name + ' · ' + d.name, onBack: ctx.back,
      right: hMM('button', { className: 'nav-spacer m-tap', onClick: () => ctx.toast('已下载', { tone: 'ok' }), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMM(Icons.download, { size: 19, stroke: 1.9 })) }),
    hMM('div', { className: 'm-body', style: { paddingBottom: 88 } },
      // 主预览
      hMM('div', { style: { padding: '4px 18px 0' } },
        hMM('div', { style: { position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)', background: 'var(--canvas-2)' } },
          hMM(Portrait, { char, variant: variants[sel], ratio: isVid ? '16 / 10' : '4 / 5', expr: exprs[sel] }),
          (isVid || is3d) && hMM('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' } },
            hMM('div', { style: { width: 60, height: 60, borderRadius: 99, background: 'rgba(255,255,255,.9)', display: 'grid', placeItems: 'center', color: 'var(--ink)', boxShadow: 'var(--sh-2)' } }, hMM(isVid ? Icons.play : Icons.cube, { size: 26 }))),
          hMM('div', { style: { position: 'absolute', top: 10, left: 10 } }, hMM(UI.Badge, { tone: 'mute', style: { background: 'rgba(255,255,255,.86)' } }, d.name + ' · ' + (sel + 1) + '/' + count)))),
      // 缩略图
      hMM('div', { className: 'm-hscroll', style: { padding: '14px 18px 4px' } },
        Array.from({ length: count }, (_, i) => hMM('button', { key: i, onClick: () => setSel(i), className: 'm-tap', style: {
          flex: '0 0 64px', padding: 0, border: '2px solid ' + (sel === i ? 'var(--primary)' : 'transparent'), borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer', boxShadow: sel === i ? 'var(--ring)' : 'var(--sh-1)' } },
          hMM(Portrait, { char, variant: variants[i % variants.length], ratio: '1 / 1', expr: exprs[i % exprs.length] })))),
      // 信息
      hMM('div', { style: { padding: '18px 18px 0' } },
        hMM('div', { className: 'm-card', style: { padding: 15 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 } },
            hMM('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 10, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, hMM(Icons[d.icon], { size: 19 })),
            hMM('div', null,
              hMM('div', { style: { fontSize: 14.5, fontWeight: 700 } }, d.name),
              hMM('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, d.desc))),
          [['来源资产', char.name + ' · ' + char.id], ['规格', isVid ? '1080×1920 · 15s' : is3d ? 'GLB · 含骨骼' : '2048×2560 · PNG'], ['数量', count + ' ' + d.unit], ['生成时间', char.updated]].map(([k, v]) =>
            hMM('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' } },
              hMM('span', { style: { fontSize: 12.5, color: 'var(--ink-3)' } }, k),
              hMM('span', { style: { fontSize: 12.5, fontWeight: 600, textAlign: 'right' } }, v)))))),

    hMM('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))',
      background: 'linear-gradient(transparent, var(--surface) 28%)', display: 'flex', gap: 9 } },
      hMM(UI.Button, { variant: 'line', icon: Icons.refresh, onClick: () => ctx.toast('重新生成…') }, '重生成'),
      hMM(UI.Button, { variant: 'primary', full: true, icon: Icons.grid, onClick: () => ctx.tab('apps') }, '投入应用')));
}

export { MSettings };
export { MMembership };
export { MStorage };
export { MVoiceClone };
export { MDerivView };
