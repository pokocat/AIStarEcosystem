"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, LicenseApi, RealAuthApi, JobApi, VoiceApi, AccountApi, useApi, seed, USE_MOCK, auth } from "./api";
import { MShell, MKit } from "./shell";
import { Portrait } from "./portrait";
import { LivenessBadge, MaterialSection } from "./material-status";
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

// —— 待授权提示卡：真人复刻资产还没有生效肖像授权时，给一个显式的「去认证」入口 ——
//   （列表为空则整块不渲染 —— 授权徽标稀有是设计语义，不做常驻空状态）
function PendingAuthBlock({ items, ctx, pendingByAvatar, onSupplement }) {
  if (!items.length) return null;
  return hMS('div', { className: 'm-card', style: {
    marginBottom: 16, padding: '13px 14px 6px',
    background: 'var(--warn-s)', border: '1px solid color-mix(in oklab, var(--warn) 30%, transparent)' } },
    hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 } },
      hMS(Icons.warn, { size: 15, stroke: 2, style: { color: 'var(--warn)', flex: '0 0 auto' } }),
      hMS('span', { style: { fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 0 } }, '待授权'),
      hMS('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)', flex: '0 0 auto' } }, items.length)),
    hMS('p', { style: { fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 4px' } },
      '以下真人素材还没有完整授权证据。历史记录可直接补协议；缺少有效本人核验时才需要重新刷脸。'),
    hMS('div', { style: { display: 'flex', flexDirection: 'column' } },
      items.map((a) => hMS('div', { key: a.id, style: {
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
        borderTop: '1px solid color-mix(in oklab, var(--warn) 22%, transparent)' } },
        hMS('div', { style: { width: 34, flex: '0 0 34px', borderRadius: 9, overflow: 'hidden' } },
          hMS(Portrait, { char: a, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
        hMS('div', { style: { flex: 1, minWidth: 0 } },
          hMS('div', { className: 'm-clip1', style: { fontSize: 13.5, fontWeight: 700 } }, a.name),
          hMS('div', { className: 'mono m-clip1', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, a.id)),
        pendingByAvatar[a.id]
          ? hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.pen,
              onClick: () => onSupplement(pendingByAvatar[a.id]) }, '补充协议')
          : hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.scan,
              onClick: () => (ctx.startRealMaterial || ctx.startRealAuth)(a) }, '去确认')))));
}

