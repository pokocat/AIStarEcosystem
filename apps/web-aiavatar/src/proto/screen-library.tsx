"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, LicenseApi, PlazaAdminApi, awaitJob, useApi, seed, USE_MOCK, auth, AuthApi, isOperatorRole } from "./api";
import { Portrait } from "./portrait";
import { LiveJobBadge } from "./job-badge";
import { MShell, MKit } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 数字人库 Library + 资产详情 Detail
// ============================================================
const hML : any = React.createElement;
const { useState: useStateML, useEffect: useEffectML } = React;
const { WxNav: WxNavL } = MShell;
const { MStatus: MStatusL, MPath: MPathL, CornerTicks: CornerTicksL } = MKit;

// —— 数字人广场 · 运营内嵌后台 —————————————————————————————
/** 当前用户是否运营（OPERATOR / SUPER_ADMIN）。mock/dev 默认开放，便于本地演示。 */
function useIsOperator() {
  const [op, setOp] = useStateML(USE_MOCK || isOperatorRole(auth.user()?.operatorRole));
  useEffectML(() => {
    if (USE_MOCK) return;
    let live = true;
    AuthApi.me().then((u: any) => { if (live) setOp(isOperatorRole(u?.operatorRole)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return op;
}

const PLAZA_CATS: [string, string][] = [['pro', '专业'], ['life', '生活方式'], ['ugc', 'UGC'], ['community', '社区']];

/** 单张形象图上传槽位（点选 → 上传 → 预览）。 */
function PlazaImgSlot({ label, required, value, busy, onPick }) {
  return hML('label', { className: 'm-tap', style: {
      position: 'relative', display: 'block', aspectRatio: '3 / 4', borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer',
      border: '1.5px dashed ' + (value ? 'var(--primary)' : 'var(--line-3)'), background: value ? '#0b0d12' : 'var(--surface-2)' } },
    value && hML('img', { src: value.url, alt: label, loading: 'lazy', decoding: 'async', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }),
    !value && hML('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink-3)' } },
      busy ? hML(UI.Spinner, { size: 18 }) : hML(Icons.add, { size: 20, stroke: 2 }),
      hML('div', { style: { fontSize: 11.5, fontWeight: 600 } }, label + (required ? ' *' : ''))),
    value && hML('div', { className: 'ph-label', style: { left: 6, bottom: 6 } }, busy ? '上传中…' : label),
    hML('input', { type: 'file', accept: 'image/*', style: { display: 'none' },
      onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) onPick(f); e.target.value = ''; } }));
}

/** 新增 / 编辑公开数字人表单（底部 sheet）。 */
function PlazaAvatarForm({ avatar, onClose, onSaved }) {
  const edit = !!avatar;
  const d0 = (avatar && avatar.def) || {};
  const initImg = (u) => (u ? { key: undefined, url: u } : null);
  const [name, setName] = useStateML(avatar?.name || '');
  const [tagline, setTagline] = useStateML(avatar?.tagline || '');
  const [archetype, setArchetype] = useStateML(avatar?.archetype || '');
  const [cat, setCat] = useStateML(avatar?.cat || 'pro');
  const [front, setFront] = useStateML(initImg(avatar?.shotImages?.['front-half'] || avatar?.imageUrl));
  const [right, setRight] = useStateML(initImg(avatar?.shotImages?.right));
  const [left, setLeft] = useStateML(initImg(avatar?.shotImages?.left));
  const [age, setAge] = useStateML(d0['年龄'] || '');
  const [temper, setTemper] = useStateML(d0['气质'] || '');
  const [usage, setUsage] = useStateML(d0['用途'] || '');
  const [traits, setTraits] = useStateML(Array.isArray(d0['性格']) ? d0['性格'].join('、') : (d0['性格'] || ''));
  const [outfit, setOutfit] = useStateML(d0['服饰'] || '');
  const [persona, setPersona] = useStateML(d0['设定语'] || '');
  const [busyKind, setBusyKind] = useStateML('');
  const [saving, setSaving] = useStateML(false);

  const pick = async (kind, setter, file) => {
    setBusyKind(kind);
    try { const r = await PlazaAdminApi.uploadImage(file, kind); setter({ key: r.key, url: r.url }); }
    catch (e: any) { toast(e?.message || '图片上传失败', { tone: 'err' }); }
    finally { setBusyKind(''); }
  };

  const submit = async () => {
    if (!name.trim()) { toast('请填写名称', { tone: 'warn' }); return; }
    if (!front) { toast('请上传正面半身形象图', { tone: 'warn' }); return; }
    setSaving(true);
    try {
      const body: any = {
        name: name.trim(), tagline: tagline.trim(), archetype: archetype.trim(), cat,
        frontKey: front.key, rightKey: right?.key, leftKey: left?.key,
        frontUrl: front.url, rightUrl: right?.url, leftUrl: left?.url,
        age: age.trim(), temperament: temper.trim(), usage: usage.trim(),
        traits: traits.split(/[，,、\s]+/).map((s) => s.trim()).filter(Boolean), outfit: outfit.trim(), persona: persona.trim(),
      };
      if (edit) await PlazaAdminApi.update(avatar.id, body); else await PlazaAdminApi.create(body);
      toast(edit ? '已保存' : '已新增公开数字人', { tone: 'ok' });
      onSaved && onSaved();
    } catch (e: any) { toast(e?.message || '保存失败', { tone: 'err' }); }
    finally { setSaving(false); }
  };

  const field = (label, node) => hML('div', { style: { marginTop: 12 } },
    hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 7 } }, label), node);

  return hML(React.Fragment, null,
    hML('div', { className: 'm-sheet-backdrop', onClick: saving ? undefined : onClose }),
    hML('div', { className: 'm-sheet', style: { padding: '0 18px calc(16px + var(--home-ind))', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto' } },
      hML('div', { className: 'm-sheet-grip' }),
      hML('div', { style: { padding: '6px 0 2px' } },
        hML('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 18 } }, edit ? '编辑公开数字人' : '新增公开数字人'),
        hML('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 3 } }, '上传形象图并填写人设，发布到「数字人广场」供所有用户另存使用。')),

      field('形象图（正面半身 / 右侧脸 / 左侧脸）', hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } },
        hML(PlazaImgSlot, { label: '正面半身', required: true, value: front, busy: busyKind === 'front', onPick: (f) => pick('front', setFront, f) }),
        hML(PlazaImgSlot, { label: '右侧脸', value: right, busy: busyKind === 'right', onPick: (f) => pick('right', setRight, f) }),
        hML(PlazaImgSlot, { label: '左侧脸', value: left, busy: busyKind === 'left', onPick: (f) => pick('left', setLeft, f) }))),

      field('名称 *', hML(UI.Input, { value: name, onChange: setName, placeholder: '如：Annie 安妮' })),
      field('一句话简介', hML(UI.Input, { value: tagline, onChange: setTagline, placeholder: '如：商务发布会与产品讲解的全能数字主持' })),
      field('角色定位', hML(UI.Input, { value: archetype, onChange: setArchetype, placeholder: '如：商务精英主持' })),
      field('分类', hML('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        PLAZA_CATS.map(([k, l]) => hML('button', { key: k, onClick: () => setCat(k), className: 'm-tap', style: {
            height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            border: '1.5px solid ' + (cat === k ? 'var(--ink)' : 'var(--line-2)'), background: cat === k ? 'var(--ink)' : 'var(--surface)', color: cat === k ? '#fff' : 'var(--ink-2)' } }, l)))),

      hML('div', { style: { marginTop: 16, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' } }, '设定档案（可选）'),
      hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' } },
        field('年龄', hML(UI.Input, { value: age, onChange: setAge, placeholder: '约 30 岁' })),
        field('气质', hML(UI.Input, { value: temper, onChange: setTemper, placeholder: '专业 · 干练 · 亲和' }))),
      field('用途', hML(UI.Input, { value: usage, onChange: setUsage, placeholder: '发布会主持 / 产品讲解' })),
      field('性格（顿号或逗号分隔）', hML(UI.Input, { value: traits, onChange: setTraits, placeholder: '专业、可信、沉稳' })),
      field('服饰', hML(UI.Input, { value: outfit, onChange: setOutfit, placeholder: '海军蓝西装 · 商务' })),
      field('设定语', hML(UI.Textarea, { value: persona, onChange: setPersona, rows: 2, placeholder: '一句话点睛的人物设定…' })),

      hML('div', { style: { marginTop: 16 } },
        hML(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: edit ? Icons.check : Icons.add, disabled: saving || !!busyKind, onClick: submit },
          saving ? '保存中…' : (edit ? '保存修改' : '发布到数字人广场')))));
}

