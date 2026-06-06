"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, LicenseApi, JobApi, VoiceApi, AccountApi, useApi, seed } from "./api";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 · 授权 Licenses + 任务 Tasks + 我的 Me
// ============================================================
const hMS : any = React.createElement;
const { useState: useStateMS, useEffect: useEffectMS } = React;
const { WxNav: WxNavS } = MShell;
const { MSection: MSectionS } = MKit;

function RegTagM({ prefix, id }) {
  return hMS('span', { className: 'mono', style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, letterSpacing: '.04em', color: 'var(--ink-3)' } },
    hMS('span', { style: { fontSize: 8, fontWeight: 700, letterSpacing: '.12em', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 5px', borderRadius: 4 } }, prefix), id);
}

// ============ 授权 ============
function MLicenses({ ctx }) {
  const [f, setF] = useStateMS('all');
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const tone = { active: 'ok', expired: 'err', pending: 'warn' };
  const label = { active: '生效中', expired: '已过期', pending: '待签署' };
  const filters = [{ key: 'all', label: '全部' }, { key: 'active', label: '生效中' }, { key: 'pending', label: '待签署' }, { key: 'expired', label: '已过期' }];
  const list = licenses.filter(l => f === 'all' || l.status === f);

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '授权登记' },
    hMS(WxNavS, { title: '授权登记', onBack: ctx.back,
      right: hMS('button', { className: 'nav-spacer m-tap', onClick: () => ctx.toast('新增授权（示意）'), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'grid', placeItems: 'center' } }, hMS(Icons.plus, { size: 22, stroke: 2.2 })) }),
    hMS('div', { className: 'm-body', style: { padding: '4px 18px 28px' } },
      hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '真人肖像电子授权凭证档案，原始照片加密存档、与数字人资产绑定。'),
      hMS('div', { style: { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }, className: 'no-bar' },
        filters.map(k => {
          const on = f === k.key;
          return hMS('button', { key: k.key, onClick: () => setF(k.key), style: {
            flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--ink)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600 } }, k.label);
        })),
      hMS('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 13 } },
        list.map(l => hMS('div', { key: l.id, className: 'm-card', style: { overflow: 'hidden' } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 13px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' } },
            hMS(RegTagM, { prefix: 'LIC', id: l.id }),
            hMS(UI.Badge, { tone: tone[l.status], dot: true }, label[l.status])),
          hMS('div', { style: { position: 'relative', padding: '14px 15px 15px' } },
            l.status === 'active' && hMS('span', { className: 'seal', style: { position: 'absolute', top: 12, right: 13, fontSize: 9 } }, '已签署'),
            hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
              hMS('div', { style: { width: 36, height: 36, borderRadius: 10, flex: '0 0 36px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hMS(Icons.shield, { size: 19 })),
              hMS('div', { className: 'asset-name', style: { fontSize: 16.5 } }, l.subject)),
            hMS('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              [['授权范围', l.scope], ['授权期限', l.period], ['使用平台', l.platforms.join(' · ')], ['绑定素材', l.photos + ' 张（加密存档）']].concat(l.char ? [['关联资产', l.char]] : []).map(([k, v]) =>
                hMS('div', { key: k, style: { display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, alignItems: 'baseline' } },
                  hMS('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, k),
                  hMS('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 } }, v)))),
            hMS('div', { style: { display: 'flex', gap: 8, marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--line)' } },
              hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.download, onClick: () => ctx.toast('凭证下载中…') }, '下载凭证'),
              l.status === 'expired' && hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.refresh, onClick: () => ctx.toast('发起续签') }, '续签'),
              l.status === 'pending' && hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.pen, onClick: () => ctx.toast('去签署') }, '去签署')))))))); 
}