// ============ 授权 ============
function MLicenses({ ctx, realOnly = false }) {
  const [f, setF] = useStateMS('all');
  const [licenses, setLicenses] = useStateMS(seed.licenses());
  const [avatars, setAvatars] = useStateMS(seed.avatars());
  const [busyId, setBusyId] = useStateMS('');
  const [openMat, setOpenMat] = useStateMS('');   // 展开「授权素材」的授权 id（按需加载，避免整页 N 次请求）
  const [supplementId, setSupplementId] = useStateMS('');
  const [agreement, setAgreement] = useStateMS(null as any);
  const [accepted, setAccepted] = useStateMS(false);
  const [agreementBusy, setAgreementBusy] = useStateMS(false);
  const load = () => LicenseApi.list().then(setLicenses).catch(() => {});
  useEffectMS(() => { load(); }, []);
  useEffectMS(() => { AvatarApi.list('mine').then(setAvatars).catch(() => {}); }, []);

  // 真人复刻但没有生效授权的资产 —— 顶部「待授权」入口的数据源
  const activeLicIds = new Set(licenses.filter((l: any) => l.status === 'active').map((l: any) => l.id));
  const needAuth = (avatars || []).filter((a: any) => a.path === 'real' && !(a.license && activeLicIds.has(a.license)));
  const pendingByAvatar = Object.fromEntries(licenses
    .filter((l: any) => l.char && l.status === 'pending' && l.evidenceStatus === 'legacy_unconfirmed')
    .map((l: any) => [l.char, l]));
  const tone = { active: 'ok', expired: 'err', pending: 'warn' };
  const label = { active: '生效中', expired: '已过期', pending: '待补确认' };
  const filters = [{ key: 'all', label: '全部' }, { key: 'active', label: '生效中' }, { key: 'pending', label: '待补确认' }, { key: 'expired', label: '已过期' }];
  const scopedLicenses = realOnly
    ? licenses.filter((l: any) => l.char && l.verifyMethod === 'liveness')
    : licenses;
  const list = scopedLicenses.filter(l => f === 'all' || l.status === f);

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

  const openSupplement = async (l) => {
    if (supplementId === l.id) { setSupplementId(''); setAccepted(false); return; }
    setSupplementId(l.id); setAccepted(false);
    if (agreement) return;
    setAgreementBusy(true);
    try { setAgreement(await RealAuthApi.agreement()); }
    catch (e: any) { toast(e?.message || '授权说明加载失败', { tone: 'err' }); }
    finally { setAgreementBusy(false); }
  };
  const supplement = async (l) => {
    if (!agreement || !accepted) return;
    setBusyId(l.id);
    try {
      await LicenseApi.supplement(l.id, agreement.version);
      toast('协议确认已补充，授权证据已生效', { tone: 'ok' });
      setSupplementId(''); setAccepted(false); await load();
    } catch (e: any) {
      if (e?.code === 'DAP_LIVENESS_REAUTH_REQUIRED') {
        toast('历史本人核验不可复用，需要重新确认', { tone: 'warn' });
        const a = avatars.find((x: any) => x.id === l.char);
        if (a) (ctx.startRealMaterial || ctx.startRealAuth)(a);
      } else toast(e?.message || '补充确认失败', { tone: 'err' });
    } finally { setBusyId(''); }
  };

  return hMS('div', { className: 'm-overlay', 'data-screen-label': realOnly ? '真人授权素材库' : '授权登记' },
    hMS(WxNavS, { title: realOnly ? '真人授权素材库' : '授权登记', onBack: ctx.back }),
    hMS('div', { className: 'm-body', style: { padding: '4px 18px 28px' } },
      realOnly
        ? hMS(React.Fragment, null,
            hMS('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 } },
              hMS('p', { style: { flex: 1, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 } }, '每条素材独立审核，通过后获得可用于视频生成的素材引用；同一真人可继续补充素材，无需重复刷脸。'),
              hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.plus,
                onClick: () => (ctx.startRealMaterial || ctx.startRealClone)() }, '添加真人')),
            hMS(PendingAuthBlock, { items: needAuth, ctx, pendingByAvatar, onSupplement: openSupplement }))
        : hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '平台授权确认档案：真人素材记录协议与本人核验证据，IP 授权记录品牌使用范围。'),
      hMS('div', { style: { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }, className: 'no-bar' },
        filters.map(k => {
          const on = f === k.key;
          return hMS('button', { key: k.key, onClick: () => setF(k.key), style: {
            flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--ink)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600 } }, k.label);
        })),
      list.length === 0 && hMS('div', { style: { textAlign: 'center', padding: '46px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
        hMS('div', { style: { width: 50, height: 50, borderRadius: 15, margin: '0 auto 13px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMS(Icons.shield, { size: 23 })),
        hMS('div', { style: { fontSize: 14.5, fontWeight: 700, marginBottom: 5 } }, realOnly ? '还没有真人素材' : '还没有授权登记'),
        hMS('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, realOnly ? '上传图片或视频，完成人脸确认与逐条审核后即可在视频生成时选择' : '真人素材或 IP 完成授权后会在这里生成凭证'),
        realOnly && hMS(UI.Button, { variant: 'primary', icon: Icons.person, onClick: () => (ctx.startRealMaterial || ctx.startRealClone)() }, '添加第一个真人')),
      hMS('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 13 } },
        list.map(l => hMS('div', { key: l.id, className: 'm-card', style: { overflow: 'hidden' } },
          hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 13px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' } },
            hMS(RegTagM, { prefix: 'LIC', id: l.id }),
            hMS('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' } },
              hMS(LivenessBadge, { verifyMethod: l.verifyMethod, evidenceStatus: l.evidenceStatus }),
              hMS(UI.Badge, { tone: tone[l.status], dot: true }, label[l.status]))),
          hMS('div', { style: { position: 'relative', padding: '14px 15px 15px' } },
            l.status === 'active' && hMS('span', { className: 'seal', style: { position: 'absolute', top: 12, right: 13, fontSize: 9 } }, '证据完整'),
            hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
              hMS('div', { style: { width: 36, height: 36, borderRadius: 10, flex: '0 0 36px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hMS(Icons.shield, { size: 19 })),
              hMS('div', { className: 'asset-name', style: { fontSize: 16.5 } }, l.subject)),
            hMS('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              [['授权范围', l.scope], ['授权期限', l.period], ['使用平台', (l.platforms || []).join(' · ')],
                ['授权证据', l.evidenceStatus === 'verified' ? '平台确认 + 七牛本人刷脸' : l.evidenceStatus === 'legacy_unconfirmed' ? '待补当前协议确认' : '平台登记'],
                ['协议版本', l.agreementVersion || '历史版本'], ['绑定素材', l.photos + ' 份（加密存档）']].concat(l.char ? [['关联资产', l.char]] : []).map(([k, v]) =>
                hMS('div', { key: k, style: { display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, alignItems: 'baseline' } },
                  hMS('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, k),
                  hMS('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 } }, v)))),
            hMS('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--line)' } },
              l.status === 'active' && hMS(UI.Button, { variant: 'line', size: 'sm', icon: Icons.download, disabled: busyId === l.id, onClick: () => download(l) }, busyId === l.id ? '处理中…' : '下载凭证'),
              realOnly && l.status === 'active' && l.char && hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.plus,
                onClick: () => {
                  const a = avatars.find((x: any) => x.id === l.char);
                  if (a) (ctx.startRealMaterial || ctx.startRealAuth)(a);
                  else toast('关联真人不存在或已删除', { tone: 'warn' });
                } }, '补充素材'),
              l.status === 'expired' && hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.refresh, disabled: busyId === l.id, onClick: () => renew(l) }, '续签'),
              l.status === 'pending' && l.verifyMethod === 'liveness' && hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.pen, disabled: busyId === l.id, onClick: () => openSupplement(l) }, supplementId === l.id ? '收起' : '补充协议'),
              l.status === 'pending' && l.verifyMethod !== 'liveness' && hMS(UI.Button, { variant: 'primary', size: 'sm', icon: Icons.pen,
                onClick: () => toast('待授权方确认后自动生效', { tone: 'ok' }) }, '催签')),

            supplementId === l.id && hMS('div', { style: { marginTop: 12, padding: 13, borderRadius: 'var(--r-md)', border: '1px solid var(--line-2)', background: 'var(--surface-2)' } },
              agreementBusy && hMS('div', { style: { fontSize: 12.5, color: 'var(--ink-3)' } }, '正在读取当前授权说明…'),
              agreement && hMS(React.Fragment, null,
                hMS('div', { style: { fontSize: 14, fontWeight: 750, marginBottom: 5 } }, agreement.title),
                hMS('p', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 10px' } }, agreement.summary),
                hMS('div', { style: { display: 'grid', gridTemplateColumns: '64px 1fr', gap: '6px 9px', fontSize: 11.5, lineHeight: 1.45, marginBottom: 10 } },
                  hMS('span', { style: { color: 'var(--ink-3)' } }, '授权范围'), hMS('strong', null, agreement.scope),
                  hMS('span', { style: { color: 'var(--ink-3)' } }, '有效期限'), hMS('strong', null, agreement.periodMonths + ' 个月'),
                  hMS('span', { style: { color: 'var(--ink-3)' } }, '处理方'), hMS('strong', null, agreement.processors.join(' · '))),
                hMS('label', { className: 'm-tap', style: { display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 11px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (accepted ? 'var(--primary)' : 'var(--line)'), background: accepted ? 'var(--primary-tint)' : 'var(--surface)', cursor: 'pointer' } },
                  hMS('input', { type: 'checkbox', checked: accepted, onChange: (e) => setAccepted(e.target.checked), style: { width: 17, height: 17, margin: 0, accentColor: 'var(--primary)', flex: '0 0 auto' } }),
                  hMS('span', { style: { fontSize: 12, lineHeight: 1.5 } }, '我已阅读并确认当前说明，同意按以上范围处理和使用本人的真人素材。')),
                hMS(UI.Button, { variant: 'dark', size: 'sm', full: true, style: { marginTop: 10 }, disabled: !accepted || busyId === l.id, onClick: () => supplement(l) }, busyId === l.id ? '确认中…' : '确认并补充协议'))),

            // 授权素材：绑定资产的平台审核记录（点开再拉，避免列表一次发 N 个请求）
            l.char && hMS('div', { style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' } },
              hMS('button', { onClick: () => setOpenMat(openMat === l.id ? '' : l.id), className: 'm-tap', style: {
                display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' } },
                hMS(Icons.images, { size: 15, stroke: 2, style: { color: 'var(--ink-3)', flex: '0 0 auto' } }),
                hMS('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', flex: 1, minWidth: 0 } }, '授权素材'),
                hMS(Icons[openMat === l.id ? 'chevU' : 'chevD'], { size: 16, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } })),
              openMat === l.id && hMS('div', { style: { marginTop: 10 } },
                hMS(MaterialSection, { refType: 'subject', refId: l.char, mode: 'readonly', title: '真人素材审核状态',
                  style: { boxShadow: 'none', background: 'var(--surface-2)' } }),
                hMS('div', { style: { fontSize: 11, color: 'var(--ink-4)', marginTop: 8, lineHeight: 1.45 } },
                  '素材需通过内容安全审核后才能用于视频生成。')))))))));
}

