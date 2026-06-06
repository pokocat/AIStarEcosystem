"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 创建链路 5 步全屏向导
//   素材&授权 → 形象生成 → 调整 → 出图定稿 → 衍生
// ============================================================
const hMC : any = React.createElement;
const { useState: useStateMC, useEffect: useEffectMC } = React;

function variantCharM(base, i) {
  const shift = [0, 14, -12, 26][i % 4];
  const accents = [base.palette.accent, '#FFD36B', '#7AE1FF', '#FF8AB0'];
  return { ...base, id: base.id + '-v' + i, palette: { ...base.palette, accent: accents[i % 4] }, hue: base.hue + shift };
}

// —— 顶部 stepper —— 
function MStepHeader({ char, step, idx, onClose }) {
  return hMC('div', { style: { flex: '0 0 auto', background: 'var(--surface)', borderBottom: '1px solid var(--line)' } },
    hMC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hMC('button', { className: 'nav-back m-tap', onClick: onClose }, hMC(Icons.x, { size: 22, stroke: 2.2 })),
      hMC('span', { className: 'nav-title' }, '创建数字人'),
      hMC('span', { className: 'nav-spacer' })),
    // 步骤进度
    hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 0, padding: '4px 16px 14px' } },
      DATA.CHAIN.map((s, i) => {
        const done = i < idx, cur = i === idx;
        return hMC(React.Fragment, { key: s.key },
          i > 0 && hMC('div', { style: { flex: 1, height: 2, background: done ? 'var(--ok)' : 'var(--line-2)', margin: '0 3px', borderRadius: 9 } }),
          hMC('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' } },
            hMC('div', { style: { width: 26, height: 26, borderRadius: 99, display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
              background: cur ? 'var(--primary)' : done ? 'var(--ok)' : 'var(--surface-3)',
              color: (cur || done) ? '#fff' : 'var(--ink-3)', border: (cur || done) ? 'none' : '1px solid var(--line-2)' } },
              done ? hMC(Icons.check, { size: 13, stroke: 2.6 }) : s.n),
            hMC('span', { style: { fontSize: 9.5, fontWeight: cur ? 700 : 600, color: cur ? 'var(--primary)' : 'var(--ink-3)', whiteSpace: 'nowrap' } }, s.short)));
      })));
}