// ============ 任务 ============
function MTasks({ ctx }) {
  const [tasks, setTasks] = useStateMS(seed.jobs());
  useEffectMS(() => { JobApi.list().then(d => setTasks(d.map(t => ({ ...t })))).catch(() => {}); }, []);
  useEffectMS(() => {
    const iv = setInterval(() => setTasks(ts => ts.map(t => {
      if (t.status !== 'running') return t;
      const pct = Math.min(100, t.pct + Math.random() * 6);
      return { ...t, pct, status: pct >= 100 ? 'done' : 'running', eta: pct >= 100 ? '已完成' : t.eta };
    })), 1400);
    return () => clearInterval(iv);
  }, []);
  const running = tasks.filter(t => t.status === 'running').length;
  const modeTone = { mock: 'warn', backend: 'info', selfhost: 'primary' };
  const modeLabel = { mock: 'MOCK', backend: '后端网关', selfhost: '自部署' };

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '任务中心' },
    hMS(WxNavS, { title: '作业队列', onBack: ctx.back,
      right: hMS('button', { className: 'nav-spacer m-tap', onClick: () => ctx.toast('已刷新队列'), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMS(Icons.refresh, { size: 19, stroke: 1.9 })) }),
    hMS('div', { className: 'm-body', style: { padding: '4px 18px 28px' } },
      hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '所有 AI 生成均为异步作业，进度实时推送；可重试、取消。'),
      // 概要
      hMS('div', { style: { display: 'flex', gap: 10, marginBottom: 18 } },
        [['进行中', running, 'primary'], ['今日完成', 9, 'ok'], ['失败', 1, 'err']].map(([k, v, t]) =>
          hMS('div', { key: k, className: 'm-card', style: { flex: 1, padding: '12px 14px' } },
            hMS('div', { style: { fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 } }, k),
            hMS('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4 } },
              hMS('span', { className: 'mono', style: { fontSize: 22, fontWeight: 700, color: `var(--${t})` } }, v),
              hMS('span', { style: { fontSize: 11, color: 'var(--ink-4)' } }, '项'))))),
      hMS('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 11 } },
        tasks.map(t => hMS('div', { key: t.id, className: 'm-card', style: { padding: '13px 14px' } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
            hMS('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 10, background: t.status === 'failed' ? 'var(--err-s)' : t.status === 'done' ? 'var(--ok-s)' : 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: t.status === 'failed' ? 'var(--err)' : t.status === 'done' ? 'var(--ok)' : 'var(--primary)' } },
              t.status === 'running' ? hMS(UI.Spinner, { size: 17 }) : hMS(t.status === 'failed' ? Icons.warn : Icons.checkc, { size: 19 })),
            hMS('div', { style: { flex: 1, minWidth: 0 } },
              hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
                hMS('span', { style: { fontSize: 13.5, fontWeight: 700 } }, t.kind),
                hMS('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, t.charName)),
              hMS('div', { style: { marginTop: 3 } }, hMS(UI.Badge, { tone: modeTone[t.mode] }, modeLabel[t.mode] + ' · ' + t.engine)))),
          hMS('div', { style: { marginTop: 11 } },
            t.status === 'running'
              ? hMS(UI.Progress, { pct: Math.round(t.pct), showLabel: true })
              : hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
                  hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
                    hMS(RegTagM, { prefix: 'JOB', id: t.id }),
                    hMS('span', { style: { fontSize: 11, color: t.status === 'failed' ? 'var(--err)' : 'var(--ink-3)' } }, '· ' + t.eta)),
                  t.status === 'failed'
                    ? hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.retry, onClick: () => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: 'running', pct: 5, eta: '重试中' } : x)) }, '重试')
                    : hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.eye, onClick: () => ctx.toast('查看结果') }, '查看'))))))));
}

