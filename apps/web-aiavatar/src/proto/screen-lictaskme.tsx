"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, LicenseApi, JobApi, VoiceApi, AccountApi, useApi, seed, USE_MOCK, auth } from "./api";
import { MShell, MKit } from "./shell";
import { Portrait } from "./portrait";
import { toast } from "./toast";

// ============================================================
// 移动端 · 授权 Licenses + 任务 Tasks + 我的 Me（真数据 / 真操作）
// ============================================================
const hMS : any = React.createElement;
const { useState: useStateMS, useEffect: useEffectMS } = React;
const { WxNav: WxNavS } = MShell;

function RegTagM({ prefix, id }) {
  return hMS('span', { className: 'mono', style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, letterSpacing: '.04em', color: 'var(--ink-3)' } },
    hMS('span', { style: { fontSize: 8, fontWeight: 700, letterSpacing: '.12em', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 5px', borderRadius: 4 } }, prefix), id);
}

// ============ 授权 ============
function MLicenses({ ctx }) {
  const [f, setF] = useStateMS('all');
  const [licenses, setLicenses] = useStateMS(seed.licenses());
  const [busyId, setBusyId] = useStateMS('');
  const load = () => LicenseApi.list().then(setLicenses).catch(() => {});
  useEffectMS(() => { load(); }, []);
  const tone = { active: 'ok', expired: 'err', pending: 'warn' };
  const label = { active: '生效中', expired: '已过期', pending: '待签署' };
  const filters = [{ key: 'all', label: '全部' }, { key: 'active', label: '生效中' }, { key: 'pending', label: '待签署' }, { key: 'expired', label: '已过期' }];
  const list = licenses.filter(l => f === 'all' || l.status === f);

  const download = async (l) => {
    setBusyId(l.id);
    try {
      const r = await LicenseApi.certificate(l.id);
      if (r.certificateUrl) { window.open(r.certificateUrl, '_blank'); toast('凭证已打开', { tone: 'ok' }); }
      else toast('凭证生成中，请稍后再试', { tone: 'warn' });
    } catch (e: any) { toast(e?.message || '下载失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };
  const renew = async (l) => {
    setBusyId(l.id);
    try { await LicenseApi.renew(l.id); toast('已续签 1 年', { tone: 'ok' }); load(); }
    catch (e: any) { toast(e?.message || '续签失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '授权登记' },
    hMS(WxNavS, { title: '授权登记', onBack: ctx.back }),
    hMS('div', { className: 'm-body', style: { padding: '4px 18px 28px' } },
      hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '真人肖像电子授权凭证档案：完成真人捕获核验后自动登记，原始素材加密存档、与数字人资产绑定。'),
      hMS('div', { style: { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }, className: 'no-bar' },
        filters.map(k => {
          const on = f === k.key;
          return hMS('button', { key: k.key, onClick: () => setF(k.key), style: {
            flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--ink)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600 } }, k.label);
        })),
      list.length === 0 && hMS('div', { style: { textAlign: 'center', padding: '46px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
        hMS('div', { style: { width: 50, height: 50, borderRadius: 15, margin: '0 auto 13px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMS(Icons.shield, { size: 23 })),
        hMS('div', { style: { fontSize: 14.5, fontWeight: 700, marginBottom: 5 } }, '还没有授权登记'),
        hMS('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, '通过「真人授权复刻」创建数字人时会自动登记授权'),
        hMS(UI.Button, { variant: 'primary', icon: Icons.person, onClick: () => { ctx.back(); ctx.startRealClone(); } }, '去真人复刻')),
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
              [['授权范围', l.scope], ['授权期限', l.period], ['使用平台', (l.platforms || []).join(' · ')], ['绑定素材', l.photos + ' 份（加密存档）']].concat(l.char ? [['关联资产', l.char]] : []).map(([k, v]) =>
                hMS('div', { key: k, style: { display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, alignItems: 'baseline' } },
                  hMS('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, k),
                  hMS('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 } }, v)))),
            hMS('div', { style: { display: 'flex', gap: 8, marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--line)' } },
              hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.download, disabled: busyId === l.id, onClick: () => download(l) }, busyId === l.id ? '处理中…' : '下载凭证'),
              l.status === 'expired' && hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.refresh, disabled: busyId === l.id, onClick: () => renew(l) }, '续签'),
              l.status === 'pending' && hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.pen, onClick: () => toast('待对方确认签署后自动生效', { tone: 'ok' }) }, '催签'))))))));
}

// ============ 任务 ============
function MTasks({ ctx }) {
  const [tasks, setTasks] = useStateMS(seed.jobs());
  const [busyId, setBusyId] = useStateMS('');
  // 真实轮询（live 2.5s / mock 1.4s 由 JobApi.list 内部模拟推进）
  useEffectMS(() => {
    let live = true;
    const tick = () => JobApi.list().then(d => { if (live) setTasks(d.map(t => ({ ...t }))); }).catch(() => {});
    tick();
    const iv = setInterval(tick, USE_MOCK ? 1400 : 2500);
    return () => { live = false; clearInterval(iv); };
  }, []);
  const running = tasks.filter(t => t.status === 'running').length;
  const doneN = tasks.filter(t => t.status === 'done').length;
  const failN = tasks.filter(t => t.status === 'failed').length;
  const modeTone = { mock: 'warn', backend: 'info', selfhost: 'primary' };
  const modeLabel = { mock: '占位', backend: 'AI 引擎', selfhost: '自部署' };
  const stageText = (t) => [t.stage, t.eta].filter(Boolean).join(' · ');

  const retry = async (t) => {
    setBusyId(t.id);
    try { await JobApi.retry(t.id); toast('已重新排队', { tone: 'ok' }); }
    catch (e: any) { toast(e?.message || '重试失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };
  const cancel = async (t) => {
    setBusyId(t.id);
    try { await JobApi.cancel(t.id); toast('已请求取消', { tone: 'ok' }); }
    catch (e: any) { toast(e?.message || '取消失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };
  // 任务对应的衍生类型 → 完成后「查看」直接跳到该衍生的成片，而非只回资产首页
  const derivKeyOf = (t) => {
    if (t.derivKey && DATA.DERIVS.some((d) => d.key === t.derivKey)) return t.derivKey;
    const d = DATA.DERIVS.find((d) => d.name === t.kind);
    return d ? d.key : null;
  };
  const view = async (t) => {
    try {
      const a = await AvatarApi.get(t.char);
      if (a && a.id) {
        const dk = derivKeyOf(t);
        if (dk) ctx.openDeriv(a, dk); else ctx.openChar(a);
        return;
      }
    } catch {}
    toast('关联资产不存在或已删除', { tone: 'warn' });
  };

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '任务中心' },
    hMS(WxNavS, { title: '任务中心', onBack: ctx.back }),
    hMS('div', { className: 'm-body', style: { padding: '4px 18px 28px' } },
      hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '生成、衍生等都是后台任务，会在这里实时更新进度；完成后点「查看」直达成片，失败可重试、进行中可取消。'),
      hMS('div', { style: { display: 'flex', gap: 10, marginBottom: 18 } },
        [['进行中', running, 'primary'], ['已完成', doneN, 'ok'], ['失败', failN, 'err']].map(([k, v, t]) =>
          hMS('div', { key: k, className: 'm-card', style: { flex: 1, padding: '12px 14px' } },
            hMS('div', { style: { fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 } }, k),
            hMS('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4 } },
              hMS('span', { className: 'mono', style: { fontSize: 22, fontWeight: 700, color: `var(--${t})` } }, v),
              hMS('span', { style: { fontSize: 11, color: 'var(--ink-4)' } }, '项')))),
      tasks.length === 0 && hMS('div', { style: { textAlign: 'center', padding: '46px 0', color: 'var(--ink-3)' } },
        hMS('div', { style: { width: 50, height: 50, borderRadius: 99, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--ink-4)' } }, hMS(Icons.bolt, { size: 22 })),
        hMS('div', { style: { fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' } }, '暂无生成任务'),
        hMS('div', { style: { fontSize: 12, marginTop: 4 } }, '创建数字人或生成衍生时会出现在这里')),
      hMS('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 11 } },
        tasks.map(t => hMS('div', { key: t.id, className: 'm-card', style: { padding: '13px 14px' } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
            hMS('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 10, background: t.status === 'failed' ? 'var(--err-s)' : t.status === 'done' ? 'var(--ok-s)' : 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: t.status === 'failed' ? 'var(--err)' : t.status === 'done' ? 'var(--ok)' : 'var(--primary)' } },
              t.status === 'running' ? hMS(UI.Spinner, { size: 17 }) : hMS(t.status === 'failed' ? Icons.warn : Icons.checkc, { size: 19 })),
            hMS('div', { style: { flex: 1, minWidth: 0 } },
              hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
                hMS('span', { style: { fontSize: 13.5, fontWeight: 700 } }, t.kind),
                hMS('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, t.charName)),
              hMS('div', { style: { marginTop: 3 } }, hMS(UI.Badge, { tone: modeTone[t.mode] || 'info' }, (modeLabel[t.mode] || t.mode) + ' · ' + t.engine)))),
          hMS('div', { style: { marginTop: 11 } },
            t.status === 'running'
              ? hMS(React.Fragment, null,
                  hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                    hMS('div', { style: { flex: 1 } }, hMS(UI.Progress, { pct: Math.round(t.pct), showLabel: true })),
                    hMS(UI.Button, { variant: 'line', size: 'sm', disabled: busyId === t.id, onClick: () => cancel(t) }, '取消')),
                  hMS('div', { className: 'm-clip1', style: { marginTop: 7, fontSize: 11, color: 'var(--ink-3)' } },
                    '· ' + (stageText(t) || '处理中')))
              : hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
                  hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 } },
                    hMS(RegTagM, { prefix: 'JOB', id: t.id }),
                    hMS('span', { className: 'm-clip1', style: { fontSize: 11, color: t.status === 'failed' ? 'var(--err)' : 'var(--ink-3)', flex: 1 } }, '· ' + ((t as any).error || t.eta))),
                  t.status === 'failed'
                    ? hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.retry, disabled: busyId === t.id, onClick: () => retry(t) }, '重试')
                    : hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.eye, onClick: () => view(t) }, '查看')))))))));
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
    badge != null && badge !== 0 && hMS(UI.Badge, { tone: 'primary' }, badge),
    hMS(Icons.chevR, { size: 17, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }));
}

function MMe({ ctx }) {
  const avatars = useApi(() => AvatarApi.list('mine'), seed.avatars());
  const myVoices = useApi(() => VoiceApi.mine(), seed.myVoices());
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const jobs = useApi(() => JobApi.list(), seed.jobs());
  const acct: any = useApi(() => AccountApi.get(), seed.account()) || {};
  const favCount = avatars.filter(c => c.fav).length;
  const u = auth.user() || {};
  const displayName = u.displayName || u.studioName || u.username || '柯岚工作室';
  const uid = u.id ? String(u.id).slice(0, 8) : '88621049';
  return hMS('div', { className: 'm-body has-tabbar', 'data-screen-label': '我的' },
    hMS(WxNavS, { title: '我的',
      right: hMS('button', { className: 'nav-spacer m-tap', onClick: () => ctx.go('settings'), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMS(Icons.settings, { size: 20, stroke: 1.8 })) }),

    hMS('div', { style: { padding: '6px 18px 0' } },
      hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        hMS('div', { style: { width: 60, height: 60, flex: '0 0 60px', borderRadius: 20, background: 'var(--grad)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 24, boxShadow: '0 8px 18px rgba(18,179,222,.26)' } }, displayName.slice(0, 1)),
        hMS('div', { style: { minWidth: 0 } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            hMS('span', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 20 } }, displayName),
            hMS(UI.Badge, { tone: 'primary' }, acct.planLabel || 'PRO')),
          hMS('div', { className: 'mono', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 } }, 'UID · ' + uid)))),

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

    hMS('div', { style: { padding: '16px 18px 0', display: 'flex', gap: 10 } },
      [['数字人', avatars.length, () => ctx.tab('library')], ['声音', myVoices.length, () => ctx.go('voice')], ['授权', licenses.length, () => ctx.go('licenses')]].map(([k, v, fn]: any) =>
        hMS('button', { key: k, onClick: fn, className: 'm-card m-tap', style: { flex: 1, padding: '13px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--line)' } },
          hMS('div', { className: 'mono', style: { fontSize: 20, fontWeight: 700, color: 'var(--ink)' } }, v),
          hMS('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, k)))),

    hMS('div', { style: { padding: '20px 18px 0' } },
      hMS('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, '工作台'),
      hMS('div', { className: 'm-card', style: { padding: 0 } },
        hMS(MeRow, { icon: Icons.mic, label: '声音工作室', sub: myVoices.length + ' 个声线资产', color: 'var(--ink-2)', onClick: () => ctx.go('voice') }),
        hMS(MeRow, { icon: Icons.shield, label: '授权登记', sub: '真人肖像电子授权', color: 'var(--ink-2)', onClick: () => ctx.go('licenses') }),
        hMS(MeRow, { icon: Icons.bolt, label: '任务中心', sub: '生成 / 衍生进度', color: 'var(--primary)', badge: jobs.filter(t => t.status === 'running').length, onClick: () => ctx.go('tasks') }),
        hMS(MeRow, { icon: Icons.heart, label: '我的收藏', sub: favCount + ' 个数字人', color: 'var(--ink-2)', onClick: () => ctx.tab('library'), last: true }))),

    hMS('div', { style: { padding: '18px 18px 0' } },
      hMS('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, '账户'),
      hMS('div', { className: 'm-card' },
        hMS(MeRow, { icon: Icons.gem, label: '会员与算力', sub: (acct.planLabel || 'PRO') + ' · ' + (acct.credits || 0).toLocaleString() + ' 点', color: 'var(--ink-2)', onClick: () => ctx.go('membership') }),
        hMS(MeRow, { icon: Icons.folder, label: '存储用量', sub: (acct.storageUsedGB ?? 0) + ' / ' + (acct.storageQuotaGB ?? 0) + ' GB', color: 'var(--ink-2)', onClick: () => ctx.go('storage') }),
        hMS(MeRow, { icon: Icons.trash, label: '回收站', sub: '已删数字人 · 30 天内可恢复', color: 'var(--ink-2)', onClick: () => ctx.go('trash') }),
        hMS(MeRow, { icon: Icons.settings, label: '设置', color: 'var(--ink-2)', onClick: () => ctx.go('settings'), last: true }))),

    hMS('div', { style: { padding: '22px 18px 10px', textAlign: 'center' } },
      hMS('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)' } }, '数字人资产平台 · v4.1')));
}

// ============ 回收站 Trash ============
function MTrash({ ctx }) {
  const [items, setItems] = useStateMS([] as any[]);
  const [loaded, setLoaded] = useStateMS(false);
  const [confirm, setConfirm] = useStateMS(null as any); // 待彻底删除的条目
  const [busyId, setBusyId] = useStateMS('');

  const load = () => AvatarApi.trash().then((l) => { setItems(l || []); setLoaded(true); }).catch(() => setLoaded(true));
  useEffectMS(() => { load(); }, []);

  const doRestore = async (it) => {
    if (busyId) return;
    setBusyId(it.id);
    try {
      await AvatarApi.restore(it.id);
      toast('已恢复「' + it.name + '」', { tone: 'ok' });
      ctx.reload && ctx.reload();
      load();
    } catch (e: any) { toast(e?.message || '恢复失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };

  const doPurge = async () => {
    if (!confirm || busyId) return;
    setBusyId(confirm.id);
    try {
      await AvatarApi.purge(confirm.id);
      toast('已彻底删除', { tone: 'ok' });
      setConfirm(null);
      load();
    } catch (e: any) { toast(e?.message || '删除失败', { tone: 'err' }); }
    finally { setBusyId(''); }
  };

  const daysLeftOf = (it) => {
    if (it.daysLeft != null) return it.daysLeft;
    if (it.purgeAt) return Math.max(0, Math.ceil((new Date(it.purgeAt).getTime() - Date.now()) / 86400000));
    return 30;
  };

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '回收站' },
    hMS(WxNavS, { title: '回收站', onBack: ctx.back }),
    hMS('div', { className: 'm-body', style: { padding: '12px 18px 24px' } },
      hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '10px 13px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' } },
        hMS(Icons.info, { size: 15, style: { color: 'var(--ink-3)', flex: '0 0 auto' } }),
        hMS('span', { style: { fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 } }, '删除的数字人在这里保留 30 天，可随时恢复；到期自动彻底清理（含全部图集 / 衍生 / 文件）。')),
      !items.length
        ? hMS('div', { style: { textAlign: 'center', padding: '52px 18px' } },
            hMS('div', { style: { width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--ink-4)' } }, hMS(Icons.trash, { size: 24 })),
            hMS('div', { style: { fontSize: 14.5, fontWeight: 700, color: 'var(--ink-2)' } }, loaded ? '回收站是空的' : '加载中…'),
            loaded && hMS('div', { style: { fontSize: 12, color: 'var(--ink-4)', marginTop: 5 } }, '删除的数字人会出现在这里'))
        : hMS('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
            items.map((it) => hMS('div', { key: it.id, className: 'm-card', style: { padding: 12, display: 'flex', alignItems: 'center', gap: 12 } },
              hMS('div', { style: { width: 56, flex: '0 0 56px', borderRadius: 'var(--r-sm)', overflow: 'hidden' } },
                hMS(Portrait, { char: it, variant: 'key', ratio: '3 / 4', expr: 'calm' })),
              hMS('div', { style: { flex: 1, minWidth: 0 } },
                hMS('div', { className: 'm-clip1', style: { fontSize: 14.5, fontWeight: 700 } }, it.name),
                hMS('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, it.archetype || (it.path === 'real' ? '真人授权复刻' : 'AI 原创形象')),
                hMS('div', { style: { fontSize: 11, color: daysLeftOf(it) <= 3 ? 'var(--err)' : 'var(--ink-4)', marginTop: 4, fontWeight: 600 } }, '剩 ' + daysLeftOf(it) + ' 天自动清理')),
              hMS('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, flex: '0 0 auto' } },
                hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.refresh, disabled: busyId === it.id, onClick: () => doRestore(it) }, busyId === it.id ? '处理中' : '恢复'),
                hMS('button', { onClick: () => setConfirm(it), className: 'm-tap', style: { height: 30, padding: '0 12px', border: '1px solid color-mix(in oklab, var(--err) 38%, transparent)', borderRadius: 'var(--r-pill)', background: 'none', color: 'var(--err)', fontSize: 12, fontWeight: 700, cursor: 'pointer' } }, '彻底删除'))))),
      hMS(UI.Confirm, { open: !!confirm, onClose: () => setConfirm(null), onConfirm: doPurge, busy: !!busyId,
        title: '彻底删除「' + (confirm ? confirm.name : '') + '」？',
        desc: '将立即删除该数字人及其全部图集 / 衍生 / 版本与文件，不可恢复。',
        confirmText: '彻底删除' })));
}

export { MLicenses };
export { MTasks };
export { MMe };
export { MTrash };