// ===== 步骤 1：素材 & 授权 / 人设 =====
function MStepSource({ char, onReady }) {
  const isReal = char.path === 'real';
  const [desc, setDesc] = useStateMC(char.def['设定语'] || '');
  const [agreed, setAgreed] = useStateMC(false);
  const [style, setStyle] = useStateMC('二次元');
  useEffectMC(() => onReady(isReal ? agreed : desc.length > 4), [agreed, desc, isReal]);

  if (isReal) return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '真人素材 & 肖像授权'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, '上传多角度照片做合规检测；签署电子肖像授权后照片加密存档。'),
    char._captured && hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '12px 14px', background: 'var(--ok-s)', border: '1px solid color-mix(in oklab, var(--ok) 24%, transparent)', borderRadius: 'var(--r-md)' } },
      hMC('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center' } }, hMC(Icons.film, { size: 17 })),
      hMC('div', { style: { flex: 1, minWidth: 0 } },
        hMC('div', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, '动作素材已捕获 · 12s'),
        hMC('div', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, '1080p · 已自动抽取多角度关键帧')),
      hMC(UI.Badge, { tone: 'ok', dot: true }, '就绪')),
    hMC('div', { className: 'm-card', style: { padding: 14, marginBottom: 14 } },
      hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
        hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '真人素材'),
        hMC(UI.Badge, { tone: 'ok', icon: Icons.checkc }, '合规通过')),
      hMC('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 } },
        ['正面','左侧','右侧','俯','仰','微笑'].map((l, i) => hMC('div', { key: i, className: 'ph', style: { aspectRatio: '1', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' } },
          hMC('div', { style: { position: 'absolute', top: 4, right: 4, color: 'var(--ok)' } }, hMC(Icons.checkc, { size: 14 })),
          hMC('div', { className: 'ph-label' }, l))),
        hMC('button', { className: 'm-tap', style: { aspectRatio: '1', borderRadius: 'var(--r-sm)', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' } }, hMC(Icons.plus, { size: 20 })))),
    hMC('div', { className: 'm-card', style: { padding: 14 } },
      hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 } }, hMC(Icons.shield, { size: 17, style: { color: 'var(--primary)' } }), hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '电子肖像授权')),
      hMC(UI.Field, { label: '肖像权人', style: { marginBottom: 11 } }, hMC(UI.Input, { value: '周野（高管）', onChange: () => {} })),
      hMC('div', { style: { display: 'flex', gap: 10, marginBottom: 11 } },
        hMC(UI.Field, { label: '授权范围', style: { flex: 1 } }, hMC(UI.Select, { value: '对内/对外', onChange: () => {}, options: ['对内/对外', '仅对内', '全平台商用'] })),
        hMC(UI.Field, { label: '期限', style: { flex: 1 } }, hMC(UI.Select, { value: '2 年', onChange: () => {}, options: ['1 年', '2 年', '永久'] }))),
      hMC('label', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid var(--line)' } },
        hMC('input', { type: 'checkbox', checked: agreed, onChange: e => setAgreed(e.target.checked), style: { marginTop: 2, width: 17, height: 17, accentColor: 'var(--primary)', flex: '0 0 auto' } }),
        hMC('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '已获肖像权人书面同意，协议与原始照片绑定加密存档，符合 ', hMC('span', { style: { color: 'var(--primary)', fontWeight: 700 } }, '《数字人肖像合规规范》'), '。'))));

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '人设描述 & 风格'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, '用文字描述这个虚构数字人，系统将解析为结构化设定再生成形象。'),
    hMC('div', { className: 'm-card', style: { padding: 14, marginBottom: 14 } },
      hMC(UI.Field, { label: '设定描述', required: true, hint: '自动抽取年龄 / 气质 / 服饰 / 性格等字段' },
        hMC(UI.Textarea, { value: desc, onChange: setDesc, rows: 4, placeholder: '例：约 17 岁的星界少女，清冷神秘，银河披帛，掌管星轨观测…' }))),
    hMC('div', { className: 'm-card', style: { padding: 14 } },
      hMC('div', { style: { fontSize: 13.5, fontWeight: 700, marginBottom: 11 } }, '风格分类'),
      hMC('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        ['二次元','写实','国风','赛博','萌系','电影感'].map(t => {
          const on = style === t;
          return hMC('button', { key: t, onClick: () => setStyle(t), style: { fontSize: 13, padding: '8px 14px', background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', fontWeight: 600, cursor: 'pointer' } }, t);
        }))));
}

// ===== 步骤 2：形象生成 =====
function MStepProof({ char, onReady }) {
  const [gen, setGen] = useStateMC(false);
  const [busy, setBusy] = useStateMC(false);
  const [picked, setPicked] = useStateMC(-1);
  const variants = [0,1,2,3].map(i => variantCharM(char, i));
  useEffectMC(() => onReady(gen && picked >= 0), [gen, picked]);

  if (!gen) return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '形象生成'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, '一次生成 4 版候选形象，挑选最接近预期的一版。'),
    hMC('div', { style: { display: 'grid', placeItems: 'center', minHeight: 300, background: 'var(--surface)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-xl)', textAlign: 'center', padding: 24 } },
      hMC('div', { style: { width: 60, height: 60, borderRadius: 99, background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)', margin: '0 auto 14px' } },
        busy ? hMC(UI.Spinner, { size: 26 }) : hMC(Icons.sparkle, { size: 28 })),
      hMC('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 5 } }, busy ? '正在生成 4 版形象…' : '准备就绪'),
      hMC('div', { style: { fontSize: 13, color: 'var(--ink-2)', marginBottom: 18 } }, busy ? '预计 30 秒' : '点击下方按钮开始生成'),
      !busy && hMC(UI.Button, { variant: 'primary', size: 'lg', icon: Icons.sparkle, onClick: () => { setBusy(true); setTimeout(() => { setGen(true); setBusy(false); toast('已生成 4 版形象', { tone: 'ok' }); }, 1400); } }, '开始生成')));

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
      hMC('h2', { style: { fontSize: 21 } }, '生成结果'),
      hMC(UI.Button, { variant: 'line', size: 'sm', icon: Icons.refresh, onClick: () => toast('重新生成中…') }, '重生成')),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '挑选最接近预期的一版进入调整。'),
    hMC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      variants.map((v, i) => {
        const on = picked === i;
        return hMC('button', { key: i, onClick: () => setPicked(i), className: 'm-press', style: { padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' } },
          hMC('div', { style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent') } },
            hMC(Portrait, { char: v, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
            hMC('div', { className: 'ph-label', style: { left: 8, bottom: 8 } }, 'v' + (i + 1)),
            on && hMC('div', { style: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 99, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMC(Icons.check, { size: 15, stroke: 2.6 }))));
      })),
    picked >= 0 && hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: 12, background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-soft)' } },
      hMC(Icons.info, { size: 16, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
      hMC('span', { style: { fontSize: 12.5, color: 'var(--ink-2)' } }, '已选 ', hMC('b', null, 'v' + (picked + 1)), '，下一步进入调整。')));
}

// ===== 步骤 3：调整 =====
function MStepAdjust({ char, onReady }) {
  const [mode, setMode] = useStateMC('iterate');
  const [rounds, setRounds] = useStateMC([{ id: 1, note: '初始选稿', expr: 'calm' }]);
  const [input, setInput] = useStateMC('');
  const [active, setActive] = useStateMC(1);
  const [warp, setWarp] = useStateMC(DATA.WARP_CTRLS.map(c => ({ ...c })));
  useEffectMC(() => onReady(true), []);
  const cur = rounds.find(r => r.id === active) || rounds[0];
  const submit = () => { if (!input.trim()) return; const id = rounds.length + 1; setRounds(r => [...r, { id, note: input, expr: id % 2 ? 'smile' : 'calm' }]); setActive(id); setInput(''); toast('已生成第 ' + id + ' 轮', { tone: 'ok' }); };

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '调整形象'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 14 } }, '自然语言整体迭代，或几何精确精调，随时切换。'),
    hMC('div', { style: { display: 'flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-pill)', marginBottom: 16 } },
      [['iterate', '自然语言迭代', Icons.wand], ['refine', '精确精调', Icons.sliders]].map(([k, l, ic]: any) => {
        const on = mode === k;
        return hMC('button', { key: k, onClick: () => setMode(k), style: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, boxShadow: on ? 'var(--sh-1)' : 'none' } },
          hMC(ic, { size: 15, stroke: 1.9 }), l);
      })),

    hMC('div', { style: { borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)', marginBottom: 14 } },
      hMC(Portrait, { char: { ...char, hue: char.hue + (mode === 'iterate' ? (cur.id - 1) * 6 : warp.reduce((a, c) => a + c.val, 0) / 8) }, variant: 'key', ratio: '4 / 5', expr: mode === 'iterate' ? cur.expr : 'calm' })),

    mode === 'iterate'
      ? hMC('div', null,
          hMC('div', { style: { display: 'flex', gap: 9, marginBottom: 14 } },
            hMC(UI.Textarea, { value: input, onChange: setInput, rows: 1, placeholder: '例：发色再亮、眼神更温柔…', style: { minHeight: 46 } }),
            hMC(UI.Button, { variant: 'primary', icon: Icons.wand, onClick: submit, style: { flex: '0 0 auto', alignSelf: 'stretch' } })),
          hMC('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 9 } }, '迭代历史 · ' + rounds.length),
          hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            rounds.slice().reverse().map(r => hMC('button', { key: r.id, onClick: () => setActive(r.id), style: {
              display: 'flex', gap: 10, padding: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', width: '100%',
              background: active === r.id ? 'var(--primary-soft)' : 'var(--surface)', border: '1px solid ' + (active === r.id ? 'var(--primary)' : 'var(--line)'), borderRadius: 'var(--r-md)' } },
              hMC(Portrait, { char, variant: 'key', ratio: '1/1', radius: 8, expr: r.expr, style: { width: 38, flex: '0 0 38px' } }),
              hMC('span', { className: 'mono', style: { fontSize: 11, fontWeight: 700, color: active === r.id ? 'var(--primary)' : 'var(--ink-3)', flex: '0 0 auto' } }, 'R' + r.id),
              hMC('span', { className: 'm-clip1', style: { fontSize: 12.5, color: 'var(--ink-2)', flex: 1 } }, r.note)))))
      : hMC('div', { className: 'm-card', style: { padding: 15 } },
          hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
            hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '几何微调'),
            hMC('button', { onClick: () => setWarp(DATA.WARP_CTRLS.map(c => ({ ...c }))), style: { background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 } }, hMC(Icons.refresh, { size: 13 }), '重置')),
          hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 15 } },
            warp.map((c, i) => hMC('div', { key: c.key },
              hMC('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 7 } },
                hMC('span', { style: { fontSize: 13, fontWeight: 600 } }, c.name),
                hMC('span', { className: 'mono', style: { fontSize: 11.5, color: c.val !== 0 ? 'var(--primary)' : 'var(--ink-3)', fontWeight: 600 } }, (c.val > 0 ? '+' : '') + c.val)),
              hMC(UI.Slider, { value: c.val, min: c.min, max: c.max, onChange: v => setWarp(w => w.map((x, j) => j === i ? { ...x, val: v } : x)) }))))));
}