// —— 拼贴卡（大图 + 右侧两张小图 + 名称在下）——
function MCollageCard({ char, onOpen, onJobDone }) {
  return hML('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    display: 'block', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', border: 'none', background: 'none' } },
    hML('div', { style: { display: 'flex', gap: 5, height: 150, borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)', background: 'var(--canvas-2)' } },
      hML('div', { style: { flex: '0 0 62%', position: 'relative' } },
        hML(Portrait, { char, variant: 'key', ratio: '', expr: 'calm', style: { width: '100%', height: '100%' } }),
        hML(LiveJobBadge, { char, onDone: onJobDone, compact: true }),
        char.fav && hML('div', { style: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 99, background: 'rgba(255,255,255,.92)', display: 'grid', placeItems: 'center', color: 'var(--err)' } }, hML(Icons.heart, { size: 12, stroke: 2 }))),
      hML('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 } },
        hML('div', { style: { flex: 1, overflow: 'hidden' } }, hML(Portrait, { char, variant: 'threeq', expr: 'smile', style: { width: '100%', height: '100%' } })),
        hML('div', { style: { flex: 1, overflow: 'hidden' } }, hML(Portrait, { char, variant: 'side', expr: 'calm', style: { width: '100%', height: '100%' } })))),
    hML('div', { className: 'asset-name m-clip1', style: { fontSize: 18, marginTop: 9 } }, char.name));
}