// ============ 我的 Me ============
function MeRow({ icon, label, sub, badge, color, onClick, last }) {
  return hMS('button', { onClick, className: 'm-tap', style: {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 15px', textAlign: 'left', cursor: 'pointer',
    background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--line)' } },
    hMS('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, background: 'color-mix(in oklab, ' + (color || 'var(--primary)') + ' 12%, transparent)', display: 'grid', placeItems: 'center', color: color || 'var(--primary)' } }, hMS(icon, { size: 18, stroke: 1.9 })),
    hMS('div', { style: { flex: 1, minWidth: 0 } },
      hMS('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' } }, label),
      sub && hMS('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, sub)),
    badge != null && hMS(UI.Badge, { tone: 'primary' }, badge),
    hMS(Icons.chevR, { size: 17, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }));
}

function MMe({ ctx }) {
  const avatars = useApi(() => AvatarApi.list('mine'), seed.avatars());
  const myVoices = useApi(() => VoiceApi.mine(), seed.myVoices());
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const jobs = useApi(() => JobApi.list(), seed.jobs());
  const acct: any = useApi(() => AccountApi.get(), seed.account()) || {};
  const favCount = avatars.filter(c => c.fav).length;
  return hMS('div', { className: 'm-body has-tabbar', 'data-screen-label': '我的' },
    hMS(WxNavS, { title: '我的',
      right: hMS('button', { className: 'nav-spacer m-tap', onClick: () => ctx.go('settings'), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMS(Icons.settings, { size: 20, stroke: 1.8 })) }),

    // 账户头
    hMS('div', { style: { padding: '6px 18px 0' } },
      hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        hMS('div', { style: { width: 60, height: 60, flex: '0 0 60px', borderRadius: 20, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 24, boxShadow: '0 8px 18px rgba(18,179,222,.26)' } }, '柯'),
        hMS('div', { style: { minWidth: 0 } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            hMS('span', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 20 } }, '柯岚工作室'),
            hMS(UI.Badge, { tone: 'primary' }, acct.planLabel || 'PRO')),
          hMS('div', { className: 'mono', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 } }, 'UID · 88621049')))),

    // 算力卡
    hMS('div', { style: { padding: '18px 18px 0' } },
      hMS('div', { style: { position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-xl)', padding: '16px 18px', background: 'linear-gradient(155deg,#1C2B3A,#14202B)', color: '#fff', boxShadow: 'var(--sh-2)' } },
        hMS('div', { style: { position: 'absolute', right: -10, bottom: -16, opacity: .12 } }, hMS(Icons.gem, { size: 96 })),
        hMS('div', { style: { position: 'relative' } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            hMS('span', { style: { fontSize: 12.5, fontWeight: 600, opacity: .92 } }, '可用算力'),
            hMS('button', { onClick: () => ctx.go('membership'), className: 'm-tap', style: { background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer' } }, '充值')),
          hMS('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 } },
            hMS('span', { className: 'mono', style: { fontSize: 30, fontWeight: 800 } }, (acct.credits || 0).toLocaleString()),
            hMS('span', { style: { fontSize: 12.5, opacity: .9 } }, '点')),
          hMS('div', { style: { fontSize: 11.5, opacity: .88, marginTop: 4 } }, '本月已用 ' + (acct.creditsUsed || 0) + ' 点 · 约可生成 ' + (acct.generatableEstimate || 0) + ' 个数字人')))),

    // 数据概览
    hMS('div', { style: { padding: '16px 18px 0', display: 'flex', gap: 10 } },
      [['数字人', avatars.length, () => ctx.tab('library')], ['声音', myVoices.length, () => ctx.go('voice')], ['授权', licenses.length, () => ctx.go('licenses')]].map(([k, v, fn]: any) =>
        hMS('button', { key: k, onClick: fn, className: 'm-card m-tap', style: { flex: 1, padding: '13px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--line)' } },
          hMS('div', { className: 'mono', style: { fontSize: 20, fontWeight: 700, color: 'var(--ink)' } }, v),
          hMS('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, k)))),

    // 功能入口
    hMS('div', { style: { padding: '20px 18px 0' } },
      hMS('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, '工作台'),
      hMS('div', { className: 'm-card', style: { padding: '0 0 0 0' } },
        hMS(MeRow, { icon: Icons.mic, label: '声音工作室', sub: myVoices.length + ' 个声线资产', color: 'var(--ink-2)', onClick: () => ctx.go('voice') }),
        hMS(MeRow, { icon: Icons.shield, label: '授权登记', sub: '真人肖像电子授权', color: 'var(--ink-2)', onClick: () => ctx.go('licenses') }),
        hMS(MeRow, { icon: Icons.bolt, label: '作业队列', sub: '异步生成任务', color: 'var(--primary)', badge: jobs.filter(t => t.status === 'running').length, onClick: () => ctx.go('tasks') }),
        hMS(MeRow, { icon: Icons.heart, label: '我的收藏', sub: favCount + ' 个数字人', color: 'var(--ink-2)', onClick: () => ctx.tab('library'), last: true }))),

    hMS('div', { style: { padding: '18px 18px 0' } },
      hMS('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, '账户'),
      hMS('div', { className: 'm-card' },
        hMS(MeRow, { icon: Icons.gem, label: '会员与算力', sub: 'PRO · 1,240 点', color: 'var(--ink-2)', onClick: () => ctx.go('membership') }),
        hMS(MeRow, { icon: Icons.folder, label: '存储用量', sub: '68 / 200 GB', color: 'var(--ink-2)', onClick: () => ctx.go('storage') }),
        hMS(MeRow, { icon: Icons.settings, label: '设置', color: 'var(--ink-2)', onClick: () => ctx.go('settings'), last: true }))),

    hMS('div', { style: { padding: '22px 18px 10px', textAlign: 'center' } },
      hMS('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)' } }, '数字人资产平台 · v4.0 移动端')));
}

export { MLicenses };
export { MTasks };
export { MMe };