// ===== 步骤 4：出图定稿 =====
function MStepOutput({ char, onReady }) {
  const [tpl, setTpl] = useStateMC('t1');
  const [confirmed, setConfirmed] = useStateMC([]);
  const all = DATA.SHOTS.length;
  const allDone = confirmed.length === all;
  useEffectMC(() => onReady(allDone), [allDone]);
  const toggle = k => setConfirmed(c => c.includes(k) ? c.filter(x => x !== k) : [...c, k]);

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '出图定稿'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '选美化模板、批量出标准图集，逐张确认后定稿锁定。'),
    // 模板
    hMC('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 9 } }, '美化模板'),
    hMC('div', { className: 'm-hscroll', style: { marginBottom: 18 } },
      DATA.TEMPLATES.slice(0, 5).map(t => {
        const on = tpl === t.id;
        return hMC('button', { key: t.id, onClick: () => setTpl(t.id), className: 'm-tap', style: { flex: '0 0 116px', textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line)'), background: 'var(--surface)' } },
          hMC('div', { className: 'ph', style: { height: 64, background: `linear-gradient(135deg, hsl(${t.hue} 16% 91%), hsl(${t.hue + 18} 14% 85%))`, position: 'relative' } },
            on && hMC('div', { style: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 99, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMC(Icons.check, { size: 12, stroke: 2.6 }))),
          hMC('div', { style: { padding: '7px 9px 9px' } },
            hMC('div', { style: { fontSize: 12.5, fontWeight: 700 } }, t.name),
            hMC('div', { className: 'm-clip1', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 } }, t.sub)));
      })),
    // 图集确认
    hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 } },
      hMC('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' } }, '标准图集 · 逐张确认'),
      hMC('span', { className: 'mono', style: { fontSize: 12, fontWeight: 700, color: allDone ? 'var(--ok)' : 'var(--primary)' } }, confirmed.length + ' / ' + all)),
    hMC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 } },
      DATA.SHOTS.map((s, i) => {
        const on = confirmed.includes(s.key);
        return hMC('button', { key: s.key, onClick: () => toggle(s.key), className: 'm-press', style: { padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' } },
          hMC('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent') } },
            hMC(Portrait, { char, variant: ['key','key','side','threeq','look'][i] || 'key', ratio: '3 / 4', expr: i === 4 ? 'smile' : 'calm', dim: !on }),
            hMC('div', { style: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 99, background: on ? 'var(--primary)' : 'rgba(255,255,255,.86)', display: 'grid', placeItems: 'center', color: on ? '#fff' : 'var(--ink-3)' } }, hMC(Icons.check, { size: 14, stroke: 2.6 }))),
          hMC('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' } },
            hMC('span', { style: { fontSize: 12, fontWeight: 600 } }, s.name),
            hMC('span', { className: 'mono', style: { fontSize: 10, color: 'var(--ink-3)' } }, s.spec)));
      })),
    !allDone && hMC(UI.Button, { variant: 'line', full: true, icon: Icons.checkc, onClick: () => { setConfirmed(DATA.SHOTS.map(s => s.key)); toast('已全部确认 · 定稿锁定', { tone: 'ok' }); } }, '一键全部确认'));
}