// 列表行卡（list 视图）
function MAssetCard({ char, onOpen }) {
  return hML('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: 10, cursor: 'pointer',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
    hML('div', { style: { width: 54, height: 54, flex: '0 0 54px', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--line)' } },
      hML(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
    hML('div', { style: { flex: 1, minWidth: 0 } },
      hML('div', { className: 'asset-name m-clip1', style: { fontSize: 16 } }, char.name),
      hML('div', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 2 } }, char.archetype)),
    hML(Icons.chevR, { size: 18, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }));
}

function MLibrary({ ctx }) {
  const [top, setTop] = useStateML('mine'); // mine | public
  const [cat, setCat] = useStateML('all');
  const [q, setQ] = useStateML('');
  const [view, setView] = useStateML('grid');
  const [fav, setFav] = useStateML(false);
  const isOperator = useIsOperator();
  const [plazaForm, setPlazaForm] = useStateML(null as any);   // { avatar }（avatar=null → 新增）
  const [reloadSeq, setReloadSeq] = useStateML(0);

  // 显式跟踪 loading，避免「正在拉后端数据」时整页空白（live 模式 seed 为空）
  const [pool, setPool] = useStateML(seed.avatars(top === 'mine' ? 'mine' : 'public'));
  const [loading, setLoading] = useStateML(!USE_MOCK);
  useEffectML(() => {
    let live = true;
    const initial = seed.avatars(top === 'mine' ? 'mine' : 'public');
    setPool(initial);
    setLoading(!USE_MOCK && initial.length === 0);
    AvatarApi.list(top === 'mine' ? 'mine' : 'public')
      .then((d) => { if (live) { setPool(d); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [top, reloadSeq]);
  let list: any = pool.slice();
  if (fav) list = list.filter(c => c.fav);
  if (top === 'public' && cat !== 'all') list = list.filter(c => cat === 'fav' ? c.fav : c.cat === cat);
  if (q) list = list.filter(c => (c.name + (c.archetype || '') + c.id).toLowerCase().includes(q.toLowerCase()));

  const cats = [
    { key: 'all', label: '全部' }, { key: 'pro', label: '专业' }, { key: 'life', label: '生活方式' },
    { key: 'ugc', label: 'UGC' }, { key: 'community', label: '社区' }, { key: 'fav', label: '收藏' },
  ];

  return hML('div', { className: 'm-body has-tabbar', 'data-screen-label': '数字人库' },
    hML('div', { className: 'wx-nav', style: { paddingLeft: 18 } },
      hML('div', { style: { flex: 1, minWidth: 0, display: 'flex', gap: 22 } },
        [['mine', '我的数字人'], ['public', '数字人广场']].map(([k, l]) => {
          const on = top === k;
          return hML('button', { key: k, onClick: () => setTop(k), style: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', fontFamily: 'var(--font-disp)', fontSize: 16.5, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' } },
            l, on && hML('span', { style: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderRadius: 99, background: 'var(--primary)' } }));
        }))),

    hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 18px 0' } },
      hML('div', { style: { position: 'relative', flex: 1 } },
        hML(Icons.search, { size: 16, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
        hML('input', { value: q, placeholder: '搜索…', onChange: e => setQ(e.target.value), style: {
          width: '100%', height: 42, padding: '0 14px 0 38px', background: 'var(--surface)', border: '1px solid var(--line-2)',
          borderRadius: 'var(--r-pill)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none', boxShadow: 'var(--sh-1)' } })),
      hML('button', { onClick: () => setView(v => v === 'grid' ? 'list' : 'grid'), className: 'm-tap', style: { flex: '0 0 auto', width: 42, height: 42, borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } },
        hML(view === 'grid' ? Icons.list : Icons.gallery, { size: 17, stroke: 1.9 }))),

    top === 'public' && hML('div', { style: { display: 'flex', gap: 8, padding: '13px 18px 0', overflowX: 'auto' }, className: 'no-bar' },
      cats.map(c => {
        const on = cat === c.key;
        return hML('button', { key: c.key, onClick: () => setCat(c.key), style: {
          flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line-2)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)' } }, c.label);
      })),
    top === 'mine' && hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '13px 18px 0' } },
      [['all', '全部'], ['real', '真人复刻'], ['ai', 'AI 原创']].map(([k, l]) => {
        const on = cat === k;
        return hML('button', { key: k, onClick: () => setCat(k), style: { flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line-2)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)' } }, l);
      }),
      hML('div', { style: { flex: 1 } }),
      hML('button', { onClick: () => setFav(f => !f), title: '只看收藏', style: { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 99, cursor: 'pointer', background: fav ? 'var(--primary-soft)' : 'var(--surface)', color: fav ? 'var(--primary)' : 'var(--ink-3)', border: '1px solid ' + (fav ? 'var(--primary)' : 'var(--line-2)') } }, hML(Icons.heart, { size: 16, stroke: 2 }))),

    (() => {
      const filtered = top === 'mine' && cat !== 'all' && cat !== 'fav' ? list.filter(c => c.path === cat) : list;
      // 正在拉取且暂无数据 → 骨架屏（而非空白 / 误导的「没有数字人」空态）
      if (loading && filtered.length === 0) return hML('div', { style: { padding: '14px 18px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 12px' } },
        Array.from({ length: 4 }).map((_, i) => hML('div', { key: i },
          hML('div', { className: 'm-skel', style: { height: 150, borderRadius: 'var(--r-lg)' } }),
          hML('div', { className: 'm-skel', style: { height: 16, width: '68%', marginTop: 9, borderRadius: 6 } }))));
      if (filtered.length === 0 && !(top === 'mine')) return hML('div', { style: { textAlign: 'center', padding: '70px 0', color: 'var(--ink-3)' } },
        hML('div', { style: { width: 52, height: 52, borderRadius: 99, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--ink-4)' } }, hML(Icons.search, { size: 22 })),
        hML('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink-2)' } }, '没有匹配的数字人'));
      return view === 'grid'
        ? hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 12px' } },
            top === 'mine' && hML('button', { key: '__new', onClick: ctx.openCreateSheet, className: 'm-tap', style: { height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', color: 'var(--ink-3)' } },
              hML('span', { style: { width: 42, height: 42, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hML(Icons.add, { size: 20, stroke: 2 })),
              hML('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, '新建数字人')),
            top === 'public' && isOperator && hML('button', { key: '__newpub', onClick: () => setPlazaForm({ avatar: null }), className: 'm-tap', style: { height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: '1.5px dashed var(--primary-soft)', background: 'var(--primary-tint)', borderRadius: 'var(--r-lg)', color: 'var(--primary)' } },
              hML('span', { style: { width: 42, height: 42, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hML(Icons.add, { size: 20, stroke: 2 })),
              hML('span', { style: { fontSize: 13, fontWeight: 700 } }, '新增公开数字人'),
              hML('span', { style: { fontSize: 10.5, color: 'var(--ink-3)' } }, '运营 · 上传形象')),
            filtered.map(c => hML(MCollageCard, { key: c.id, char: c, onOpen: ctx.openChar, onJobDone: ctx.reload })))
        : hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 } },
            filtered.map(c => hML(MAssetCard, { key: c.id, char: c, onOpen: ctx.openChar })));
    })(),

    plazaForm && hML(PlazaAvatarForm, {
      avatar: plazaForm.avatar,
      onClose: () => setPlazaForm(null),
      onSaved: () => { setPlazaForm(null); setReloadSeq((s) => s + 1); },
    }));
}

// ============================================================
// 详情 Detail（图集 / 衍生 / 版本 / 授权 全接真数据）
// ============================================================
// ── 衍生生成配置 Sheet（生成前可自定义：预设多选 / 运镜单选 / 补充描述 / prompt 透出）──
function DerivConfigSheet({ derivKey, char, onClose, onSubmit }) {
  const meta = DATA.DERIVS.find((d: any) => d.key === derivKey) || ({} as any);
  const multi = derivKey === 'expr' || derivKey === 'scene' || derivKey === 'ward';
  const presets = (DATA.DERIV_PRESETS as any)[derivKey] || [];
  const defaultN = (DATA.DERIV_DEFAULT_PICKS as any)[derivKey] || 0;
  const [sel, setSel] = useStateML(multi ? presets.slice(0, defaultN).map((p: any) => p.label) : [] as string[]);
  const [motion, setMotion] = useStateML('orbit');
  const [d3Style, setD3Style] = useStateML('');
  const [tpl, setTpl] = useStateML(char.templateId || 't1');
  const [extra, setExtra] = useStateML('');
  const [showPrompt, setShowPrompt] = useStateML(false);

  const toggle = (label) => setSel((s) => s.includes(label) ? s.filter((x) => x !== label) : (s.length >= 6 ? s : [...s, label]));
  const chosen = presets.filter((p: any) => sel.includes(p.label));
  const count = multi ? chosen.length : derivKey === 'atlas' ? 5 : derivKey === 'd3' ? 4 : 1;
  const canSubmit = !multi || chosen.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const options: any = {};
    if (multi) options.items = chosen.map((p: any) => ({ label: p.label, prompt: p.prompt }));
    if (derivKey === 'video') options.motion = motion;
    const extras: string[] = [];
    if (derivKey === 'd3' && d3Style) {
      const st = DATA.D3_STYLES.find((x: any) => x.label === d3Style);
      if (st) extras.push(st.prompt);
    }
    if (extra.trim()) extras.push(extra.trim());
    if (extras.length) options.extraPrompt = extras.join(', ');
    onSubmit({ options, ...(derivKey === 'atlas' ? { templateId: tpl } : {}) });
  };

  // prompt 透出（实际将送入模型的描述；中文补充会先自动翻译）
  const promptLines: string[] = [];
  if (multi) chosen.forEach((p: any) => promptLines.push(p.label + ' → ' + p.prompt));
  if (derivKey === 'video') {
    const m = DATA.VIDEO_MOTIONS.find((x: any) => x.key === motion);
    promptLines.push((m ? m.label : '环绕运镜') + (motion === 'orbit' ? '（提示词可在后台「Prompt 管理 · dap.video_orbit」调整）' : ''));
  }
  if (derivKey === 'atlas') promptLines.push('5 张标准机位（正面半身 / 全身 / 左右侧脸 / 表情）+ 所选美化模板');
  if (derivKey === 'd3' && d3Style) { const st = DATA.D3_STYLES.find((x: any) => x.label === d3Style); if (st) promptLines.push(d3Style + ' → ' + st.prompt); }
  if (extra.trim()) promptLines.push('补充 → ' + extra.trim() + '（自动翻译为英文）');

  const chip = (on, label, onClick, key?) => hML('button', { key: key ?? label, onClick, className: 'm-tap', style: {
    height: 32, padding: '0 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
    border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--line-2)'),
    background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)' } }, label);

  return hML(React.Fragment, null,
    hML('div', { className: 'm-sheet-backdrop', onClick: onClose }),
    hML('div', { className: 'm-sheet', style: { padding: '0 18px calc(16px + var(--home-ind))', maxHeight: 'calc(100dvh - 58px)', overflowY: 'auto' } },
      hML('div', { className: 'm-sheet-grip' }),
      hML('div', { style: { padding: '6px 0 4px' } },
        hML('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 18 } }, (meta.name || '衍生') + ' · 生成配置'),
        hML('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 3 } }, meta.desc || '')),

      // 多选条目（expr/scene/ward）
      multi && hML('div', { style: { marginTop: 12 } },
        hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 } }, '选择条目 · 每项一张（' + chosen.length + '/6）'),
        hML('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          presets.map((p: any) => chip(sel.includes(p.label), p.label, () => toggle(p.label))))),

      // 运镜单选（video）
      derivKey === 'video' && hML('div', { style: { marginTop: 12 } },
        hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 } }, '运镜方式'),
        hML('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          DATA.VIDEO_MOTIONS.map((m: any) => hML('button', { key: m.key, onClick: () => setMotion(m.key), className: 'm-tap', style: {
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 13px', textAlign: 'left', cursor: 'pointer',
            borderRadius: 'var(--r-md)', border: '1.5px solid ' + (motion === m.key ? 'var(--primary)' : 'var(--line-2)'),
            background: motion === m.key ? 'var(--primary-soft)' : 'var(--surface)' } },
            hML('div', { style: { flex: 1 } },
              hML('div', { style: { fontSize: 13.5, fontWeight: 700, color: motion === m.key ? 'var(--primary)' : 'var(--ink)' } }, m.label),
              hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, m.desc)),
            motion === m.key && hML(Icons.checkc, { size: 17, style: { color: 'var(--primary)' } }))))),

      // 3D 风格单选（d3）
      derivKey === 'd3' && hML('div', { style: { marginTop: 12 } },
        hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 } }, '渲染风格（可选）'),
        hML('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          DATA.D3_STYLES.map((s: any) => chip(d3Style === s.label, s.label, () => setD3Style(d3Style === s.label ? '' : s.label))))),

      // 美化模板（atlas）
      derivKey === 'atlas' && hML('div', { style: { marginTop: 12 } },
        hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 } }, '美化模板'),
        hML('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          DATA.TEMPLATES.slice(0, 5).map((t: any) => chip(tpl === t.id, t.name, () => setTpl(t.id), t.id)))),

      // 补充描述（全类型）
      hML('div', { style: { marginTop: 12 } },
        hML('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8 } }, '补充描述（可选）'),
        hML(UI.Textarea, { value: extra, onChange: setExtra, rows: 2,
          placeholder: derivKey === 'video' ? '例：微风吹动头发、霓虹夜景氛围…' : '例：胶片质感、冷色调、浅景深…' })),

      // prompt 透出
      promptLines.length > 0 && hML('div', { style: { marginTop: 10 } },
        hML('button', { onClick: () => setShowPrompt(!showPrompt), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--primary)', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 } },
          hML(Icons.chevD, { size: 13, stroke: 2.2, style: { transform: showPrompt ? 'rotate(180deg)' : 'none', transition: 'transform .15s' } }),
          showPrompt ? '收起提示词' : '查看将使用的提示词'),
        showPrompt && hML('div', { style: { marginTop: 7, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 5 } },
          promptLines.map((l, i) => hML('div', { key: i, className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'break-all' } }, l)))),

      hML('div', { style: { marginTop: 14 } },
        hML(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.sparkle, disabled: !canSubmit, onClick: submit },
          '开始生成' + (multi ? '（' + chosen.length + ' 张）' : derivKey === 'atlas' ? '(5 张)'.replace('(', '（').replace(')', '）') : '')))));
}

