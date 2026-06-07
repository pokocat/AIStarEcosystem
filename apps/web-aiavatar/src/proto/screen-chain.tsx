"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, awaitJob, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 创建链路 5 步全屏向导（live 全接 server）
//   素材&授权/人设 → 形象生成(4 候选) → 调整(迭代/精调) → 出图定稿(图集) → 衍生
// ============================================================
const hMC : any = React.createElement;
const { useState: useStateMC, useEffect: useEffectMC, useRef: useRefMC } = React;

// —— 顶部 stepper ——
function MStepHeader({ step, idx, onClose }) {
  return hMC('div', { style: { flex: '0 0 auto', background: 'var(--surface)', borderBottom: '1px solid var(--line)' } },
    hMC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hMC('button', { className: 'nav-back m-tap', onClick: onClose }, hMC(Icons.x, { size: 22, stroke: 2.2 })),
      hMC('span', { className: 'nav-title' }, '创建数字人'),
      hMC('span', { className: 'nav-spacer' })),
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
function MStepSource({ wiz, onReady }) {
  const { char } = wiz;
  const isReal = char.path === 'real';
  const [desc, setDesc] = useStateMC(wiz.form.desc || char.descPrompt || (char.def && char.def['设定语']) || '');
  const [agreed, setAgreed] = useStateMC(!!char.license);
  const [style, setStyle] = useStateMC(wiz.form.style || '写实');
  const [photoCount, setPhotoCount] = useStateMC(0);
  const inputRef = useRefMC(null as any);
  useEffectMC(() => { wiz.form.desc = desc; wiz.form.style = style; onReady(isReal ? (agreed || !!char.license) : desc.trim().length > 4); }, [agreed, desc, style, isReal]);

  const uploadPhotos = async (e) => {
    const files: File[] = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    try {
      const a = await wiz.ensureAvatar();
      const fd = new FormData();
      files.slice(0, 6).forEach((f) => fd.append('files', f));
      const r = await AvatarApi.photos(a.id, fd);
      setPhotoCount((c) => c + (r.count || files.length));
      toast('已上传 ' + (r.count || files.length) + ' 张素材', { tone: 'ok' });
    } catch (err: any) {
      toast(err?.message || '上传失败', { tone: 'err' });
    }
  };

  if (isReal) return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('input', { ref: inputRef, type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onChange: uploadPhotos }),
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '真人素材 & 肖像授权'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, '上传多角度照片做合规检测；签署电子肖像授权后照片加密存档。'),
    (char._captured || char.license) && hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '12px 14px', background: 'var(--ok-s)', border: '1px solid color-mix(in oklab, var(--ok) 24%, transparent)', borderRadius: 'var(--r-md)' } },
      hMC('div', { style: { width: 34, height: 34, flex: '0 0 34px', borderRadius: 9, background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center' } }, hMC(Icons.film, { size: 17 })),
      hMC('div', { style: { flex: 1, minWidth: 0 } },
        hMC('div', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, char._captured ? '动作素材已捕获' : '已有生效授权'),
        hMC('div', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, char.license ? '授权编号 ' + char.license : '已自动抽取多角度关键帧')),
      hMC(UI.Badge, { tone: 'ok', dot: true }, '就绪')),
    hMC('div', { className: 'm-card', style: { padding: 14, marginBottom: 14 } },
      hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
        hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '补充照片素材（可选）'),
        photoCount > 0 && hMC(UI.Badge, { tone: 'ok', icon: Icons.checkc }, photoCount + ' 张')),
      hMC('p', { style: { fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 12px' } }, '多角度照片有助于提升复刻相似度（正面 / 左右侧 / 微笑）。'),
      hMC('button', { onClick: () => inputRef.current && inputRef.current.click(), className: 'm-tap', style: { width: '100%', height: 44, borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600 } },
        hMC(Icons.plus, { size: 17 }), '添加照片')),
    hMC('div', { className: 'm-card', style: { padding: 14 } },
      hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 } }, hMC(Icons.shield, { size: 17, style: { color: 'var(--primary)' } }), hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '电子肖像授权')),
      char.license
        ? hMC('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 } }, '该数字人已绑定生效授权（', hMC('span', { className: 'mono' }, char.license), '），可在「授权登记」中查看与下载凭证。')
        : hMC('label', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid var(--line)' } },
            hMC('input', { type: 'checkbox', checked: agreed, onChange: e => setAgreed(e.target.checked), style: { marginTop: 2, width: 17, height: 17, accentColor: 'var(--primary)', flex: '0 0 auto' } }),
            hMC('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '本人已知情同意将上述素材用于生成数字分身，授权与素材绑定加密存档，符合 ', hMC('span', { style: { color: 'var(--primary)', fontWeight: 700 } }, '《数字人肖像合规规范》'), '。'))));

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '人设描述 & 风格'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, '用文字描述这个虚构数字人，系统将解析为结构化设定再生成形象。'),
    hMC('div', { className: 'm-card', style: { padding: 14, marginBottom: 14 } },
      hMC(UI.Field, { label: '设定描述', required: true, hint: '自动抽取年龄 / 气质 / 服饰 / 性格等字段' },
        hMC(UI.Textarea, { value: desc, onChange: setDesc, rows: 4, placeholder: '例：约 17 岁的星界少女，清冷神秘，银河披帛，掌管星轨观测…' }))),
    hMC('div', { className: 'm-card', style: { padding: 14 } },
      hMC('div', { style: { fontSize: 13.5, fontWeight: 700, marginBottom: 11 } }, '风格分类'),
      hMC('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        ['写实','二次元','国风','赛博','萌系','电影感'].map(t => {
          const on = style === t;
          return hMC('button', { key: t, onClick: () => setStyle(t), style: { fontSize: 13, padding: '8px 14px', background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', fontWeight: 600, cursor: 'pointer' } }, t);
        }))));
}

// ===== 步骤 2：形象生成 =====
function MStepProof({ wiz, onReady }) {
  const { char } = wiz;
  const [phase, setPhase] = useStateMC(char.variantImages && char.variantImages.length ? 'done' : 'idle'); // idle | running | done | failed
  const [job, setJob] = useStateMC(null as any);
  const [err, setErr] = useStateMC('');
  const [picked, setPicked] = useStateMC(char.imageUrl ? 0 : -1);
  const variants = (wiz.char.variantImages && wiz.char.variantImages.length ? wiz.char.variantImages : [null, null, null, null]) as any[];
  useEffectMC(() => onReady(phase === 'done' && picked >= 0), [phase, picked]);

  const run = async () => {
    setPhase('running'); setErr(''); setPicked(-1);
    try {
      const a = await wiz.ensureAvatar();
      const isReal = a.path === 'real';
      const j = await AvatarApi.generate(a.id, isReal
        ? { mode: 'upload' }
        : { mode: 'describe', form: { desc: wiz.form.desc, style: wiz.form.style } });
      setJob(j);
      await awaitJob(j.id, (jj) => setJob({ ...jj }));
      const fresh = await AvatarApi.get(a.id);
      wiz.setChar(fresh);
      // 真人复刻只出 1 张（imageUrl），把它视作唯一候选
      if (isReal && fresh.imageUrl && (!fresh.variantImages || !fresh.variantImages.length)) {
        fresh.variantImages = [fresh.imageUrl];
      }
      setPhase('done');
      toast('已生成候选形象', { tone: 'ok' });
    } catch (e: any) {
      setErr(e?.message || '生成失败'); setPhase('failed');
    }
  };

  const pick = async (i) => {
    setPicked(i);
    try {
      const a = wiz.char;
      const fresh = await AvatarApi.pick(a.id, i);
      wiz.setChar({ ...a, ...fresh });
    } catch (e: any) {
      toast(e?.message || '选择失败', { tone: 'err' });
      setPicked(-1);
    }
  };

  if (phase === 'idle' || phase === 'running' || phase === 'failed') return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '形象生成'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 } }, char.path === 'real' ? '基于授权素材高保真复刻你的数字形象。' : '一次生成 4 版候选形象，挑选最接近预期的一版。'),
    hMC('div', { style: { display: 'grid', placeItems: 'center', minHeight: 300, background: 'var(--surface)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-xl)', textAlign: 'center', padding: 24 } },
      hMC('div', null,
        hMC('div', { style: { width: 60, height: 60, borderRadius: 99, background: phase === 'failed' ? 'var(--err-s)' : 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: phase === 'failed' ? 'var(--err)' : 'var(--primary)', margin: '0 auto 14px' } },
          phase === 'running' ? hMC(UI.Spinner, { size: 26 }) : hMC(phase === 'failed' ? Icons.warn : Icons.sparkle, { size: 28 })),
        hMC('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 5 } }, phase === 'running' ? (job?.eta || '正在生成…') : phase === 'failed' ? '生成没有成功' : '准备就绪'),
        hMC('div', { style: { fontSize: 12.5, color: phase === 'failed' ? 'var(--err)' : 'var(--ink-2)', marginBottom: 18, maxWidth: 240, wordBreak: 'break-all' } },
          phase === 'running' ? '预计 30-60 秒' : phase === 'failed' ? err : '点击下方按钮开始生成'),
        phase === 'running' && job && hMC('div', { style: { width: 200, margin: '0 auto' } }, hMC(UI.Progress, { pct: Math.round(job.pct || 0), showLabel: true })),
        phase !== 'running' && hMC(UI.Button, { variant: 'primary', size: 'lg', icon: phase === 'failed' ? Icons.retry : Icons.sparkle, onClick: run }, phase === 'failed' ? '重试' : '开始生成'))));

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
      hMC('h2', { style: { fontSize: 21 } }, '生成结果'),
      hMC(UI.Button, { variant: 'line', size: 'sm', icon: Icons.refresh, onClick: run }, '重生成')),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '挑选最接近预期的一版进入调整。'),
    hMC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      variants.map((src, i) => {
        const on = picked === i;
        return hMC('button', { key: i, onClick: () => pick(i), className: 'm-press', style: { padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' } },
          hMC('div', { style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent') } },
            hMC(Portrait, { char: { ...char, shotImages: null, imageUrl: null, hue: char.hue + [0, 14, -12, 26][i % 4] }, src, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
            hMC('div', { className: 'ph-label', style: { left: 8, bottom: 8 } }, 'v' + (i + 1)),
            on && hMC('div', { style: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 99, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMC(Icons.check, { size: 15, stroke: 2.6 }))));
      })),
    picked >= 0 && hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: 12, background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-soft)' } },
      hMC(Icons.info, { size: 16, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
      hMC('span', { style: { fontSize: 12.5, color: 'var(--ink-2)' } }, '已选 ', hMC('b', null, 'v' + (picked + 1)), '，下一步进入调整。')));
}

// ===== 步骤 3：调整 =====
function MStepAdjust({ wiz, onReady }) {
  const { char } = wiz;
  const [mode, setMode] = useStateMC('iterate');
  const [rounds, setRounds] = useStateMC([] as any[]);
  const [input, setInput] = useStateMC('');
  const [busy, setBusy] = useStateMC(false);
  const [warp, setWarp] = useStateMC(DATA.WARP_CTRLS.map(c => ({ ...c })));
  useEffectMC(() => { onReady(true); AvatarApi.versions(char.id).then(setRounds).catch(() => {}); }, []);

  const refreshAfterJob = async (jobId: string, doneMsg: string) => {
    await awaitJob(jobId);
    const fresh = await AvatarApi.get(char.id);
    wiz.setChar(fresh);
    AvatarApi.versions(char.id).then(setRounds).catch(() => {});
    toast(doneMsg, { tone: 'ok' });
  };

  const submitIterate = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    const note = input.trim();
    setInput('');
    try {
      const j = await AvatarApi.iterate(char.id, note);
      toast('迭代中 · ' + note, { tone: 'ok' });
      await refreshAfterJob(j.id, '迭代完成');
    } catch (e: any) {
      toast(e?.message || '迭代失败', { tone: 'err' });
    } finally { setBusy(false); }
  };

  const applyWarp = async () => {
    if (busy) return;
    const params: any = {};
    warp.forEach((c) => { if (c.val !== 0) params[c.key] = c.val; });
    if (!Object.keys(params).length) { toast('先拖动滑杆设置精调参数', { tone: 'warn' }); return; }
    setBusy(true);
    try {
      const j = await AvatarApi.warp(char.id, params);
      toast('精调中…', { tone: 'ok' });
      await refreshAfterJob(j.id, '精调完成');
      setWarp(DATA.WARP_CTRLS.map(c => ({ ...c })));
    } catch (e: any) {
      toast(e?.message || '精调失败', { tone: 'err' });
    } finally { setBusy(false); }
  };

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '调整形象'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 14 } }, '自然语言整体迭代，或几何精确精调，随时切换。'),
    hMC('div', { style: { display: 'flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-pill)', marginBottom: 16 } },
      [['iterate', '自然语言迭代', Icons.wand], ['refine', '精确精调', Icons.sliders]].map(([k, l, ic]: any) => {
        const on = mode === k;
        return hMC('button', { key: k, onClick: () => setMode(k), style: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, boxShadow: on ? 'var(--sh-1)' : 'none' } },
          hMC(ic, { size: 15, stroke: 1.9 }), l);
      })),

    hMC('div', { style: { position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)', marginBottom: 14 } },
      hMC(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
      busy && hMC('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(2px)' } },
        hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', background: 'var(--surface)', borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-2)' } },
          hMC(UI.Spinner, { size: 16 }), hMC('span', { style: { fontSize: 13, fontWeight: 600 } }, '生成中…')))),

    mode === 'iterate'
      ? hMC('div', null,
          hMC('div', { style: { display: 'flex', gap: 9, marginBottom: 14 } },
            hMC(UI.Textarea, { value: input, onChange: setInput, rows: 1, placeholder: '例：发色再亮、眼神更温柔…', style: { minHeight: 46 } }),
            hMC(UI.Button, { variant: 'primary', icon: Icons.wand, disabled: busy || !input.trim(), onClick: submitIterate, style: { flex: '0 0 auto', alignSelf: 'stretch' } })),
          hMC('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 9 } }, '迭代历史 · ' + rounds.length),
          hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            rounds.map((r: any, i) => hMC('div', { key: r.v + i, style: {
              display: 'flex', gap: 10, padding: 10, alignItems: 'center', textAlign: 'left', width: '100%',
              background: r.cur ? 'var(--primary-soft)' : 'var(--surface)', border: '1px solid ' + (r.cur ? 'var(--primary)' : 'var(--line)'), borderRadius: 'var(--r-md)' } },
              hMC(Portrait, { char: { ...char, shotImages: null, imageUrl: null }, src: r.imageUrl, variant: 'key', ratio: '1/1', radius: 8, expr: 'calm', style: { width: 38, flex: '0 0 38px' } }),
              hMC('span', { className: 'mono', style: { fontSize: 11, fontWeight: 700, color: r.cur ? 'var(--primary)' : 'var(--ink-3)', flex: '0 0 auto' } }, r.v),
              hMC('span', { className: 'm-clip1', style: { fontSize: 12.5, color: 'var(--ink-2)', flex: 1 } }, r.note),
              hMC('span', { style: { fontSize: 10.5, color: 'var(--ink-4)', flex: '0 0 auto' } }, r.t)))))
      : hMC('div', { className: 'm-card', style: { padding: 15 } },
          hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
            hMC('span', { style: { fontSize: 14, fontWeight: 700 } }, '几何微调'),
            hMC('button', { onClick: () => setWarp(DATA.WARP_CTRLS.map(c => ({ ...c }))), style: { background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 } }, hMC(Icons.refresh, { size: 13 }), '重置')),
          hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 16 } },
            warp.map((c, i) => hMC('div', { key: c.key },
              hMC('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 7 } },
                hMC('span', { style: { fontSize: 13, fontWeight: 600 } }, c.name),
                hMC('span', { className: 'mono', style: { fontSize: 11.5, color: c.val !== 0 ? 'var(--primary)' : 'var(--ink-3)', fontWeight: 600 } }, (c.val > 0 ? '+' : '') + c.val)),
              hMC(UI.Slider, { value: c.val, min: c.min, max: c.max, onChange: v => setWarp(w => w.map((x, j) => j === i ? { ...x, val: v } : x)) })))),
          hMC(UI.Button, { variant: 'primary', full: true, icon: Icons.sliders, disabled: busy, onClick: applyWarp }, busy ? '生成中…' : '应用精调并重绘')));
}