// ===== 步骤 5：衍生 =====
function MStepDerive({ char, onReady }) {
  const [jobs, setJobs] = useStateMC({});
  useEffectMC(() => onReady(true), []);
  const run = (key) => {
    if (jobs[key] != null) return;
    setJobs(j => ({ ...j, [key]: 0 }));
    const iv = setInterval(() => setJobs(j => {
      const p = Math.min(100, (j[key] || 0) + Math.random() * 22 + 10);
      if (p >= 100) { clearInterval(iv); toast(DATA.DERIVS.find(d => d.key === key).name + ' · 完成', { tone: 'ok' }); }
      return { ...j, [key]: p };
    }), 600);
  };
  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '衍生（可选）'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '从定稿形象一键衍生图集 / 场景 / 3D / 视频，完成后保存到名录。'),
    hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
      DATA.DERIVS.map(d => {
        const pct = jobs[d.key]; const running = pct != null && pct < 100; const done = pct >= 100;
        return hMC('div', { key: d.key, className: 'm-card', style: { padding: 13, display: 'flex', alignItems: 'center', gap: 12 } },
          hMC('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: DATA.catSoft(d.cat), display: 'grid', placeItems: 'center', color: DATA.catColor(d.cat) } }, hMC(Icons[d.icon], { size: 20 })),
          hMC('div', { style: { flex: 1, minWidth: 0 } },
            hMC('div', { style: { fontSize: 14, fontWeight: 700 } }, d.name),
            running ? hMC('div', { style: { marginTop: 6 } }, hMC(UI.Progress, { pct: Math.round(pct), h: 5 }))
              : hMC('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, d.desc)),
          done ? hMC(UI.Badge, { tone: 'ok', icon: Icons.checkc }, '完成')
            : running ? hMC('span', { className: 'mono', style: { fontSize: 11, color: 'var(--primary)', fontWeight: 700 } }, Math.round(pct) + '%')
            : hMC(UI.Button, { variant: 'line', size: 'sm', icon: Icons.sparkle, onClick: () => run(d.key) }, '生成'));
      })));
}

