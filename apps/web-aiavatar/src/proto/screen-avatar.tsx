"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, SceneApi, AvatarApi, awaitJob, useApi, seed, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 V4 · 数字人造型 — 造型档案 + 设计新造型(场景替换)
//   live：AvatarApi.looks / createLook + 任务轮询
// ============================================================
const hAV : any = React.createElement;
const { useState: useStateAV, useEffect: useEffectAV } = React;

// ============================================================
// 造型档案
// ============================================================
function MLooksGrid({ char, ctx }) {
  const voice = ctx.voiceFor(char);
  const [looks, setLooks] = useStateAV([] as any[]);
  const [fav, setFav] = useStateAV(!!char.fav);
  const load = () => AvatarApi.looks(char.id).then(setLooks).catch(() => {});
  useEffectAV(() => { load(); }, []);
  // 有生成中的造型 → 轮询刷新
  useEffectAV(() => {
    if (!looks.some((l: any) => l.status === 'running')) return;
    const iv = setInterval(load, USE_MOCK ? 1500 : 2500);
    return () => clearInterval(iv);
  }, [looks]);

  const toggleFav = async () => {
    const next = !fav;
    setFav(next);
    try { await AvatarApi.patch(char.id, { fav: next }); ctx.reload && ctx.reload(); toast(next ? '已加入收藏' : '已取消收藏', { tone: 'ok' }); }
    catch (e: any) { setFav(!next); toast(e?.message || '操作失败', { tone: 'err' }); }
  };

  const total = looks.length + 1; // 定妆主图算 1 个造型

  return hAV('div', { className: 'm-overlay', 'data-screen-label': '造型档案' },
    hAV('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAV('button', { className: 'nav-back m-tap', onClick: ctx.back }, hAV(Icons.chevL, { size: 24, stroke: 2.2 })),
      hAV('span', { className: 'nav-title' }),
      hAV('span', { className: 'nav-spacer' })),
    hAV('div', { className: 'm-body', style: { padding: '0 18px 28px' } },
      hAV('div', { style: { display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 } },
        hAV('div', { style: { width: 56, height: 56, flex: '0 0 56px', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--line)' } },
          hAV(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
        hAV('div', { style: { flex: 1, minWidth: 0 } },
          hAV('div', { className: 'asset-name', style: { fontSize: 20 } }, char.name),
          hAV('button', { onClick: () => ctx.chooseVoice(char), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 5, height: 30, padding: '0 6px 0 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer' } },
            hAV(Icons.play, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }),
            hAV('span', { style: { fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' } }, voice),
            hAV(Icons.chevD, { size: 14, stroke: 2, style: { color: 'var(--ink-3)' } }))),
        hAV('button', { className: 'm-tap', onClick: toggleFav, style: { width: 36, height: 36, flex: '0 0 36px', borderRadius: 99, border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: fav ? 'var(--err)' : 'var(--ink-3)' } }, hAV(Icons.heart, { size: 17, stroke: 2 }))),

      hAV('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', margin: '0 2px 12px' } }, total + ' 个造型'),
      hAV('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        // 操作格
        hAV('button', { onClick: () => ctx.designLooks(char), className: 'm-tap', style: { minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' } },
          hAV('span', { style: { width: 40, height: 40, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAV(Icons.wand, { size: 19, stroke: 1.9 })),
          hAV('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, 'AI 设计新造型')),
        // 定妆主图
        hAV('button', { onClick: () => ctx.openDeriv(char, 'scene'), className: 'm-press', style: { position: 'relative', padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
          hAV(Portrait, { char, variant: 'key', ratio: '3 / 4', expr: 'calm' }),
          hAV('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,26,.6), transparent 50%)' } }),
          hAV('div', { style: { position: 'absolute', left: 12, bottom: 11, fontSize: 13.5, fontWeight: 700, color: '#fff' } }, '定妆 · ' + char.name)),
        // 造型卡
        looks.map((l: any) => l.status === 'done' && l.imageUrl
          ? hAV('div', { key: l.id, style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
              hAV('img', { src: l.imageUrl, alt: l.label, loading: 'lazy', decoding: 'async', style: { display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover' } }),
              hAV('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,26,.6), transparent 50%)' } }),
              hAV('div', { style: { position: 'absolute', left: 12, bottom: 11, fontSize: 13, fontWeight: 700, color: '#fff' } }, l.label || '新造型'))
          : l.status === 'failed'
          ? hAV('div', { key: l.id, style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', aspectRatio: '3 / 4', background: 'var(--err-s)', display: 'grid', placeItems: 'center' } },
              hAV('div', { style: { textAlign: 'center', color: 'var(--err)' } },
                hAV(Icons.warn, { size: 22 }),
                hAV('div', { style: { fontSize: 11.5, fontWeight: 600, marginTop: 6 } }, '生成失败')))
          : hAV('div', { key: l.id, style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', aspectRatio: '3 / 4',
              background: 'linear-gradient(150deg,#DDEAF7,#E9E2F6 50%,#F6E2EE)', display: 'grid', placeItems: 'center' } },
              hAV(UI.Spinner, { size: 22 }),
              hAV('span', { style: { position: 'absolute', bottom: 11, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 } }, (l.label || '新造型') + ' · 生成中…'))))));
}

// ============================================================
// 设计新造型（描述 / 场景替换 → createLook → 轮询）
// ============================================================
function MDesignLooks({ char, ctx }) {
  const [desc, setDesc] = useStateAV('');
  const [sel, setSel] = useStateAV(null as any);
  const [q, setQ] = useStateAV('');
  const [busy, setBusy] = useStateAV(false);
  const SCENES = useApi(() => SceneApi.list(), seed.scenes());

  const submit = async (payload: { prompt?: string; sceneId?: string }, label: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await AvatarApi.createLook(char.id, payload);
      toast(label + ' · 生成中，完成后出现在造型档案', { tone: 'ok' });
      ctx.back(); // 回造型档案看进度
    } catch (e: any) {
      toast(e?.message || '提交失败', { tone: 'err' });
    } finally { setBusy(false); }
  };

  return hAV('div', { className: 'm-overlay', 'data-screen-label': '设计造型' },
    hAV('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAV('button', { className: 'nav-back m-tap', onClick: ctx.back }, hAV(Icons.x, { size: 22, stroke: 2.2 })),
      hAV('span', { className: 'nav-title' }),
      hAV('span', { className: 'nav-spacer' })),
    hAV('div', { className: 'm-body', style: { padding: '0 18px 24px' } },
      hAV('div', { style: { textAlign: 'center', marginBottom: 18 } },
        hAV('h1', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 12px' } }, '为它设计新造型'),
        hAV('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 9, height: 40, padding: '0 16px 0 6px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)' } },
          hAV('span', { style: { width: 28, height: 28, borderRadius: 99, overflow: 'hidden' } }, hAV(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
          hAV('span', { style: { fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' } }, char.name))),

      // 描述编辑卡
      hAV('div', { style: { border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-1)', marginBottom: 26 } },
        hAV('div', { style: { display: 'flex', gap: 13, padding: 15 } },
          hAV('div', { style: { width: 84, height: 112, flex: '0 0 84px', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--line)' } },
            hAV(Portrait, { char, variant: 'key', ratio: '', expr: 'calm', style: { width: '100%', height: '100%' } })),
          hAV('div', { style: { flex: 1, minWidth: 0 } },
            hAV('div', { style: { fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: 7 } }, '描述你想怎样修改这个造型'),
            hAV('textarea', { value: desc, onChange: e => setDesc(e.target.value), rows: 3, placeholder: '例：换成商务西装，背景改为新闻演播室…', style: { width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'none', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', lineHeight: 1.5 } }))),
        hAV('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--line)' } },
          hAV('span', { style: { fontSize: 11, color: 'var(--ink-4)', marginRight: 'auto' } }, '保持同一张脸 · 仅换装与场景'),
          hAV('button', { disabled: busy, onClick: () => desc.trim() ? submit({ prompt: desc.trim() }, '新造型') : toast('先描述一下想要的造型', { tone: 'warn' }), style: { width: 38, height: 38, borderRadius: 99, border: 'none', cursor: desc.trim() && !busy ? 'pointer' : 'default', background: desc.trim() && !busy ? 'var(--primary)' : 'var(--surface-3)', color: desc.trim() && !busy ? '#fff' : 'var(--ink-4)', display: 'grid', placeItems: 'center' } },
            busy ? hAV(UI.Spinner, { size: 16, c: '#fff' }) : hAV(Icons.chevU, { size: 18, stroke: 2.2 })))),

      // 或选择场景替换
      hAV('div', { style: { fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', margin: '0 2px 13px' } }, '或选择一个场景替换'),
      hAV('div', { style: { position: 'relative', marginBottom: 14 } },
        hAV(Icons.search, { size: 16, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
        hAV('input', { value: q, onChange: e => setQ(e.target.value), placeholder: '搜索场景…', style: { width: '100%', height: 44, padding: '0 14px 0 38px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none' } })),
      hAV('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: sel ? 76 : 0 } },
        SCENES.filter((s: any) => !q || s.name.includes(q)).map((s: any) => {
          const on = sel === s.id;
          return hAV('button', { key: s.id, onClick: () => setSel(on ? null : s.id), className: 'm-press', style: { position: 'relative', padding: 0, cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent'), boxShadow: on ? 'var(--ring)' : 'var(--sh-1)' } },
            hAV(Portrait, { char: { ...char, shotImages: null, imageUrl: null, hue: (char.hue || 220) + (s.id.charCodeAt(1) * 17) % 120 }, variant: s.variant, ratio: '1 / 1', expr: s.expr }),
            hAV('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px 10px 8px', background: 'linear-gradient(transparent, rgba(10,18,26,.62))' } },
              hAV('span', { style: { fontSize: 12, fontWeight: 700, color: '#fff' } }, s.name)),
            on && hAV('div', { style: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 99, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hAV(Icons.check, { size: 14, stroke: 2.6 })));
        }))),
    sel && hAV('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)' } },
      hAV(UI.Button, { variant: 'primary', full: true, size: 'lg', iconR: Icons.arrowR, disabled: busy, onClick: () => {
        const s: any = SCENES.find((x: any) => x.id === sel);
        submit({ sceneId: sel }, (s ? s.name : '场景') + ' 造型');
      } }, busy ? '提交中…' : '套用此场景生成')));
}

export { MLooksGrid };
export { MDesignLooks };
