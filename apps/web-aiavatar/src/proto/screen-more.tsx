"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, LicenseApi, AccountApi, AvatarApi, VoiceApi, AuthApi, awaitJob, useApi, seed, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 V4 · 其余子页面
//   设置 / 会员与算力 / 存储用量 / 声音克隆录制（真实麦克风） / 衍生物查看器（真实资产）
// ============================================================
const hMM : any = React.createElement;
const { useState: useStateMM, useEffect: useEffectMM, useRef: useRefMM } = React;
const { WxNav: WxNavMM } = MShell;

function GroupTitle({ children }) {
  return hMM('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, children);
}
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
  const [confirmOut, setConfirmOut] = useStateMM(false);
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const acct: any = useApi(() => AccountApi.get(), seed.account()) || {};

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
        hMM(Row, { icon: Icons.archive, label: '定稿后自动归档', sub: '完成创建即存入名录', toggle: true, on: autoArchive, onClick: () => setAutoArchive(v => !v), last: true })),

      hMM(GroupTitle, null, '隐私与合规'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.shield, label: '肖像授权管理', sub: '已签署 ' + licenses.filter(l => l.status === 'active').length + ' 份', onClick: () => ctx.go('licenses') }),
        hMM(Row, { icon: Icons.lock, label: '隐私与数据', sub: '素材加密存档 · 删除请联系平台', onClick: () => toast('如需删除账户数据，请联系平台客服处理', { tone: 'ok' }), last: true })),

      hMM(GroupTitle, null, '账户'),
      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.lock, label: '账号与安全', sub: '设置 / 修改登录密码', onClick: () => ctx.go('security') }),
        hMM(Row, { icon: Icons.folder, label: '存储用量', sub: (acct.storageUsedGB ?? 0) + ' / ' + (acct.storageQuotaGB ?? 0) + ' GB', onClick: () => ctx.go('storage') }),
        hMM(Row, { icon: Icons.gem, label: '会员与算力', sub: (acct.planLabel || 'PRO') + ' · ' + (acct.credits || 0).toLocaleString() + ' 点', onClick: () => ctx.go('membership'), last: true })),

      hMM('div', { className: 'm-card', style: { marginBottom: 18 } },
        hMM(Row, { icon: Icons.info, label: '关于', value: 'v4.1', onClick: () => toast('数字人资产平台 v4.1', { tone: 'ok' }) }),
        hMM(Row, { label: '退出登录', danger: true, icon: Icons.plug, onClick: () => setConfirmOut(true), last: true }))),

    confirmOut && hMM('div', { style: { position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(11,22,32,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 34px', animation: 'mSheetFade .18s ease both' } },
      hMM('div', { className: 'm-fade', style: { width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '24px 20px 18px', boxShadow: 'var(--sh-3)', textAlign: 'center' } },
        hMM('div', { style: { fontSize: 17, fontWeight: 800, marginBottom: 8 } }, '退出登录？'),
        hMM('p', { style: { fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', lineHeight: 1.5 } }, '退出后需要重新登录才能访问你的数字人资产。'),
        hMM('div', { style: { display: 'flex', gap: 10 } },
          hMM(UI.Button, { variant: 'line', full: true, onClick: () => setConfirmOut(false) }, '取消'),
          hMM(UI.Button, { variant: 'dark', full: true, onClick: () => { setConfirmOut(false); ctx.logout ? ctx.logout() : toast('已退出登录', { tone: 'ok' }); } }, '退出')))));
}

// ============================================================
// 会员与算力
// ============================================================
const PLANS = [
  { key: 'free', name: '体验版', price: '¥0', credits: '50 点/月', feats: ['基础形象生成', '标准图集', '带水印导出'], cur: false },
  { key: 'pro', name: 'PRO', price: '¥99', unit: '/月', credits: '1,500 点/月', feats: ['高清无水印', '全部衍生类型', '真人复刻', '优先队列'], cur: true, hot: true },
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
  const acct: any = useApi(() => AccountApi.get(), seed.account()) || {};
  return hMM('div', { className: 'm-overlay', 'data-screen-label': '会员与算力' },
    hMM(WxNavMM, { title: '会员与算力', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '4px 18px 30px' } },
      hMM('div', { style: { position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-xl)', padding: '18px 20px', background: 'linear-gradient(155deg,#1C2B3A,#14202B)', color: '#fff', boxShadow: 'var(--sh-2)', marginBottom: 22 } },
        hMM('div', { style: { position: 'absolute', right: -14, bottom: -18, opacity: .1 } }, hMM(Icons.gem, { size: 110 })),
        hMM('div', { style: { position: 'relative' } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
            hMM('span', { style: { fontSize: 12.5, fontWeight: 600, opacity: .85 } }, '当前可用算力'),
            hMM('span', { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 'var(--r-pill)' } }, acct.planLabel || 'PRO')),
          hMM('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6 } },
            hMM('span', { className: 'mono', style: { fontSize: 34, fontWeight: 800, letterSpacing: '-.02em' } }, (acct.credits || 0).toLocaleString()),
            hMM('span', { style: { fontSize: 13, opacity: .85 } }, '点')),
          hMM('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 } },
            hMM('span', { style: { fontSize: 11.5, opacity: .8 } }, '本月赠送 ' + (acct.monthlyGrant || 0).toLocaleString() + ' · 已用 ' + (acct.creditsUsed || 0) + ' · ' + (acct.refreshDate || '') + '刷新'),
            hMM('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 } }, '约可生成 ' + (acct.generatableEstimate || 0) + ' 个', hMM(Icons.user, { size: 13 }))))),

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
      hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.gem, onClick: () => toast('在线支付通道接入中 · 当前请联系平台充值', { tone: 'ok' }), style: { marginBottom: 8 } }, '立即充值 · ' + PACKS[pack].price),
      hMM('p', { style: { fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: '0 0 24px' } }, '每月 1 日自动发放 ' + ((acct.monthlyGrant || 1500).toLocaleString()) + ' 点赠送算力'),

      hMM(GroupTitle, null, '订阅套餐'),
      hMM('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        PLANS.map(p => hMM('div', { key: p.key, style: {
          position: 'relative', overflow: 'hidden', padding: '16px 17px', borderRadius: 'var(--r-lg)',
          background: 'var(--surface)', border: '1.5px solid ' + (p.cur ? 'var(--primary)' : 'var(--line-2)'), boxShadow: p.cur ? 'var(--sh-2)' : 'var(--sh-1)' } },
          hMM('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 } },
            hMM('div', null,
              hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                hMM('span', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 18 } }, p.name),
                p.cur && hMM(UI.Badge, { tone: 'primary' }, '当前')),
              hMM('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 3 } }, p.credits)),
            hMM('div', { style: { textAlign: 'right' } },
              hMM('span', { className: 'mono', style: { fontSize: 22, fontWeight: 800, color: 'var(--ink)' } }, p.price),
              p.unit && hMM('span', { style: { fontSize: 12, color: 'var(--ink-3)' } }, p.unit))),
          hMM('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginBottom: p.cur ? 0 : 13 } },
            p.feats.map(f => hMM('span', { key: f, style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-2)' } },
              hMM(Icons.check, { size: 13, stroke: 2.4, style: { color: 'var(--primary)' } }), f))),
          !p.cur && hMM(UI.Button, { variant: p.key === 'studio' ? 'dark' : 'soft', full: true, onClick: () => toast('套餐变更请联系平台开通', { tone: 'ok' }) }, p.key === 'free' ? '降级到体验版' : '升级到 ' + p.name))))));
}

// ============================================================
// 存储用量
// ============================================================
function MStorage({ ctx }) {
  const acct: any = useApi(() => AccountApi.get(), seed.account()) || {};
  const STORAGE: any[] = acct.storageBreakdown || [];
  const used = acct.storageUsedGB ?? STORAGE.reduce((a, s) => a + s.size, 0);
  const total = acct.storageQuotaGB || 0;
  return hMM('div', { className: 'm-overlay', 'data-screen-label': '存储用量' },
    hMM(WxNavMM, { title: '存储用量', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '4px 18px 30px' } },
      hMM('div', { className: 'm-card', style: { padding: '20px 18px', marginBottom: 20, textAlign: 'center' } },
        hMM('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4 } },
          hMM('span', { className: 'mono', style: { fontSize: 34, fontWeight: 800, color: 'var(--ink)' } }, Number(used).toFixed(1)),
          hMM('span', { style: { fontSize: 14, color: 'var(--ink-3)' } }, '/ ' + total + ' GB')),
        hMM('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 } }, (acct.planLabel || 'PRO') + ' 会员 · 共 ' + total + ' GB 空间'),
        hMM('div', { style: { display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-3)', marginBottom: 14 } },
          STORAGE.map(s => hMM('div', { key: s.name, style: { width: Math.max(0.5, (s.size / Math.max(1, total)) * 100) + '%', background: s.color } }))),
        hMM(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.gem, onClick: () => ctx.go('membership') }, '扩容空间')),

      hMM(GroupTitle, null, '分类占用'),
      hMM('div', { className: 'm-card' },
        STORAGE.map((s, i) => hMM('div', { key: s.name, style: { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderBottom: i < STORAGE.length - 1 ? '1px solid var(--line)' : 'none' } },
          hMM('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,' + s.color + ' 13%, transparent)', color: s.color } }, hMM(Icons[s.icon] || Icons.folder, { size: 18, stroke: 1.9 })),
          hMM('div', { style: { flex: 1, minWidth: 0 } },
            hMM('div', { style: { fontSize: 14, fontWeight: 600 } }, s.name),
            hMM('div', { style: { marginTop: 6 } }, hMM('div', { style: { height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' } },
              hMM('div', { style: { width: (used > 0 ? (s.size / used * 100) : 0) + '%', height: '100%', background: s.color, borderRadius: 99 } })))),
          hMM('span', { className: 'mono', style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flex: '0 0 auto' } }, s.size + ' GB'))))));
}