// —— 数字人广场 · 公开形象只读陈列（形象图集 + 设定档案；不带任何编辑 / 生成入口）——
// —— 大图预览灯箱（点开数字人形象图看大图；支持左右切换）——
function MLightbox({ images, index, onClose, onIndex }) {
  const img = (images && images[index]) || {};
  const many = (images || []).length > 1;
  const go = (e, d) => { e.stopPropagation(); onIndex((index + d + images.length) % images.length); };
  const navBtn = (side) => ({ position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 2 } as any);
  return hML('div', { onClick: onClose, style: {
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,10,14,.94)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' } },
    hML('button', { onClick: (e) => { e.stopPropagation(); onClose(); }, className: 'm-tap', style: {
        position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 14, width: 38, height: 38, borderRadius: 99,
        border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 3 } },
      hML(Icons.x, { size: 20, stroke: 2 })),
    hML('img', { src: img.src, alt: img.label || '', decoding: 'async', onClick: (e) => e.stopPropagation(), style: {
        maxWidth: '94vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 44px rgba(0,0,0,.55)' } }),
    img.label && hML('div', { style: { marginTop: 14, color: 'rgba(255,255,255,.92)', fontSize: 13.5, fontWeight: 600 } },
      img.label + (many ? '   ·   ' + (index + 1) + ' / ' + images.length : '')),
    many && hML(React.Fragment, null,
      hML('button', { onClick: (e) => go(e, -1), className: 'm-tap', style: navBtn('left') }, hML(Icons.chevL, { size: 24, stroke: 2 })),
      hML('button', { onClick: (e) => go(e, 1), className: 'm-tap', style: navBtn('right') }, hML(Icons.chevR, { size: 24, stroke: 2 }))));
}

function MPublicShowcase({ char }) {
  const shots = char.shotImages || {};
  // 标准三机位：正面半身（= 定妆主图）/ 右侧脸 / 左侧脸；缺图时退回定妆主图
  const order: [string, string][] = [['front-half', '正面半身'], ['right', '右侧脸'], ['left', '左侧脸']];
  const imgs: any[] = order.filter(([k]) => shots[k]).map(([k, label]) => ({ src: shots[k], label }));
  if (!imgs.length && char.imageUrl) imgs.push({ src: char.imageUrl, label: '正面半身' });
  const [lb, setLb] = useStateML(-1);   // 灯箱打开的图片下标（-1 = 关闭）
  const def = char.def || {};
  const entries = Object.entries(def).filter(([k]) => k !== '设定语');
  const title = (t) => hML('div', { style: { fontSize: 14.5, fontWeight: 700, marginBottom: 12 } }, t);
  return hML('div', { className: 'm-fade', style: { padding: '16px 18px 0' } },
    hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
      hML(Icons.shield, { size: 16, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
      hML('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, '广场公开形象 · 只读展示。「另存为我的数字人」后即可自由改名、迭代与生成衍生。')),
    imgs.length > 0 && hML('div', { style: { marginBottom: 22 } },
      title('形象图集'),
      hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } },
        imgs.map((t, i) => hML('button', { key: i, onClick: () => setLb(i), className: 'm-press', style: {
            display: 'block', padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
            position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
          hML('img', { src: t.src, alt: t.label, loading: 'lazy', decoding: 'async', style: { display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover' } }),
          hML('div', { style: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 7, background: 'rgba(20,24,30,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', color: '#fff' } }, hML(Icons.expand, { size: 12, stroke: 2 })),
          hML('div', { className: 'ph-label', style: { left: 7, bottom: 7 } }, t.label)))),
      hML('div', { style: { fontSize: 11.5, color: 'var(--ink-4)', marginTop: 8 } }, '点击图片查看大图')),
    entries.length > 0 && hML('div', null,
      title('设定档案'),
      hML('div', { style: { display: 'flex', flexDirection: 'column' } },
        entries.map(([k, v]: any) => hML('div', { key: k, style: { padding: '11px 0', borderBottom: '1px solid var(--line)' } },
          hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
          hML('div', { style: { fontSize: 13.5, color: 'var(--ink)', fontWeight: Array.isArray(v) ? 400 : 600, lineHeight: 1.45 } }, Array.isArray(v) ? v.join(' · ') : String(v || '—')))))),
    lb >= 0 && hML(MLightbox, { images: imgs, index: lb, onClose: () => setLb(-1), onIndex: setLb }));
}

/** v0.61 反向「应用于」卡片：数字人被哪些 music/drama 艺人壳引用（引用关系实时来自 server，仅 owner 可见）。 */
function MAppliedTo({ refs }) {
  const APP_META: any = {
    music: { label: 'AI 音乐人', icon: Icons.music },
    drama: { label: 'AI 短剧', icon: Icons.clapper },
  };
  return hML('div', { className: 'm-card', style: { margin: '12px 18px 0', padding: '14px 16px' } },
    hML('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 } },
      hML(Icons.link, { size: 15, stroke: 2, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
      hML('span', { style: { fontSize: 13.5, fontWeight: 700 } }, '应用于'),
      hML('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)' } }, refs.length)),
    hML('div', { style: { display: 'flex', flexDirection: 'column' } },
      refs.map((r: any, i: number) => {
        const meta = APP_META[r.app] || { label: r.app, icon: Icons.link };
        return hML('div', { key: r.ipId || i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < refs.length - 1 ? '1px solid var(--line)' : 'none' } },
          hML('span', { style: { display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--ink-2)', flex: '0 0 auto' } },
            hML(meta.icon, { size: 15, stroke: 2 })),
          hML('div', { style: { flex: 1, minWidth: 0 } },
            hML('div', { className: 'm-clip1', style: { fontSize: 13.5, fontWeight: 700 } }, r.ipName),
            hML('div', { style: { fontSize: 11, color: 'var(--ink-3)', marginTop: 2 } },
              meta.label + (r.importedAt ? ' · ' + String(r.importedAt).slice(0, 10) + ' 引入' : ''))),
          hML(UI.Badge, { tone: r.status === 'active' ? 'ok' : 'mute' }, r.status === 'active' ? '活跃' : r.status));
      })));
}

function MDetail({ char: initialChar, ctx }) {
  const [char, setChar] = useStateML(initialChar);
  const [tab, setTab] = useStateML('assets');
  const [derivBusy, setDerivBusy] = useStateML({} as any);
  const [cfgKey, setCfgKey] = useStateML(null as any);
  const [quickGen, setQuickGen] = useStateML(false);
  const [genSeq, setGenSeq] = useStateML(0);          // 生成完成后递增 → 作品库重新拉取
  const [confirmDel, setConfirmDel] = useStateML(false);
  const [deleting, setDeleting] = useStateML(false);
  const [saving, setSaving] = useStateML(false);
  const [editingName, setEditingName] = useStateML(false);
  const [draftName, setDraftName] = useStateML(char.name || '');
  const [refs, setRefs] = useStateML([] as any[]);   // v0.61 反向「应用于」：引用此数字人的艺人壳
  const voice = ctx.voiceFor(char);
  const s = DATA.STATUS[char.status] || DATA.STATUS.draft;
  const isPublic = String(char.id || '').startsWith('PA-');
  const isOperator = useIsOperator();
  const managed = isPublic && isOperator && !!char.managed;   // 运营可编辑 / 删除的 DB 公开数字人
  const [plazaEdit, setPlazaEdit] = useStateML(false);
  const [confirmDelPub, setConfirmDelPub] = useStateML(false);
  const tabs = [
    { key: 'assets', label: '作品' },
    { key: 'versions', label: '版本' },
    { key: 'license', label: char.path === 'real' ? '肖像授权' : '设定档案' },
  ];
  const wip = char.status !== 'archived' && char.status !== 'finalized' && char.status !== 'deriving';
  const counts: any = char.counts || {};
  const totalAssets = ['atlas', 'expr', 'scene', 'ward', 'd3', 'video'].reduce((a, k) => a + (Number(counts[k]) || 0), 0) + (char.imageUrl ? 1 : 0);

  // 进入详情即拉取最新（live 模式列表数据可能滞后）
  useEffectML(() => {
    if (isPublic) return;
    AvatarApi.get(char.id).then((fresh) => fresh && setChar((c) => ({ ...c, ...fresh }))).catch(() => {});
    AvatarApi.references(char.id).then((list) => setRefs(list || [])).catch(() => {});
  }, []);

  const refresh = async () => {
    try { const fresh = await AvatarApi.get(char.id); setChar((c) => ({ ...c, ...fresh })); ctx.reload && ctx.reload(); } catch {}
  };

  const toggleFav = async () => {
    const next = !char.fav;
    setChar((c) => ({ ...c, fav: next }));
    try { await AvatarApi.patch(char.id, { fav: next }); ctx.reload && ctx.reload(); }
    catch (e: any) { setChar((c) => ({ ...c, fav: !next })); toast(e?.message || '操作失败', { tone: 'err' }); }
  };

  const share = async () => {
    try {
      const url = location.origin + location.pathname + '#detail';
      await navigator.clipboard.writeText(char.name + ' · ' + char.id + ' ' + url);
      toast('已复制分享链接', { tone: 'ok' });
    } catch { toast('复制失败，请手动分享', { tone: 'warn' }); }
  };

  const saveName = async () => {
    const next = draftName.trim();
    if (!next || next === char.name) { setEditingName(false); setDraftName(char.name || ''); return; }
    const prev = char.name;
    setChar((c) => ({ ...c, name: next }));
    setEditingName(false);
    try {
      await AvatarApi.patch(char.id, { name: next });
      ctx.reload && ctx.reload();
      toast('名称已更新', { tone: 'ok' });
    } catch (e: any) {
      setChar((c) => ({ ...c, name: prev }));
      setDraftName(prev || '');
      toast(e?.message || '名称保存失败', { tone: 'err' });
    }
  };

  /** 数字人广场「另存为我的数字人」：复制只读公开形象为可编辑副本并打开它。 */
  const saveAs = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fresh = await AvatarApi.saveAs(char.id);
      toast('已另存为我的数字人 · 现在可自由编辑', { tone: 'ok' });
      ctx.reload && ctx.reload();
      ctx.openChar ? ctx.openChar(fresh) : ctx.back();
    } catch (e: any) {
      toast(e?.message || '另存失败，请稍后重试', { tone: 'err' });
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await AvatarApi.remove(char.id);
      setConfirmDel(false);
      toast('已移入回收站 · 30 天内可在「我的 → 回收站」恢复', { tone: 'ok' });
      ctx.reload && ctx.reload();
      ctx.back();
    } catch (e: any) {
      toast(e?.message || '删除失败', { tone: 'err' });
    } finally { setDeleting(false); }
  };

  /** 真正派发生成（cfg 来自 DerivConfigSheet：{options, templateId?}）。 */
  const runDerive = async (key, cfg?: any) => {
    if (derivBusy[key]) return;
    setDerivBusy((m) => ({ ...m, [key]: { pct: 3 } }));
    try {
      const j = await AvatarApi.createDerivative(char.id, { type: key, ...(cfg || {}) });
      await awaitJob(j.id, (jj) => setDerivBusy((m) => ({ ...m, [key]: { pct: jj.pct, eta: jj.eta } })));
      toast((DATA.DERIVS.find(d => d.key === key) || {}).name + ' · 完成', { tone: 'ok' });
      await refresh();
      setGenSeq((n) => n + 1);
    } catch (e: any) {
      toast(e?.message || '生成失败', { tone: 'err' });
    } finally {
      setDerivBusy((m) => { const n = { ...m }; delete n[key]; return n; });
    }
  };

  /** 生成入口统一先弹配置 sheet（不再一键抽卡）。 */
  const openDerivConfig = (key) => { if (!derivBusy[key]) setCfgKey(key); };

  /** 运营删除 DB 公开数字人（数字人广场下架）。 */
  const doDeletePublic = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await PlazaAdminApi.remove(char.id);
      setConfirmDelPub(false);
      toast('已从数字人广场下架', { tone: 'ok' });
      ctx.reload && ctx.reload();
      ctx.back();
    } catch (e: any) { toast(e?.message || '删除失败', { tone: 'err' }); }
    finally { setDeleting(false); }
  };

  return hML('div', { className: 'm-overlay', 'data-screen-label': '资产详情' },
    hML(WxNavL, { title: char.name, onBack: ctx.back,
      right: hML('div', { style: { display: 'flex', alignItems: 'center', gap: 2 } },
        !isPublic && hML('button', { className: 'm-tap', title: '删除（移入回收站）', onClick: () => setConfirmDel(true), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', width: 34, height: 34 } }, hML(Icons.trash, { size: 18, stroke: 1.9 })),
        managed && hML('button', { className: 'm-tap', title: '编辑公开数字人', onClick: () => setPlazaEdit(true), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', width: 34, height: 34 } }, hML(Icons.pen, { size: 17, stroke: 1.9 })),
        managed && hML('button', { className: 'm-tap', title: '从广场下架', onClick: () => setConfirmDelPub(true), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--err)', display: 'grid', placeItems: 'center', width: 34, height: 34 } }, hML(Icons.trash, { size: 18, stroke: 1.9 })),
        hML('button', { className: 'm-tap', onClick: share, style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center', width: 34, height: 34 } }, hML(Icons.share, { size: 19, stroke: 1.9 }))) }),
    hML(UI.Confirm, { open: confirmDelPub, onClose: () => setConfirmDelPub(false), onConfirm: doDeletePublic, busy: deleting, danger: true,
      title: '从数字人广场下架「' + char.name + '」？',
      desc: '下架后用户不再能在广场看到或另存该形象；已另存的副本不受影响。',
      confirmText: '下架' }),
    plazaEdit && hML(PlazaAvatarForm, { avatar: char,
      onClose: () => setPlazaEdit(false),
      onSaved: () => { setPlazaEdit(false); ctx.reload && ctx.reload(); AvatarApi.get(char.id).then((fresh) => fresh && setChar((c) => ({ ...c, ...fresh }))).catch(() => {}); } }),
    hML(UI.Confirm, { open: confirmDel, onClose: () => setConfirmDel(false), onConfirm: doDelete, busy: deleting,
      title: '删除「' + char.name + '」？',
      desc: '将移入回收站，30 天内可恢复；到期后自动彻底清理（含全部图集 / 衍生 / 版本与文件）。',
      confirmText: '移入回收站' }),
    hML('div', { className: 'm-body', style: { paddingBottom: 88 } },
      // 档案头
      hML('div', { className: 'm-card', style: { margin: '4px 18px 0', overflow: 'hidden' } },
        hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' } },
          hML('span', { className: 'reg-no', style: { fontSize: 11.5 } }, char.id),
          hML('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            char.mock && hML(UI.Badge, { tone: 'warn' }, '预览'),
            hML(MPathL, { path: char.path }))),
        hML('div', { style: { display: 'flex', gap: 0 } },
          hML('div', { style: { position: 'relative', padding: 10, background: 'var(--canvas-2)', flex: '0 0 142px' } },
            hML('div', { style: { position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)' } },
              hML(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
              hML(LiveJobBadge, { char, onDone: refresh }),
              hML('div', { style: { position: 'absolute', bottom: 8, left: 8 } }, hML(MStatusL, { status: char.status }))),
            hML(CornerTicksL, null)),
          hML('div', { style: { flex: 1, minWidth: 0, padding: '12px 12px 12px', display: 'flex', flexDirection: 'column' } },
            hML('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 } },
              editingName
                ? hML('div', { style: { flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'center' } },
                    hML(UI.Input, { value: draftName, onChange: setDraftName, placeholder: '数字人名称', style: { height: 36, fontSize: 13.5, fontWeight: 700, minWidth: 0 } }),
                    hML('button', { onClick: saveName, className: 'm-tap', style: { width: 36, flex: '0 0 36px', height: 36, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center' } }, hML(Icons.check, { size: 17, stroke: 2.4 })))
                : hML('button', { onClick: () => { if (!isPublic) { setDraftName(char.name || ''); setEditingName(true); } }, className: 'm-tap', style: { flex: 1, minWidth: 0, padding: 0, background: 'none', border: 'none', cursor: isPublic ? 'default' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 } },
                    hML('div', { className: 'asset-name-lg m-clip2', style: { fontSize: 18.5, lineHeight: 1.18, minWidth: 0 } }, char.name),
                    !isPublic && hML(Icons.pen, { size: 14, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } })),
              !isPublic && hML('button', { onClick: toggleFav, className: 'm-tap', style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 0, color: char.fav ? 'var(--err)' : 'var(--ink-4)', flex: '0 0 auto' } },
                hML(Icons.heart, { size: 17, stroke: 2 }))),
            hML('div', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 } }, char.codename),
            hML('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.45 } }, char.tagline),
            !isPublic && hML('button', { onClick: () => ctx.chooseVoice(char), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, height: 34, maxWidth: '100%', minWidth: 0, padding: '0 9px 0 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--sh-1)' } },
              hML('span', { style: { display: 'grid', placeItems: 'center', color: 'var(--ink)' } }, hML('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, hML('path', { d: 'M7 5v14l12-7z' }))),
              hML('span', { className: 'm-clip1', style: { minWidth: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' } }, voice),
              hML(Icons.chevD, { size: 15, stroke: 2, style: { color: 'var(--ink-3)' } })))),
        char.def && char.def['设定语'] && hML('div', { style: { padding: '0 16px 15px' } },
          hML('div', { style: { fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, paddingLeft: 11, borderLeft: '2px solid var(--primary-soft)' } }, '“' + char.def['设定语'] + '”'))),

      // 数字人广场公开形象 → 只读陈列（图集 + 设定档案）；自有形象 → 概览统计 + 作品 / 版本 / 档案
      isPublic
        ? hML(MPublicShowcase, { char })
        : hML(React.Fragment, null,
          // 概览统计
          hML('div', { className: 'm-card', style: { margin: '12px 18px 0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' } },
            [['版本', char.versions], ['作品', totalAssets], ['视频', counts.video || 0], ['更新', char.updated]].map(([k, v], i) =>
              hML('div', { key: i, style: { textAlign: 'center', flex: 1, borderLeft: i ? '1px solid var(--line)' : 'none' } },
                hML('div', { className: 'mono', style: { fontSize: 16, fontWeight: 700 } }, v),
                hML('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, k)))),

          // v0.61 反向「应用于」：被 music/drama 艺人壳引用时展示（空列表不渲染）
          refs.length > 0 && hML(MAppliedTo, { refs }),

          // tabs
          hML('div', { style: { position: 'sticky', top: 0, zIndex: 5, background: 'var(--canvas)', padding: '16px 18px 0', marginTop: 6 } },
            hML('div', { style: { display: 'flex', gap: 8, overflowX: 'auto' }, className: 'no-bar' },
              tabs.map(t => {
                const on = t.key === tab;
                return hML('button', { key: t.key, onClick: () => setTab(t.key), style: {
                  flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
                  background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                  fontSize: 13.5, fontWeight: on ? 700 : 600 } }, t.label);
              }))),

          hML('div', { className: 'm-fade', key: tab, style: { padding: '16px 18px 0' } },
            tab === 'assets' && hML(MAssets, { char, ctx, busy: derivBusy, onGenerate: openDerivConfig, onOpenGenerate: () => setQuickGen(true), nonce: genSeq }),
            tab === 'versions' && hML(MVersions, { char, ctx, onChanged: refresh }),
            tab === 'license' && hML(MLicense, { char, ctx })))),

    // 底部固定操作
    hML('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))',
      background: 'linear-gradient(transparent, var(--surface) 28%)', display: 'flex', gap: 9 } },
      isPublic
        ? hML(UI.Button, { variant: 'primary', full: true, icon: Icons.copy, disabled: saving, onClick: saveAs }, saving ? '正在另存…' : '另存为我的数字人')
        : hML(React.Fragment, null,
            hML(UI.Button, { variant: 'primary', full: true, icon: wip ? Icons.bolt : Icons.wand, onClick: () => wip ? ctx.startCreate(char.path, char) : ctx.openLooks(char), style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } },
              wip ? (char.status === 'proofing' && (char.variantImages || []).length ? '挑选形象（' + char.variantImages.length + ' 选 1）' : '继续创建链路') : '设计造型'),
            hML(UI.Button, { variant: 'line', icon: Icons.sparkle, onClick: () => setQuickGen(true), style: { flex: '0 0 144px', padding: '0 12px' } }, '生成更多资产'))),

    quickGen && hML(GenPicker, { onPick: (k) => { setQuickGen(false); openDerivConfig(k); }, onClose: () => setQuickGen(false) }),

    // 衍生生成配置 sheet（生成前自定义；提交后派发任务）
    cfgKey && hML(DerivConfigSheet, { derivKey: cfgKey, char,
      onClose: () => setCfgKey(null),
      onSubmit: (cfg) => { const k = cfgKey; setCfgKey(null); runDerive(k, cfg); } }));
}

function MAtlas({ char, busy, onGenerate }) {
  const shots = char.shotImages || {};
  const hasReal = Object.keys(shots).length > 0;
  const variants = char.variantImages || [];
  // 候选已生成但还没挑选定妆 → 先展示候选，引导去挑选
  if (!hasReal && !char.imageUrl && variants.length) {
    return hML('div', null,
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
        hML(Icons.sparkle, { size: 15, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
        hML('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, '已生成 ' + variants.length + ' 张候选形象 · 用下方「挑选形象」按钮 4 选 1 定妆')),
      hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        variants.map((u, i) => hML('div', { key: i, style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
          hML('img', { src: u, alt: '候选 v' + (i + 1), loading: 'lazy', decoding: 'async', style: { display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover' } }),
          hML('div', { className: 'ph-label', style: { left: 8, bottom: 8 } }, 'v' + (i + 1))))));
  }
  if (!hasReal && !char.imageUrl) {
    // 完全没有生成产物（mock 数据除外）→ 引导生成
    return hML('div', { style: { textAlign: 'center', padding: '34px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
      hML('div', { style: { width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hML(Icons.images, { size: 24 })),
      hML('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 6 } }, '还没有标准图集'),
      hML('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, busy ? '正在出图…' : '从定妆形象一键生成 5 张标准机位图'),
      busy
        ? hML('div', { style: { maxWidth: 200, margin: '0 auto' } }, hML(UI.Progress, { pct: Math.round(busy.pct || 5), showLabel: true }))
        : hML(UI.Button, { variant: 'primary', icon: Icons.sparkle, onClick: onGenerate }, '生成标准图集'));
  }
  // 只有定妆主图、还没生成多角度图集 → 展示单张定妆图 + 引导生成（不再把同一张图伪装成 5 个机位）
  if (!hasReal) {
    return hML('div', null,
      busy && hML('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
        hML(UI.Spinner, { size: 15 }),
        hML('div', { style: { flex: 1 } }, hML(UI.Progress, { pct: Math.round(busy.pct || 5), h: 5 }))),
      hML('div', { style: { maxWidth: 240, margin: '0 auto 12px', position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
        hML(Portrait, { char, variant: 'key', ratio: '3 / 4', expr: 'calm' }),
        hML('div', { className: 'ph-label', style: { left: 8, bottom: 8 } }, '定妆形象')),
      hML('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', margin: '0 0 14px', lineHeight: 1.5 } },
        '当前只有 1 张定妆形象。点下方按钮生成 5 张标准机位图（正面半身 / 全身 / 左右侧脸 / 表情集）。'),
      !busy && hML(UI.Button, { variant: 'primary', full: true, icon: Icons.sparkle, onClick: onGenerate }, '生成标准图集'));
  }
  return hML('div', null,
    busy && hML('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
      hML(UI.Spinner, { size: 15 }),
      hML('div', { style: { flex: 1 } }, hML(UI.Progress, { pct: Math.round(busy.pct || 5), h: 5 }))),
    hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      DATA.SHOTS.map((sh, i) => hML('div', { key: sh.key },
        hML('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
          hML(Portrait, { char: { ...char, shotImages: null, imageUrl: null, variantImages: null }, src: shots[sh.key] || null, variant: ['key','key','side','threeq','look'][i] || 'key', ratio: '3 / 4', expr: i === 4 ? 'smile' : 'calm' })),
        hML('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' } },
          hML('span', { style: { fontSize: 12, fontWeight: 600 } }, sh.name),
          hML('span', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)' } }, sh.spec))))),
    !busy && hML('div', { style: { marginTop: 14 } },
      hML(UI.Button, { variant: 'line', full: true, icon: Icons.refresh, onClick: onGenerate }, '重新出图')));
}

// ── 作品库 —— 该数字人「全部已生成资产」统一陈列（图集 / 表情 / 场景 / 换装 / 3D / 视频）──
//    取代旧「标准图集 + 衍生资产（类型列表）」：生成的东西沉淀在这里，不再只能去任务中心找。

/** 计算某分类的作品缩略图列表（真实产物优先；mock / 未加载时按计数出占位图）。 */
function tilesForCat(char, items, cat) {
  if (cat === 'atlas') {
    const shots = char.shotImages || {};
    const shotTiles = DATA.SHOTS.filter((x) => shots[x.key]).map((x) => ({ src: shots[x.key], label: x.name }));
    // 定妆主图常等于正面半身（front-half）—— 已在机位里就不再单列「定妆形象」，避免同图重复
    if (shotTiles.length) {
      const dup = char.imageUrl && shotTiles.some((t) => t.src === char.imageUrl);
      return [...(char.imageUrl && !dup ? [{ src: char.imageUrl, label: '定妆形象' }] : []), ...shotTiles];
    }
    if (char.imageUrl) return [{ src: char.imageUrl, label: '定妆形象' }];
    const v = char.variantImages || [];
    if (v.length) return v.map((u, i) => ({ src: u, label: '候选 v' + (i + 1) }));
    const n = (char.counts || {}).atlas || 0;
    return Array.from({ length: n }).map((_, i) => ({ src: null, label: '图集 ' + (i + 1) }));
  }
  const d = DATA.DERIVS.find((x) => x.key === cat) || ({} as any);
  const real = (items || []).filter((it) => it.key === cat);
  if (real.length) return real.map((it, i) => ({ src: it.thumbUrl || (it.kind === 'video' || cat === 'video' ? null : it.fileUrl), video: it.kind === 'video' || cat === 'video', label: it.label || (d.name + ' ' + (i + 1)) }));
  const n = (char.counts || {})[cat] || 0;
  return Array.from({ length: n }).map((_, i) => ({ src: null, video: cat === 'video', label: d.name + ' ' + (i + 1) }));
}

function AssetTile({ char, tile, idx, onClick }) {
  const variants = ['key', 'threeq', 'side', 'look', 'key', 'threeq'];
  const exprs = ['calm', 'smile', 'calm', 'serious', 'smile', 'calm'];
  return hML('button', { onClick, className: 'm-press', style: { display: 'block', padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' } },
    hML('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
      hML(Portrait, { char: { ...char, shotImages: null, imageUrl: null, variantImages: null }, src: tile.src || null, variant: variants[idx % variants.length], ratio: '3 / 4', expr: exprs[idx % exprs.length] }),
      tile.video && hML('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' } },
        hML('span', { style: { width: 32, height: 32, borderRadius: 99, background: 'rgba(20,30,40,.5)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', color: '#fff' } },
          hML('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, hML('path', { d: 'M7 5v14l12-7z' })))),
      hML('div', { className: 'ph-label', style: { left: 7, bottom: 7 } }, tile.label)));
}

/** 单个分类区块：标题 + 计数 + 生成入口 + 作品网格（含生成中进度）。 */
function DerivCatSection({ char, cat, items, running, busyPct, compact, ctx, onGenerate, onViewAll }) {
  const d = DATA.DERIVS.find((x) => x.key === cat) || DATA.DERIVS[0];
  const tiles = tilesForCat(char, items, cat);
  const count = tiles.length;
  const capped = compact && count > 6;
  const view = capped ? tiles.slice(0, 6) : tiles;
  const open = () => (cat === 'atlas' ? onViewAll() : ctx.openDeriv(char, cat));
  return hML('div', { style: { marginBottom: 20 } },
    hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 } },
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
        hML('span', { style: { width: 26, height: 26, flex: '0 0 26px', borderRadius: 8, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, hML(Icons[d.icon], { size: 15 })),
        hML('span', { style: { fontSize: 14.5, fontWeight: 700 } }, d.name),
        count > 0 && hML('span', { className: 'mono', style: { fontSize: 11.5, color: 'var(--ink-3)' } }, count + ' ' + d.unit)),
      hML('button', { onClick: () => onGenerate(cat), disabled: running, className: 'm-tap', style: { flex: '0 0 auto', background: 'none', border: 'none', cursor: running ? 'default' : 'pointer', color: running ? 'var(--ink-4)' : 'var(--primary)', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 } },
        running ? '生成中…' : (count > 0 ? '生成更多' : '生成'), !running && hML(Icons.sparkle, { size: 13, stroke: 2 }))),
    running && hML('div', { style: { marginBottom: 10 } }, hML(UI.Progress, { pct: Math.round(busyPct || 4), h: 5 })),
    count > 0
      ? hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } },
          view.map((t, i) => hML(AssetTile, { key: i, char, tile: t, idx: i, onClick: open })),
          capped && hML('button', { onClick: onViewAll, className: 'm-tap', style: { aspectRatio: '3 / 4', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-3)', background: 'var(--surface-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700 } }, '+' + (count - 6)))
      : !running && hML('div', { style: { fontSize: 12, color: 'var(--ink-4)', padding: '2px 0 4px' } }, '点右上「生成」创建' + d.name));
}

/** 生成类型选择 sheet（＋生成入口）。 */
function GenPicker({ onPick, onClose }) {
  return hML(React.Fragment, null,
    hML('div', { className: 'm-sheet-backdrop', onClick: onClose }),
    hML('div', { className: 'm-sheet', style: { padding: '0 18px calc(16px + var(--home-ind))', maxHeight: '76%', overflowY: 'auto' } },
      hML('div', { className: 'm-sheet-grip' }),
      hML('div', { style: { padding: '6px 0 12px' } },
        hML('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 18 } }, '生成资产'),
        hML('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 3 } }, '选择要生成的资产类型')),
      hML('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
        DATA.DERIVS.map((d) => hML('button', { key: d.key, onClick: () => onPick(d.key), className: 'm-tap', style: {
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 13, textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' } },
          hML('span', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, hML(Icons[d.icon], { size: 20 })),
          hML('div', { style: { flex: 1, minWidth: 0 } },
            hML('div', { style: { fontSize: 14.5, fontWeight: 700 } }, d.name),
            hML('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, d.desc)),
          hML(Icons.chevR, { size: 18, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }))))));
}

function MAssets({ char, ctx, busy, onGenerate, onOpenGenerate, nonce }) {
  const items = useApi(() => AvatarApi.derivatives(char.id), [] as any[], [char.id, nonce]);
  const [cat, setCat] = useStateML('all');

  const isRunning = (k) => !!(busy && busy[k]) || (char.deriv || {})[k] === 'running';
  const atlasCount = () => {
    const shots = char.shotImages || {};
    const s = DATA.SHOTS.filter((x) => shots[x.key]).length;
    if (s) return s;
    if (char.imageUrl) return 1;
    const v = (char.variantImages || []).length;
    if (v) return v;
    return (char.counts || {}).atlas || 0;
  };
  const catCount = (k) => k === 'atlas' ? atlasCount() : ((items.filter((it) => it.key === k).length) || (char.counts || {})[k] || 0);
  const present = DATA.DERIVS.filter((d) => catCount(d.key) > 0 || isRunning(d.key));
  const total = DATA.DERIVS.reduce((a, d) => a + catCount(d.key), 0);

  // 全空 + 无生成中 → 引导生成第一个
  if (!present.length) {
    return hML('div', null,
      hML('div', { style: { textAlign: 'center', padding: '34px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
        hML('div', { style: { width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hML(Icons.images, { size: 24 })),
        hML('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 6 } }, '还没有作品'),
        hML('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, '从定妆形象生成标准图集，或生成表情 / 场景 / 换装 / 3D / 运镜视频等衍生资产 —— 生成的内容都会沉淀在这里。'),
        hML(UI.Button, { variant: 'primary', icon: Icons.sparkle, onClick: onOpenGenerate }, '生成第一个资产')));
  }

  const shown = cat === 'all' ? present : present.filter((d) => d.key === cat);
  const chip = (key, label, on, onClick) => hML('button', { key, onClick, className: 'm-tap', style: {
    flex: '0 0 auto', height: 32, padding: '0 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
    border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line-2)'), background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)' } }, label);

  return hML('div', null,
    // 分类筛选 + ＋生成
    hML('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14 }, className: 'no-bar' },
      chip('all', '全部 ' + total, cat === 'all', () => setCat('all')),
      present.map((d) => chip(d.key, d.name + ' ' + catCount(d.key), cat === d.key, () => setCat(d.key))),
      hML('button', { key: '__gen', onClick: onOpenGenerate, className: 'm-tap', style: {
        flex: '0 0 auto', height: 32, padding: '0 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
        border: '1px dashed var(--line-3)', background: 'var(--surface)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 } },
        hML(Icons.add, { size: 14, stroke: 2.2 }), '生成')),

    // 内容：选中「图集」→ 复用富交互 MAtlas（候选挑选 / 出图）；其余 → 作品网格分区
    cat === 'atlas'
      ? hML(MAtlas, { char, busy: busy && busy['atlas'], onGenerate: () => onGenerate('atlas') })
      : shown.map((d) => hML(DerivCatSection, { key: d.key, char, cat: d.key, items, running: isRunning(d.key),
          busyPct: busy && busy[d.key] && busy[d.key].pct, compact: cat === 'all', ctx, onGenerate, onViewAll: () => setCat(d.key) })));
}

function MVersions({ char, ctx, onChanged }) {
  const KIND_ICON: any = { archive: Icons.archive, finalize: Icons.checkc, template: Icons.palette, refine: Icons.sliders, iterate: Icons.wand, init: Icons.sparkle, look: Icons.shirt, derive: Icons.layers };
  const [reloadSeq, setReloadSeq] = useStateML(0);
  const evs = useApi(() => AvatarApi.versions(char.id), [], [char.id, reloadSeq]);
  const [busy, setBusy] = useStateML(null as any);
  const [confirm, setConfirm] = useStateML(null as any);  // 待二次确认的版本切换 / 另存
  const counts: any = char.counts || {};
  const derivedCount = DATA.DERIVS.reduce((a, d) => a + (Number(counts[d.key]) || 0), 0) + (char.shotImages ? Object.keys(char.shotImages).length : 0);
  const versionNum = (v) => Number(String(v || '').replace(/^v/i, '')) || 1;
  const apply = async (e) => {
    if (e.cur || busy) return;
    const n = versionNum(e.v);
    setBusy(e.v);
    try {
      if (derivedCount > 0) {
        const fresh = await AvatarApi.forkVersion(char.id, n);
        toast('已另存为新数字人', { tone: 'ok' });
        ctx.reload && ctx.reload();
        ctx.openChar ? ctx.openChar(fresh) : onChanged && onChanged();
      } else {
        await AvatarApi.switchVersion(char.id, n);
        toast('已切换到 ' + e.v, { tone: 'ok' });
        await (onChanged && onChanged());
        setReloadSeq((s) => s + 1);   // 切换后重新拉取版本时间线，刷新「当前」标记与各行按钮
      }
    } catch (err: any) {
      toast(err?.message || '版本操作失败', { tone: 'err' });
    } finally { setBusy(null); }
  };
  if (!evs.length) return hML('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 } }, '暂无版本记录');
  const forking = !!confirm && derivedCount > 0;
  return hML(React.Fragment, null,
    confirm && hML(UI.Confirm, {
      open: true, busy: !!busy, danger: false,
      onClose: () => setConfirm(null),
      onConfirm: async () => { const e = confirm; await apply(e); setConfirm(null); },
      title: forking ? '另存为新数字人？' : '切换到 ' + confirm.v + '？',
      desc: forking
        ? '当前数字人已生成衍生作品，不能直接覆盖原形象；将以 ' + confirm.v + ' 的形象另存为一个新的数字人，原数字人保持不变。'
        : '将把当前数字人的形象切换为 ' + confirm.v + '，并在版本时间线新增一条切换记录；后续可随时切回其它版本。',
      confirmText: forking ? '另存为新数字人' : '确认切换',
    }),
    hML('div', null, evs.map((e: any, i) => hML('div', { key: i, style: { display: 'flex', gap: 12 } },
    hML('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' } },
      hML('div', { style: { width: 34, height: 34, borderRadius: 99, background: e.cur ? 'var(--primary)' : 'var(--surface)', border: '1px solid ' + (e.cur ? 'var(--primary)' : 'var(--line-2)'), display: 'grid', placeItems: 'center', color: e.cur ? '#fff' : 'var(--ink-3)' } }, hML(KIND_ICON[e.kind] || Icons.sparkle, { size: 16 })),
      i < evs.length - 1 && hML('div', { style: { width: 2, flex: 1, minHeight: 14, background: 'var(--line)', margin: '4px 0' } })),
    hML('div', { style: { flex: 1, paddingBottom: 16, display: 'flex', gap: 10 } },
      hML('div', { style: { flex: 1, minWidth: 0 } },
        hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          hML('span', { className: 'mono', style: { fontSize: 12.5, fontWeight: 700, color: e.cur ? 'var(--primary)' : 'var(--ink)' } }, e.v),
          e.cur && hML(UI.Badge, { tone: 'primary' }, '当前'),
          hML('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, e.t)),
        hML('div', { style: { fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.45 } }, e.note),
        !e.cur && hML('button', { onClick: () => setConfirm(e), disabled: !!busy, className: 'm-tap', style: {
          marginTop: 8, height: 30, padding: '0 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)',
          background: derivedCount > 0 ? 'var(--surface-3)' : 'var(--primary-soft)', color: derivedCount > 0 ? 'var(--ink-2)' : 'var(--primary)',
          fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } },
          hML(derivedCount > 0 ? Icons.copy : Icons.checkc, { size: 13, stroke: 2 }),
          busy === e.v ? '处理中…' : (derivedCount > 0 ? '另存为新数字人' : '切换到此版本'))),
      e.imageUrl && hML('div', { style: { width: 44, flex: '0 0 44px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' } },
        hML('img', { src: e.imageUrl, alt: e.v, loading: 'lazy', decoding: 'async', style: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' } })))))));
}

function MLicense({ char, ctx }) {
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const [downloading, setDownloading] = useStateML(false);
  if (char.path === 'ai' || !char.license) {
    return hML('div', null,
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: 12, background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-soft)' } },
        hML(Icons.ai, { size: 18, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
        hML('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } },
          char.path === 'ai' ? 'AI 原创虚构形象 · 版权自有，无需真人肖像授权。' : '该资产暂未绑定肖像授权；完成真人捕获核验后会自动登记。')),
      hML('div', { style: { display: 'flex', flexDirection: 'column' } },
        Object.entries(char.def || {}).map(([k, v]: any) => hML('div', { key: k, style: { padding: '11px 0', borderBottom: '1px solid var(--line)' } },
          hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
          hML('div', { style: { fontSize: 13.5, color: 'var(--ink)', fontWeight: Array.isArray(v) ? 400 : 600, lineHeight: 1.45 } }, Array.isArray(v) ? v.join(' · ') : String(v || '—'))))));
  }
  const lic = licenses.find((l: any) => l.id === char.license);
  if (!lic) return hML('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 } }, '授权信息加载中…');
  const download = async () => {
    setDownloading(true);
    try {
      const r = await LicenseApi.certificate(lic.id);
      if (r.certificateUrl) { window.open(r.certificateUrl, '_blank'); toast('凭证已打开', { tone: 'ok' }); }
      else toast('凭证生成中，请稍后再试', { tone: 'warn' });
    } catch (e: any) { toast(e?.message || '下载失败', { tone: 'err' }); }
    finally { setDownloading(false); }
  };
  return hML('div', { className: 'm-card', style: { padding: 16 } },
    hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
        hML(Icons.shield, { size: 19, style: { color: 'var(--ok)' } }),
        hML('div', null,
          hML('div', { style: { fontSize: 14, fontWeight: 700 } }, '电子肖像授权'),
          hML('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)' } }, lic.id))),
      hML(UI.Badge, { tone: lic.status === 'active' ? 'ok' : lic.status === 'pending' ? 'warn' : 'err', icon: Icons.checkc }, lic.status === 'active' ? '生效中' : lic.status === 'pending' ? '待签署' : '已过期')),
    [['肖像权人', lic.subject], ['授权范围', lic.scope], ['授权期限', lic.period], ['使用平台', (lic.platforms || []).join(' · ')], ['绑定素材', lic.photos + ' 份（加密存档）']].map(([k, v]) =>
      hML('div', { key: k, style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
        hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
        hML('div', { style: { fontSize: 13.5, fontWeight: 600 } }, v))),
    hML('div', { style: { marginTop: 14 } },
      hML(UI.Button, { variant: 'line', full: true, icon: Icons.download, disabled: downloading, onClick: download }, downloading ? '生成中…' : '下载授权凭证')));
}

export { MLibrary };
export { MDetail };