// ============ 任务 ============
function MTasks({ ctx }) {
  const [tasks, setTasks] = useStateMS(seed.jobs());
  const [busyId, setBusyId] = useStateMS('');
  const [f, setF] = useStateMS('all');
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

  const filters = [
    { key: 'all', label: '全部', n: tasks.length },
    { key: 'running', label: '进行中', n: running },
    { key: 'done', label: '已完成', n: doneN },
    { key: 'failed', label: '失败', n: failN },
  ];
  const ord = { running: 0, failed: 1, done: 2 };
  const list = tasks.filter(t => f === 'all' || t.status === f)
    .slice().sort((a, b) => (ord[a.status] ?? 9) - (ord[b.status] ?? 9));
  const activeLabel = (filters.find(x => x.key === f) || filters[0]).label;
  const tint = {
    running: { c: 'var(--primary)', s: 'var(--primary-soft)' },
    done:    { c: 'var(--ok)', s: 'var(--ok-s)' },
    failed:  { c: 'var(--err)', s: 'var(--err-s)' },
  };

  // 单条任务卡 —— 顶部状态图标 + 名称（+时间/预览标），底部按状态分流操作
  const taskCard = (t) => {
    const m = tint[t.status] || tint.running;
    return hMS('div', { key: t.id, className: 'm-card', style: { padding: '13px 14px' } },
      hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        hMS('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: m.s, display: 'grid', placeItems: 'center', color: m.c } },
          t.status === 'running' ? hMS(UI.Spinner, { size: 17 }) : hMS(t.status === 'failed' ? Icons.warn : Icons.checkc, { size: 20, stroke: 2 })),
        hMS('div', { style: { flex: 1, minWidth: 0 } },
          hMS('div', { className: 'm-clip1', style: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, t.kind),
          hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 } },
            hMS('span', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', minWidth: 0, flex: '1 1 auto' } }, t.charName),
            t.started && hMS('span', { style: { width: 3, height: 3, borderRadius: 99, flex: '0 0 auto', background: 'var(--ink-4)' } }),
            t.started && hMS('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)', flex: '0 0 auto', whiteSpace: 'nowrap' } }, t.started))),
        t.mode === 'mock' && hMS(UI.Badge, { tone: 'warn' }, '预览')),
      hMS('div', { style: { marginTop: 11 } },
        t.status === 'running'
          ? hMS(React.Fragment, null,
              hMS('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                hMS('div', { style: { flex: 1 } }, hMS(UI.Progress, { pct: Math.round(t.pct), showLabel: true })),
                hMS(UI.Button, { variant: 'line', size: 'sm', disabled: busyId === t.id, onClick: () => cancel(t) }, busyId === t.id ? '取消中…' : '取消')),
              stageText(t) && hMS('div', { className: 'm-clip1', style: { marginTop: 7, fontSize: 11.5, color: 'var(--ink-3)' } }, stageText(t)))
          : t.status === 'failed'
            ? hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } },
                hMS('span', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--err)', flex: 1, minWidth: 0 } }, t.error || t.eta || '生成失败'),
                hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.retry, disabled: busyId === t.id, onClick: () => retry(t) }, '重试'))
            : hMS('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } },
                hMS('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--ok)' } },
                  hMS(Icons.check, { size: 14, stroke: 2.4 }), '结果已就绪'),
                hMS(UI.Button, { variant: 'soft', size: 'sm', icon: Icons.eye, onClick: () => view(t) }, '查看'))));
  };

  // 完全没有任务 —— 教学型空态 + 直接去创建
  const emptyAll = hMS('div', { style: { textAlign: 'center', padding: '60px 24px 0' } },
    hMS('div', { style: { width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMS(Icons.bolt, { size: 27, stroke: 1.8 })),
    hMS('div', { style: { fontFamily: 'var(--font-disp)', fontSize: 17, fontWeight: 800, color: 'var(--ink)' } }, '暂无生成任务'),
    hMS('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '7px auto 20px', maxWidth: 268 } }, '创建数字人、生成图集或衍生时，任务会出现在这里，并实时更新进度。'),
    hMS(UI.Button, { variant: 'primary', icon: Icons.plus, onClick: () => { ctx.back(); ctx.openCreateSheet(); } }, '创建数字人'));

  return hMS('div', { className: 'm-overlay', 'data-screen-label': '任务中心' },
    hMS(WxNavS, { title: '任务中心', onBack: ctx.back }),
    hMS('div', { className: 'm-body', style: { padding: '6px 18px 28px' } },
      tasks.length === 0
        ? emptyAll
        : hMS(React.Fragment, null,
            hMS('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } },
              running > 0 ? running + ' 个任务进行中 · 进度实时更新' : '生成与衍生都在后台完成，记录保留在这里'),
            hMS('div', { className: 'no-bar', style: { display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' } },
              filters.map(k => hMS(UI.FilterPill, { key: k.key, active: f === k.key, count: k.n, onClick: () => setF(k.key) }, k.label))),
            list.length === 0
              ? hMS('div', { style: { textAlign: 'center', padding: '40px 18px' } },
                  hMS('div', { style: { fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' } }, '没有' + activeLabel + '的任务'),
                  hMS('button', { onClick: () => setF('all'), className: 'm-tap', style: { marginTop: 10, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' } }, '查看全部任务'))
              : hMS('div', { key: f, className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 11 } },
                  list.map(taskCard)))));
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
        hMS(MeRow, { icon: Icons.shield, label: '真人授权素材库', sub: '授权素材与审核状态', color: 'var(--ink-2)', onClick: () => ctx.go('realmaterials') }),
        hMS(MeRow, { icon: Icons.bolt, label: '任务中心', sub: '生成 / 衍生进度', color: 'var(--primary)', badge: jobs.filter(t => t.status === 'running').length, onClick: () => ctx.go('tasks') }),
        hMS(MeRow, { icon: Icons.heart, label: '我的收藏', sub: favCount + ' 个数字人', color: 'var(--ink-2)', onClick: () => ctx.tab('library'), last: true }))),

    hMS('div', { style: { padding: '18px 18px 0' } },
      hMS('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 2px 9px' } }, '账户'),
      hMS('div', { className: 'm-card' },
        hMS(MeRow, { icon: Icons.gem, label: '会员与算力', sub: (acct.planLabel || 'PRO') + ' · ' + (acct.credits || 0).toLocaleString() + ' 点', color: 'var(--ink-2)', onClick: () => ctx.go('membership') }),
        hMS(MeRow, { icon: Icons.folder, label: '存储用量', sub: (acct.storageUsedMb ?? 0) + ' / ' + (acct.storageQuotaMb ?? 0) + ' MB', color: 'var(--ink-2)', onClick: () => ctx.go('storage') }),
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
export function MRealMaterials(props) { return hMS(MLicenses, { ...props, realOnly: true }); }
export { MTasks };
export { MMe };
export { MTrash };