// ============================================================
// 声音克隆 · 录制流程（真实麦克风 + 上传，绑定可选 avatarId）
// ============================================================
const VOICE_SCRIPT = '你好，这是我的声音样本。我正在用平台克隆我自己的声线，用清晰自然的语气朗读这段文字，方便系统更准确地学习我的音色与节奏。';
const VOICE_SECONDS = 10;
function MVoiceClone({ ctx, avatarId }) {
  const [stage, setStage] = useStateMM('intro'); // intro | rec | saving | done
  const [count, setCount] = useStateMM(3);
  const [progress, setProgress] = useStateMM(0);
  const [voice, setVoice] = useStateMM(null as any);
  const [audioUrl, setAudioUrl] = useStateMM('');
  const [playing, setPlaying] = useStateMM(false);
  const fileRef = useRefMM(null as any);
  const streamRef = useRefMM(null as any);
  const recRef = useRefMM(null as any);
  const chunksRef = useRefMM([] as any[]);
  const audioRef = useRefMM(null as any);
  useEffectMM(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, []);

  const uploadClone = async (blob: Blob | File) => {
    setStage('saving');
    try {
      const fd = new FormData();
      fd.append('file', blob, (blob as any).name || 'voice-sample.webm');
      if (avatarId) fd.append('avatarId', avatarId);
      const v = await VoiceApi.clone(fd);
      setVoice(v);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      // 绑定到数字人（可选）
      if (avatarId && v?.name) { VoiceApi.bind(avatarId, v.name).catch(() => {}); }
      setStage('done');
      toast('声线已保存 · ' + (v?.name || ''), { tone: 'ok' });
      ctx.reload && ctx.reload();
    } catch (e: any) {
      toast(e?.message || '保存失败，请重试', { tone: 'err' });
      setStage('intro');
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStage('rec'); setCount(3); setProgress(0);
    } catch {
      toast('无法访问麦克风，请改用「上传音频」', { tone: 'warn' });
    }
  };

  useEffectMM(() => {
    if (stage !== 'rec') return;
    if (count > 0) { const t = setTimeout(() => setCount(c => c - 1), 800); return () => clearTimeout(t); }
    // 开录
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => (window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = (chunksRef.current[0] && chunksRef.current[0].type) || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        uploadClone(blob);
      };
      rec.start(250);
      recRef.current = rec;
    } catch {
      toast('录音初始化失败，请改用「上传音频」', { tone: 'err' });
      setStage('intro');
      return;
    }
    const iv = setInterval(() => setProgress(p => {
      const n = Math.min(100, p + 100 / (VOICE_SECONDS * 10));
      if (n >= 100) { clearInterval(iv); setTimeout(() => { try { recRef.current && recRef.current.state !== 'inactive' && recRef.current.stop(); } catch {} }, 200); }
      return n;
    }), 100);
    return () => clearInterval(iv);
  }, [stage, count]);

  const read = Math.floor((progress / 100) * VOICE_SCRIPT.length);
  const recording = stage === 'rec' && count === 0;
  const bars = Array.from({ length: 38 }, (_, i) => 6 + Math.abs(Math.sin(i * 0.9)) * 22);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '声音克隆' },
    hMM(WxNavMM, { title: '克隆我的声音', onBack: ctx.back }),
    hMM('input', { ref: fileRef, type: 'file', accept: 'audio/*', style: { display: 'none' },
      onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) uploadClone(f); } }),

    stage === 'intro' && hMM('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMM('div', { className: 'm-body', style: { padding: '6px 20px 0' } },
        hMM('div', { className: 'm-fade' },
          hMM('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 14 } },
            hMM(Icons.bolt, { size: 13, stroke: 2 }), '约 ' + VOICE_SECONDS + ' 秒采样'),
          hMM('h1', { style: { fontSize: 24, lineHeight: 1.18, letterSpacing: '-.02em', fontWeight: 800, margin: '0 0 8px' } }, '朗读一段文字，', hMM('br', null), '克隆你的专属声线'),
          hMM('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 22px' } }, '在安静环境正对手机朗读屏幕脚本，原始采样加密存档；生成的声线可绑定到任意数字人。')),
        hMM('div', { style: { display: 'grid', placeItems: 'center', padding: '20px 0 24px' } },
          hMM('div', { style: { position: 'relative', width: 120, height: 120, display: 'grid', placeItems: 'center' } },
            hMM('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, background: 'var(--primary-soft)', opacity: .5 } }),
            hMM('div', { style: { position: 'absolute', inset: 16, borderRadius: 99, background: 'var(--primary-soft)' } }),
            hMM('div', { style: { position: 'relative', width: 72, height: 72, borderRadius: 99, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 10px 24px rgba(18,179,222,.35)' } }, hMM(Icons.mic, { size: 32, stroke: 1.9 })))),
        hMM('div', { style: { display: 'flex', gap: 10 } },
          [['安静环境', '避免背景噪音', Icons.bell], ['正常语速', '自然不做作', Icons.wave], ['完整朗读', '约 3 句话', Icons.type]].map(([t, d, ic]) =>
            hMM('div', { key: t, style: { flex: 1, textAlign: 'center', padding: '13px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
              hMM('div', { style: { width: 32, height: 32, borderRadius: 9, margin: '0 auto 7px', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--primary)' } }, hMM(ic, { size: 16, stroke: 1.9 })),
              hMM('div', { style: { fontSize: 12, fontWeight: 700 } }, t),
              hMM('div', { style: { fontSize: 10, color: 'var(--ink-3)', marginTop: 2 } }, d))))),
      hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
        hMM(UI.Button, { variant: 'line', icon: Icons.upload, onClick: () => fileRef.current && fileRef.current.click() }, '上传音频'),
        hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.mic, onClick: startRec }, '开始录音'))),

    stage === 'rec' && hMM('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMM('div', { className: 'm-body', style: { padding: '6px 20px 0' } },
        hMM('div', { style: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: '18px 18px', boxShadow: 'var(--sh-1)', marginBottom: 22 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 } },
            hMM(Icons.type, { size: 14, style: { color: 'var(--ink-3)' } }),
            hMM('span', { style: { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)' } }, '跟读脚本')),
          hMM('p', { style: { fontSize: 17, lineHeight: 1.75, fontWeight: 600, margin: 0 } },
            hMM('span', { style: { color: 'var(--primary)' } }, VOICE_SCRIPT.slice(0, read)),
            hMM('span', { style: { color: 'var(--ink-4)' } }, VOICE_SCRIPT.slice(read)))),
        hMM('div', { style: { display: 'grid', placeItems: 'center', padding: '10px 0' } },
          recording
            ? hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 3, height: 60 } },
                bars.map((b, i) => hMM('span', { key: i, style: { width: 3.5, flex: '0 0 3.5px', height: b + 'px', borderRadius: 9, background: 'var(--primary)', opacity: i / 38 < progress / 100 ? 1 : .25, animation: `pulse ${0.6 + (i % 5) * 0.1}s ease-in-out infinite` } })))
            : hMM('div', { style: { width: 96, height: 96, borderRadius: 99, background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-disp)', fontSize: 40, fontWeight: 800 } }, count === 0 ? '·' : count)),
        recording && hMM('div', { style: { marginTop: 22 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, color: 'var(--err)', fontSize: 13.5, fontWeight: 700 } },
            hMM('span', { style: { width: 9, height: 9, borderRadius: 99, background: 'var(--err)', animation: 'pulse 1s infinite' } }), '录音中 · ', hMM('span', { className: 'mono' }, '00:' + String(Math.floor(progress / 100 * VOICE_SECONDS)).padStart(2, '0'))),
          hMM(UI.Progress, { pct: Math.round(progress), tone: 'primary' }))),
      !recording && hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' } }, '即将开始，请准备…')),

    stage === 'saving' && hMM('div', { style: { flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
      hMM('div', { className: 'm-fade' },
        hMM('div', { style: { width: 70, height: 70, margin: '0 auto 18px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hMM('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, border: '3px solid var(--primary-soft)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' } }),
          hMM(Icons.mic, { size: 26, style: { color: 'var(--primary)' } })),
        hMM('h2', { style: { fontSize: 19, fontWeight: 800, marginBottom: 6 } }, '正在保存声线…'),
        hMM('p', { style: { fontSize: 12.5, color: 'var(--ink-2)' } }, '采样加密上传中，请稍候'))),

    stage === 'done' && hMM('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      audioUrl && hMM('audio', { ref: audioRef, src: audioUrl, onEnded: () => setPlaying(false), style: { display: 'none' } }),
      hMM('div', { className: 'm-body', style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
        hMM('div', { className: 'm-fade' },
          hMM('div', { style: { width: 84, height: 84, borderRadius: 99, background: 'var(--ok-s)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', boxShadow: '0 10px 30px rgba(26,160,110,.26)' } }, hMM(Icons.checkc, { size: 44 })),
          hMM('h2', { style: { fontSize: 22, marginBottom: 8 } }, '声线已保存'),
          hMM('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22 } },
            '已保存「' + ((voice && voice.name) || '我的声音') + '」' + (avatarId ? '，并绑定到当前数字人。' : '，可在声音工作室绑定到数字人。'),
            hMM('br', null), '配音 TTS 合成能力上线后即可直接使用；当前试听为原始采样。'),
          hMM('div', { style: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 26 } },
            [['时长', (voice && voice.dur) || '00:' + String(VOICE_SECONDS).padStart(2, '0')], ['类型', '克隆声线'], ['存档', '已加密']].map(([k, v]) =>
              hMM('div', { key: k, style: { padding: '11px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
                hMM('div', { className: 'mono', style: { fontSize: 15, fontWeight: 700 } }, v),
                hMM('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, k))))),
        hMM('div', { style: { flex: '0 0 auto' } })),
      hMM('div', { style: { flex: '0 0 auto', padding: '12px 20px calc(12px + var(--home-ind))', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
        audioUrl && hMM(UI.Button, { variant: 'line', icon: playing ? Icons.bolt : Icons.play, onClick: togglePlay }, playing ? '暂停' : '试听'),
        hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.checkc, onClick: ctx.back }, '完成'))));
}

// ============================================================
// 衍生物查看器（真实资产：图片网格 / 视频播放 / 下载）
// ============================================================
function MDerivView({ char, deriv, ctx }) {
  const d = DATA.DERIVS.find(x => x.key === deriv) || DATA.DERIVS[0];
  const [items, setItems] = useStateMM([] as any[]);
  const [sel, setSel] = useStateMM(0);
  const [regenBusy, setRegenBusy] = useStateMM(null as any);
  const isVid = d.key === 'video';
  const is3d = d.key === 'd3';
  const load = () => AvatarApi.derivatives(char.id).then((all: any[]) => setItems(all.filter((x) => x.key === d.key))).catch(() => {});
  useEffectMM(() => { load(); }, []);

  const cur = items[sel] || items[0];
  const count = items.length || (char.counts && char.counts[d.key]) || 0;

  const regen = async () => {
    if (regenBusy) return;
    setRegenBusy({ pct: 3 });
    try {
      const j = await AvatarApi.createDerivative(char.id, { type: d.key });
      await awaitJob(j.id, (jj) => setRegenBusy({ pct: jj.pct }));
      toast(d.name + ' · 已重新生成', { tone: 'ok' });
      setSel(0);
      await load();
      ctx.reload && ctx.reload();
    } catch (e: any) {
      toast(e?.message || '生成失败', { tone: 'err' });
    } finally { setRegenBusy(null); }
  };

  const download = () => {
    if (cur && cur.fileUrl) { window.open(cur.fileUrl, '_blank'); toast('已在新窗口打开，可长按/右键保存', { tone: 'ok' }); }
    else toast('当前没有可下载的产物', { tone: 'warn' });
  };

  // 占位 variant（无真实产物时沿用旧示意）
  const variants = ['key', 'threeq', 'side', 'look', 'key', 'threeq', 'side', 'look'];
  const exprs = ['calm', 'smile', 'calm', 'serious', 'smile', 'calm', 'serious', 'calm'];

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '衍生查看' },
    hMM(WxNavMM, { title: char.name + ' · ' + d.name, onBack: ctx.back,
      right: hMM('button', { className: 'nav-spacer m-tap', onClick: download, style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMM(Icons.download, { size: 19, stroke: 1.9 })) }),
    hMM('div', { className: 'm-body', style: { paddingBottom: 88 } },
      hMM('div', { style: { padding: '4px 18px 0' } },
        hMM('div', { style: { position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)', background: '#0E171F' } },
          cur && isVid && cur.fileUrl
            ? hMM('video', { key: cur.id, src: cur.fileUrl, controls: true, playsInline: true, poster: cur.thumbUrl || undefined, style: { display: 'block', width: '100%', aspectRatio: '9 / 14', objectFit: 'contain', background: '#0E171F' } })
            : hMM(Portrait, { char: { ...char, shotImages: null }, src: cur ? cur.fileUrl : null, variant: variants[sel % variants.length], ratio: isVid ? '16 / 10' : '4 / 5', expr: exprs[sel % exprs.length] }),
          hMM('div', { style: { position: 'absolute', top: 10, left: 10 } }, hMM(UI.Badge, { tone: 'mute', style: { background: 'rgba(255,255,255,.86)' } }, d.name + (count ? ' · ' + (Math.min(sel + 1, count)) + '/' + count : ''))),
          is3d && hMM('div', { style: { position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', justifyContent: 'center' } },
            hMM('span', { style: { fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(20,30,40,.6)', color: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)' } }, '多角度 3D 预览 · GLB 导出排期中')))),
      regenBusy && hMM('div', { style: { margin: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
        hMM(UI.Spinner, { size: 15 }),
        hMM('div', { style: { flex: 1 } }, hMM(UI.Progress, { pct: Math.round(regenBusy.pct || 4), h: 5 }))),
      count > 0 && hMM('div', { className: 'm-hscroll', style: { padding: '14px 18px 4px' } },
        (items.length ? items : Array.from({ length: count })).map((it: any, i) => hMM('button', { key: (it && it.id) || i, onClick: () => setSel(i), className: 'm-tap', style: {
          flex: '0 0 64px', padding: 0, border: '2px solid ' + (sel === i ? 'var(--primary)' : 'transparent'), borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer', boxShadow: sel === i ? 'var(--ring)' : 'var(--sh-1)' } },
          hMM(Portrait, { char: { ...char, shotImages: null }, src: it ? (it.thumbUrl || (it.kind === 'video' ? null : it.fileUrl)) : null, variant: variants[i % variants.length], ratio: '1 / 1', expr: exprs[i % exprs.length] })))),
      count === 0 && hMM('div', { style: { margin: '16px 18px 0', textAlign: 'center', padding: '28px 16px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
        hMM('div', { style: { fontSize: 13.5, fontWeight: 700, marginBottom: 5 } }, '还没有' + d.name),
        hMM('p', { style: { fontSize: 12, color: 'var(--ink-3)', margin: '0 0 14px' } }, d.desc),
        !regenBusy && hMM(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.sparkle, onClick: regen }, '立即生成')),
      hMM('div', { style: { padding: '18px 18px 0' } },
        hMM('div', { className: 'm-card', style: { padding: 15 } },
          hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 } },
            hMM('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 10, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, hMM(Icons[d.icon], { size: 19 })),
            hMM('div', null,
              hMM('div', { style: { fontSize: 14.5, fontWeight: 700 } }, d.name),
              hMM('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, d.desc))),
          [['来源资产', char.name + ' · ' + char.id],
           ['规格', cur ? (cur.spec || '—') : '—'],
           ['当前项', cur ? (cur.label || '—') : '—'],
           ['数量', count + ' ' + d.unit]].map(([k, v]) =>
            hMM('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' } },
              hMM('span', { style: { fontSize: 12.5, color: 'var(--ink-3)' } }, k),
              hMM('span', { style: { fontSize: 12.5, fontWeight: 600, textAlign: 'right' } }, v)))))),

    hMM('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))',
      background: 'linear-gradient(transparent, var(--surface) 28%)', display: 'flex', gap: 9 } },
      hMM(UI.Button, { variant: 'line', icon: Icons.refresh, disabled: !!regenBusy, onClick: regen }, regenBusy ? '生成中…' : '重生成'),
      hMM(UI.Button, { variant: 'primary', full: true, icon: Icons.download, onClick: download }, '下载当前项')));
}

// ============================================================
// 账号与安全 · 设置 / 修改登录密码（手机号 + 密码登录的开通入口）
// ============================================================
function MSecurity({ ctx }) {
  const [hasPwd, setHasPwd] = useStateMM(false);
  const [loaded, setLoaded] = useStateMM(false);
  const [cur, setCur] = useStateMM('');
  const [next, setNext] = useStateMM('');
  const [confirm, setConfirm] = useStateMM('');
  const [busy, setBusy] = useStateMM(false);

  useEffectMM(() => {
    let live = true;
    if (USE_MOCK) { setHasPwd(false); setLoaded(true); return; }
    AuthApi.me().then((m: any) => { if (live) { setHasPwd(!!m?.hasPassword); setLoaded(true); } })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);

  const save = async () => {
    if (hasPwd && !cur.trim()) { toast('请输入当前密码', { tone: 'warn' }); return; }
    if (next.length < 6) { toast('新密码至少 6 位', { tone: 'warn' }); return; }
    if (next !== confirm) { toast('两次输入的新密码不一致', { tone: 'warn' }); return; }
    setBusy(true);
    try {
      if (USE_MOCK) { await new Promise((r) => setTimeout(r, 400)); }
      else { await AuthApi.setPassword({ currentPassword: hasPwd ? cur : undefined, newPassword: next }); }
      setHasPwd(true); setCur(''); setNext(''); setConfirm('');
      toast(hasPwd ? '密码已更新' : '密码已设置 · 下次可用手机号 + 密码登录', { tone: 'ok' });
    } catch (e: any) {
      toast(e?.message || '保存失败，请重试', { tone: 'err' });
    } finally { setBusy(false); }
  };

  return hMM('div', { className: 'm-overlay', 'data-screen-label': '账号与安全' },
    hMM(WxNavMM, { title: '账号与安全', onBack: ctx.back }),
    hMM('div', { className: 'm-body', style: { padding: '6px 18px 30px' } },
      hMM('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', marginBottom: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
        hMM('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' } }, hMM(Icons.lock, { size: 18, stroke: 1.9 })),
        hMM('div', { style: { flex: 1, minWidth: 0 } },
          hMM('div', { style: { fontSize: 14.5, fontWeight: 700 } }, '密码登录'),
          hMM('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, loaded ? (hasPwd ? '已启用 · 可用手机号 + 密码登录' : '未设置 · 设置后可用密码快速登录') : '加载中…'))),

      hMM(GroupTitle, null, hasPwd ? '修改登录密码' : '设置登录密码'),
      hMM('div', { className: 'm-card', style: { padding: '15px 15px 17px' } },
        hasPwd && hMM('div', { style: { marginBottom: 12 } },
          hMM('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } }, '当前密码'),
          hMM(UI.Input, { value: cur, onChange: setCur, placeholder: '当前登录密码', type: 'password' })),
        hMM('div', { style: { marginBottom: 12 } },
          hMM('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } }, '新密码'),
          hMM(UI.Input, { value: next, onChange: setNext, placeholder: '至少 6 位', type: 'password' })),
        hMM('div', { style: { marginBottom: 16 } },
          hMM('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 } }, '确认新密码'),
          hMM(UI.Input, { value: confirm, onChange: setConfirm, placeholder: '再次输入新密码', type: 'password' })),
        hMM(UI.Button, { variant: 'primary', full: true, size: 'lg', disabled: busy, onClick: save }, busy ? '保存中…' : hasPwd ? '更新密码' : '设置密码')),

      hMM('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '16px 2px 0', color: 'var(--ink-3)' } },
        hMM(Icons.shield, { size: 14, style: { flex: '0 0 auto', marginTop: 1 } }),
        hMM('span', { style: { fontSize: 11.5, lineHeight: 1.6 } }, '验证码登录始终可用；密码仅用于日常快速登录。改密只影响本平台账号。'))));
}

export { MSettings };
export { MSecurity };
export { MMembership };
export { MStorage };
export { MVoiceClone };
export { MDerivView };