// ===== 步骤 4：出图定稿 =====
function MStepOutput({ wiz, onReady }) {
  const { char } = wiz;
  const [tpl, setTpl] = useStateMC(char.templateId || 't1');
  const [confirmed, setConfirmed] = useStateMC([] as string[]);
  const [phase, setPhase] = useStateMC(char.shotImages && Object.keys(char.shotImages).length ? 'ready' : 'idle'); // idle | running | ready | failed
  const [job, setJob] = useStateMC(null as any);
  const [err, setErr] = useStateMC('');
  const all = DATA.SHOTS.length;
  const allDone = confirmed.length === all && phase === 'ready';
  useEffectMC(() => onReady(allDone), [allDone]);
  const toggle = k => setConfirmed(c => c.includes(k) ? c.filter(x => x !== k) : [...c, k]);

  const runAtlas = async () => {
    setPhase('running'); setErr('');
    try {
      const j = await AvatarApi.createDerivative(char.id, { type: 'atlas' });
      setJob(j);
      await awaitJob(j.id, (jj) => setJob({ ...jj }));
      const fresh = await AvatarApi.get(char.id);
      wiz.setChar(fresh);
      setPhase('ready');
      toast('标准图集已生成', { tone: 'ok' });
    } catch (e: any) {
      setErr(e?.message || '出图失败'); setPhase('failed');
    }
  };

  const shotSrc = (key) => (wiz.char.shotImages || {})[key] || null;

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '出图定稿'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '选美化模板、批量出标准图集，逐张确认后定稿锁定。'),
    hMC('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 9 } }, '美化模板'),
    hMC('div', { className: 'm-hscroll', style: { marginBottom: 18 } },
      DATA.TEMPLATES.slice(0, 5).map(t => {
        const on = tpl === t.id;
        return hMC('button', { key: t.id, onClick: () => { setTpl(t.id); wiz.form.templateId = t.id; }, className: 'm-tap', style: { flex: '0 0 116px', textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line)'), background: 'var(--surface)' } },
          hMC('div', { className: 'ph', style: { height: 64, background: `linear-gradient(135deg, hsl(${t.hue} 16% 91%), hsl(${t.hue + 18} 14% 85%))`, position: 'relative' } },
            on && hMC('div', { style: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 99, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMC(Icons.check, { size: 12, stroke: 2.6 }))),
          hMC('div', { style: { padding: '7px 9px 9px' } },
            hMC('div', { style: { fontSize: 12.5, fontWeight: 700 } }, t.name),
            hMC('div', { className: 'm-clip1', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 } }, t.sub)));
      })),

    phase !== 'ready' && hMC('div', { style: { display: 'grid', placeItems: 'center', minHeight: 220, background: 'var(--surface)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-xl)', textAlign: 'center', padding: 24, marginBottom: 14 } },
      hMC('div', null,
        hMC('div', { style: { width: 54, height: 54, borderRadius: 99, background: phase === 'failed' ? 'var(--err-s)' : 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: phase === 'failed' ? 'var(--err)' : 'var(--primary)', margin: '0 auto 12px' } },
          phase === 'running' ? hMC(UI.Spinner, { size: 24 }) : hMC(phase === 'failed' ? Icons.warn : Icons.images, { size: 25 })),
        hMC('div', { style: { fontSize: 14.5, fontWeight: 700, marginBottom: 5 } }, phase === 'running' ? (job?.eta || '出图中…') : phase === 'failed' ? '出图没有成功' : '生成标准图集'),
        hMC('div', { style: { fontSize: 12, color: phase === 'failed' ? 'var(--err)' : 'var(--ink-3)', marginBottom: 14, maxWidth: 240, wordBreak: 'break-all' } },
          phase === 'running' ? '5 张机位 · 约 1-2 分钟' : phase === 'failed' ? err : '按所选模板出 5 张标准机位图'),
        phase === 'running' && job && hMC('div', { style: { width: 190, margin: '0 auto' } }, hMC(UI.Progress, { pct: Math.round(job.pct || 0), showLabel: true })),
        phase !== 'running' && hMC(UI.Button, { variant: 'primary', icon: phase === 'failed' ? Icons.retry : Icons.sparkle, onClick: runAtlas }, phase === 'failed' ? '重试' : '开始出图'))),

    phase === 'ready' && hMC(React.Fragment, null,
      hMC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 } },
        hMC('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' } }, '标准图集 · 逐张确认'),
        hMC('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          hMC('button', { onClick: runAtlas, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 } }, hMC(Icons.refresh, { size: 13 }), '重出'),
          hMC('span', { className: 'mono', style: { fontSize: 12, fontWeight: 700, color: allDone ? 'var(--ok)' : 'var(--primary)' } }, confirmed.length + ' / ' + all))),
      hMC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 } },
        DATA.SHOTS.map((s, i) => {
          const on = confirmed.includes(s.key);
          return hMC('button', { key: s.key, onClick: () => toggle(s.key), className: 'm-press', style: { padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' } },
            hMC('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent') } },
              hMC(Portrait, { char: { ...char, shotImages: null }, src: shotSrc(s.key), variant: ['key','key','side','threeq','look'][i] || 'key', ratio: '3 / 4', expr: i === 4 ? 'smile' : 'calm', dim: !on }),
              hMC('div', { style: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 99, background: on ? 'var(--primary)' : 'rgba(255,255,255,.86)', display: 'grid', placeItems: 'center', color: on ? '#fff' : 'var(--ink-3)' } }, hMC(Icons.check, { size: 14, stroke: 2.6 }))),
            hMC('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' } },
              hMC('span', { style: { fontSize: 12, fontWeight: 600 } }, s.name),
              hMC('span', { className: 'mono', style: { fontSize: 10, color: 'var(--ink-3)' } }, s.spec)));
        })),
      !allDone && hMC(UI.Button, { variant: 'line', full: true, icon: Icons.checkc, onClick: () => { setConfirmed(DATA.SHOTS.map(s => s.key)); toast('已全部确认', { tone: 'ok' }); } }, '一键全部确认')));
}