// ===== 向导外壳 =====
function MCreate({ char, ctx }) {
  const order = DATA.CHAIN.map(s => s.key);
  const [step, setStep] = useStateMC('source');
  const [ready, setReady] = useStateMC(false);
  const idx = order.indexOf(step);
  const stepDef = DATA.CHAIN[idx];

  const goNext = () => { if (idx < order.length - 1) { setStep(order[idx + 1]); setReady(false); const b = document.getElementById('__mcbody'); if (b) b.scrollTop = 0; } };
  const goPrev = () => { if (idx > 0) { setStep(order[idx - 1]); setReady(true); const b = document.getElementById('__mcbody'); if (b) b.scrollTop = 0; } };
  const archive = () => { toast('已保存到名录 🎉', { tone: 'ok' }); ctx.finishCreate({ ...char, status: 'archived' }); };

  const props = { char, onReady: setReady };
  const body = { source: MStepSource, proof: MStepProof, adjust: MStepAdjust, output: MStepOutput, derive: MStepDerive }[step];

  return hMC('div', { className: 'm-overlay', 'data-screen-label': '创建链路' },
    hMC(MStepHeader, { char, step, idx, onClose: ctx.back }),
    hMC('div', { id: '__mcbody', className: 'm-body', key: step, style: { paddingBottom: 92 } }, hMC(body, props)),
    // 底部操作
    hMC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11 } },
      idx > 0 && hMC(UI.Button, { variant: 'line', icon: Icons.arrowL, onClick: goPrev }, '上一步'),
      idx < order.length - 1
        ? hMC(UI.Button, { variant: 'primary', full: true, size: 'lg', iconR: Icons.arrowR, disabled: !ready, onClick: goNext }, '下一步 · ' + DATA.CHAIN[idx + 1].name)
        : hMC(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.checkc, onClick: archive }, '完成创建')));
}

export { MCreate };