// ===== 步骤 5：衍生 =====
function MStepDerive({ wiz, onReady }) {
  const { char } = wiz;
  const [jobs, setJobs] = useStateMC({} as any);
  useEffectMC(() => { onReady(true); }, []);

  const run = async (key) => {
    if (jobs[key] && jobs[key].status === 'running') return;
    try {
      const j = await AvatarApi.createDerivative(char.id, { type: key });
      setJobs((m) => ({ ...m, [key]: { status: 'running', pct: 3 } }));
      await awaitJob(j.id, (jj) => setJobs((m) => ({ ...m, [key]: { status: 'running', pct: jj.pct } })));
      setJobs((m) => ({ ...m, [key]: { status: 'done', pct: 100 } }));
      const fresh = await AvatarApi.get(char.id);
      wiz.setChar(fresh);
      toast((DATA.DERIVS.find(d => d.key === key) || {}).name + ' · 完成', { tone: 'ok' });
    } catch (e: any) {
      setJobs((m) => ({ ...m, [key]: { status: 'failed', pct: 0, err: e?.message } }));
      toast(e?.message || '生成失败', { tone: 'err' });
    }
  };

  return hMC('div', { className: 'm-fade', style: { padding: '18px 18px 0' } },
    hMC('h2', { style: { fontSize: 21, marginBottom: 6 } }, '衍生（可选）'),
    hMC('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 } }, '从定稿形象一键衍生图集 / 场景 / 3D / 视频，完成后保存到名录。也可以先完成创建，之后在资产详情里随时生成。'),
    hMC('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
      DATA.DERIVS.map(d => {
        const j = jobs[d.key];
        const serverDone = (char.deriv || {})[d.key] === 'done';
        const running = j && j.status === 'running';
        const done = (j && j.status === 'done') || serverDone;
        return hMC('div', { key: d.key, className: 'm-card', style: { padding: 13, display: 'flex', alignItems: 'center', gap: 12 } },
          hMC('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: DATA.catSoft(d.cat), display: 'grid', placeItems: 'center', color: DATA.catColor(d.cat) } }, hMC(Icons[d.icon], { size: 20 })),
          hMC('div', { style: { flex: 1, minWidth: 0 } },
            hMC('div', { style: { fontSize: 14, fontWeight: 700 } }, d.name),
            running ? hMC('div', { style: { marginTop: 6 } }, hMC(UI.Progress, { pct: Math.round(j.pct), h: 5 }))
              : hMC('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, d.desc)),
          done ? hMC(UI.Badge, { tone: 'ok', icon: Icons.checkc }, '完成')
            : running ? hMC('span', { className: 'mono', style: { fontSize: 11, color: 'var(--primary)', fontWeight: 700 } }, Math.round(j.pct) + '%')
            : hMC(UI.Button, { variant: 'line', size: 'sm', icon: j && j.status === 'failed' ? Icons.retry : Icons.sparkle, onClick: () => run(d.key) }, j && j.status === 'failed' ? '重试' : '生成'));
      })));
}

// ===== 向导外壳 =====
function MCreate({ char: initialChar, ctx }) {
  const order = DATA.CHAIN.map(s => s.key);
  const [char, setChar] = useStateMC(initialChar);
  const [step, setStep] = useStateMC(() => {
    // 续作：按资产状态落位到对应步骤
    const st = initialChar?.status;
    if (st === 'proofing') return 'proof';
    if (st === 'iterating' || st === 'refining') return 'adjust';
    if (st === 'pending') return 'output';
    if (st === 'finalized' || st === 'deriving') return 'derive';
    return 'source';
  });
  const [ready, setReady] = useStateMC(false);
  const [saving, setSaving] = useStateMC(false);
  const formRef = useRefMC({ desc: '', style: '写实', templateId: 't1' });
  const idx = order.indexOf(step);

  const wiz = {
    char,
    setChar,
    form: formRef.current,
    /** 确保 server 已落资产（首次进入 step2 前调用）。 */
    ensureAvatar: async () => {
      if (char && char.id && char.id !== 'DH-NEW' && !char._fresh) return char;
      const created = await AvatarApi.create({ path: (char && char.path) || 'ai' });
      setChar(created);
      return created;
    },
  };

  const goNext = async () => {
    // step1 → step2 前：把人设描述同步到 server（AI 路径）
    if (step === 'source') {
      try {
        const a = await wiz.ensureAvatar();
        if (a.path === 'ai' && formRef.current.desc) {
          await AvatarApi.describe(a.id, { desc: formRef.current.desc, style: formRef.current.style });
        }
      } catch (e: any) {
        toast(e?.message || '保存失败', { tone: 'err' });
        return;
      }
    }
    if (idx < order.length - 1) { setStep(order[idx + 1]); setReady(false); const b = document.getElementById('__mcbody'); if (b) b.scrollTop = 0; }
  };
  const goPrev = () => { if (idx > 0) { setStep(order[idx - 1]); setReady(true); const b = document.getElementById('__mcbody'); if (b) b.scrollTop = 0; } };

  const archive = async () => {
    setSaving(true);
    try {
      const done = await AvatarApi.finalize(char.id, { templateId: formRef.current.templateId, confirmedShots: DATA.SHOTS.map(s => s.key), archive: true });
      toast('已保存到名录 🎉', { tone: 'ok' });
      ctx.finishCreate({ ...char, ...done });
    } catch (e: any) {
      toast(e?.message || '保存失败', { tone: 'err' });
    } finally { setSaving(false); }
  };

  const props = { wiz, onReady: setReady };
  const body = { source: MStepSource, proof: MStepProof, adjust: MStepAdjust, output: MStepOutput, derive: MStepDerive }[step];

  return hMC('div', { className: 'm-overlay', 'data-screen-label': '创建链路' },
    hMC(MStepHeader, { step, idx, onClose: ctx.back }),
    hMC('div', { id: '__mcbody', className: 'm-body', key: step, style: { paddingBottom: 92 } }, hMC(body, props)),
    hMC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11 } },
      idx > 0 && hMC(UI.Button, { variant: 'line', icon: Icons.arrowL, onClick: goPrev }, '上一步'),
      idx < order.length - 1
        ? hMC(UI.Button, { variant: 'primary', full: true, size: 'lg', iconR: Icons.arrowR, disabled: !ready, onClick: goNext }, '下一步 · ' + DATA.CHAIN[idx + 1].name)
        : hMC(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.checkc, disabled: saving, onClick: archive }, saving ? '保存中…' : '完成创建')));
}

export { MCreate };
