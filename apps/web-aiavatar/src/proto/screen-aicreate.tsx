"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, VoiceApi, useApi, seed } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 V4 · AI 虚拟形象创建（全屏切屏）
//   选择方式(上传照片/AI设计) ──▶ 上传照片 ─▶ 生成中 ─▶ 就绪+命名
//                          └▶ 描述表单(选择外观示例) ─▶ 生成中 ─▶ 挑选形象
//   布局参考截图：上传照片/AI设计 · 上传你的虚拟形象照片 · 选择外观 · 已就绪
// ============================================================
const hAC : any = React.createElement;
const { useState: useStateAC, useEffect: useEffectAC } = React;

const SAMPLE = '一位 22 岁的东方女性，皮肤通透，坐在化妆台前，环形灯柔和地照亮她的脸。她略微靠近手机镜头，身后是整齐的化妆品架与暖色串灯，营造出温馨而专业的氛围。';

// 「选择外观」范例人物
const EXAMPLES = [
  { id: 'e1', name: '播客主播', hue: 258, variant: 'key', expr: 'smile', desc: '一位戴着监听耳机的青年男性播客主播，坐在摆满麦克风的桌前，身后是霓虹蓝紫的录音棚灯光，笔记本电脑微微反光，氛围专业而放松。' },
  { id: 'e2', name: '美妆博主', hue: 28, variant: 'threeq', expr: 'smile', desc: '一位皮肤通透的女性美妆博主，单手托腮坐在化妆台前，环形灯柔和照亮她的脸，身后是整齐的化妆品架与暖色串灯，温馨而专业。' },
  { id: 'e3', name: '街头潮流', hue: 8, variant: 'look', expr: 'calm', desc: '一位金发女性坐在城市街头的台阶上，身穿做旧夹克与破洞牛仔裤、白色球鞋，身后是涂鸦墙与往来人群，潮流而自信。' },
  { id: 'e4', name: '烘焙厨房', hue: 178, variant: 'key', expr: 'smile', desc: '一位系着围裙的女性站在温暖的厨房里，面前的木桌上摆着刚做好的蛋糕与餐具，身后是整齐的调料架，亲切而专业。' },
  { id: 'e5', name: '健身教练', hue: 318, variant: 'side', expr: 'serious', desc: '一位身材健美的女性健身教练，站在洒满自然光的训练室中，身穿亮色运动背心，神情专注而充满活力。' },
  { id: 'e6', name: '居家生活', hue: 200, variant: 'threeq', expr: 'calm', desc: '一位青年男性站在明亮的家居厨房中，身后是开放式置物架与餐具，自然光从窗外洒入，温暖而生活化。' },
];

// 分段控件（截图式：浅底胶囊，选中白底）
function SegRow({ options, value, onChange }) {
  return hAC('div', { style: { display: 'flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-md)', gap: 2 } },
    options.map(o => {
      const on = value === o;
      return hAC('button', { key: o, onClick: () => onChange(o), style: {
        flex: 1, height: 38, border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
        background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
        fontSize: 13.5, fontWeight: on ? 700 : 600, boxShadow: on ? 'var(--sh-1)' : 'none', transition: 'all .14s' } }, o);
    }));
}

// ============================================================
// 步骤 0 · 选择创建方式（上传照片 / 使用 AI 设计）
// ============================================================
function AIChoosePath({ onPick, onClose }) {
  const opt = (key, icon, label) => hAC('button', { onClick: () => onPick(key), className: 'm-press', style: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, width: '100%', height: 60,
    borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--ink)', color: '#fff',
    fontSize: 17, fontWeight: 700, boxShadow: '0 10px 24px -6px rgba(20,36,55,.4)' } },
    hAC(icon, { size: 22, stroke: 2 }), label);
  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } },
    // 彩色柔光背景（数字人拼贴意象）
    hAC('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#EAF0FF,#F1E8FB 46%,#FCE6F1)' } }),
    hAC('div', { style: { position: 'absolute', top: '-12%', left: '-14%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(123,150,255,.5), transparent 70%)', filter: 'blur(14px)' } }),
    hAC('div', { style: { position: 'absolute', bottom: '4%', right: '-16%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(232,120,200,.42), transparent 70%)', filter: 'blur(16px)' } }),
    hAC('div', { style: { position: 'absolute', top: '32%', right: '6%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(110,210,255,.4), transparent 70%)', filter: 'blur(14px)' } }),
    // 顶部 X
    hAC('div', { className: 'wx-nav', style: { position: 'relative', zIndex: 2, paddingLeft: 8 } },
      hAC('button', { className: 'nav-back m-tap', onClick: onClose, style: { color: 'var(--ink)' } }, hAC(Icons.x, { size: 22, stroke: 2.2 })),
      hAC('span', { className: 'nav-title' }), hAC('span', { className: 'nav-spacer' })),
    // 文案
    hAC('div', { style: { position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 26px' } },
      hAC('div', { className: 'm-fade', style: { textAlign: 'center', marginBottom: 'auto', marginTop: '18%' } },
        hAC('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', background: 'rgba(255,255,255,.66)', backdropFilter: 'blur(8px)', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 16, whiteSpace: 'nowrap' } },
          hAC(Icons.sparkle, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }), 'AI 原创虚拟形象'),
        hAC('h1', { style: { fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.18, margin: 0, color: 'var(--ink)' } }, '创建你的', hAC('br', null), 'AI 数字人形象'),
        hAC('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '12px auto 0', maxWidth: 280 } }, '上传本人生活照复刻真实长相，或用文字描述从零原创一个虚构形象。')),
      hAC('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 'calc(30px + var(--home-ind))' } },
        opt('upload', Icons.upload, '上传照片'),
        opt('ai', Icons.wand, '使用 AI 设计'))));
}

// ============================================================
// 上传照片（参考截图：上传你的虚拟形象照片 + 照片要求）
// ============================================================
function PhotoThumb({ char, variant, expr, ok }) {
  return hAC('div', { style: { position: 'relative', flex: 1, aspectRatio: '3 / 4', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
    hAC(Portrait, { char, variant, expr, ratio: '', style: { width: '100%', height: '100%', filter: ok ? 'none' : 'grayscale(.5) brightness(.92)' } }),
    hAC('span', { style: { position: 'absolute', right: 4, bottom: 4, width: 17, height: 17, borderRadius: 99, display: 'grid', placeItems: 'center',
      background: ok ? 'var(--ok)' : 'var(--err)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' } },
      hAC(ok ? Icons.check : Icons.x, { size: 11, stroke: 3 })));
}

function AIUpload({ char, onUploaded, onClose }) {
  const [picked, setPicked] = useStateAC(false);
  const goods = [
    { v: 'key', e: 'serious' }, { v: 'threeq', e: 'calm' }, { v: 'side', e: 'calm' }, { v: 'look', e: 'smile' }, { v: 'key', e: 'smile' },
  ];
  const bads = [
    { v: 'side', e: 'serious' }, { v: 'key', e: 'calm' }, { v: 'look', e: 'serious' }, { v: 'threeq', e: 'serious' }, { v: 'side', e: 'smile' },
  ];
  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('span', { className: 'nav-spacer' }),
      hAC('span', { className: 'nav-title' }, '上传照片'),
      hAC('button', { className: 'nav-back m-tap', onClick: onClose, style: { marginLeft: 'auto' } }, hAC(Icons.x, { size: 22, stroke: 2.2 }))),
    hAC('div', { className: 'm-body', style: { padding: '0 18px 96px' } },
      hAC('div', { style: { textAlign: 'center', marginBottom: 18 } },
        hAC('h1', { style: { fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 6px' } }, '上传你的虚拟形象照片'),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 } }, '上传照片以为你的虚拟形象创建多种造型')),

      // 拖拽上传区
      hAC('div', { style: { border: '2px dashed ' + (picked ? 'var(--primary)' : 'var(--primary-soft)'), borderRadius: 'var(--r-xl)', background: 'var(--primary-tint)', padding: '28px 20px', textAlign: 'center', marginBottom: 22 } },
        picked
          ? hAC('div', { className: 'm-fade' },
              hAC('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 } },
                goods.slice(0, 3).map((g, i) => hAC('div', { key: i, style: { width: 56, height: 72 } }, hAC(PhotoThumb, { char, variant: g.v, expr: g.e, ok: true })))),
              hAC('div', { style: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, '已选择 3 张照片'),
              hAC('button', { onClick: () => setPicked(false), style: { marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' } }, '重新选择'))
          : hAC('div', null,
              hAC('div', { style: { width: 60, height: 60, margin: '0 auto 16px', borderRadius: 16, background: 'var(--surface)', border: '1.5px dashed var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAC(Icons.upload, { size: 26, stroke: 1.8 })),
              hAC('div', { style: { fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 } }, '拖拽照片以上传'),
              hAC('div', { style: { fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 16 } }, '上传 PNG、JPG、HEIC 或 WebP 文件，大小不超过 200MB'),
              hAC('button', { onClick: () => setPicked(true), className: 'm-tap', style: { height: 38, padding: '0 20px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, '选择照片'))),

      // 照片要求
      hAC('div', { style: { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: '18px 16px' } },
        hAC('div', { style: { fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 16 } }, '照片要求'),
        // 优质
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          hAC('span', { style: { width: 22, height: 22, borderRadius: 99, background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' } }, hAC(Icons.check, { size: 13, stroke: 3 })),
          hAC('span', { style: { fontSize: 14.5, fontWeight: 700 } }, '优质照片')),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 12px' } }, '近期的个人照片（仅限本人），包含近景和全身照，涵盖不同角度、表情（微笑、中性、严肃）和多样服装。确保为高分辨率，并与当前外貌一致。'),
        hAC('div', { style: { display: 'flex', gap: 7, marginBottom: 20 } },
          goods.map((g, i) => hAC(PhotoThumb, { key: i, char, variant: g.v, expr: g.e, ok: true }))),
        // 不合格
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          hAC('span', { style: { width: 22, height: 22, borderRadius: 99, background: 'var(--err)', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' } }, hAC(Icons.x, { size: 13, stroke: 3 })),
          hAC('span', { style: { fontSize: 14.5, fontWeight: 700 } }, '不合格照片')),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 12px' } }, '不要上传合照、帽子、太阳镜、宠物、重度滤镜、低分辨率图片或截图。避免过旧、过度编辑或与当前外貌不符的照片。'),
        hAC('div', { style: { display: 'flex', gap: 7 } },
          bads.map((g, i) => hAC(PhotoThumb, { key: i, char, variant: g.v, expr: g.e, ok: false }))))),

    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', onClick: onClose }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', disabled: !picked, icon: Icons.upload, onClick: onUploaded }, '上传')));
}

// ============================================================
// 「选择外观」示例选择器（覆盖在表单上的 sheet）
// ============================================================
function ExamplePicker({ char, onPick, onClose }) {
  return hAC('div', { style: { position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: 'var(--canvas)', animation: 'mSlideIn .26s cubic-bezier(.22,1,.36,1) both' } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 12, gap: 8 } },
      hAC('button', { className: 'm-tap', onClick: onClose, style: { display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 14px 0 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink)' } },
        hAC(Icons.chevL, { size: 18, stroke: 2.2 }), '返回'),
      hAC('span', { className: 'nav-title', style: { textAlign: 'left', flex: 1, paddingLeft: 4 } }, '选择外观'),
      hAC('button', { className: 'nav-back m-tap', onClick: onClose }, hAC(Icons.x, { size: 22, stroke: 2.2 }))),
    hAC('div', { className: 'm-body', style: { padding: '4px 18px 24px' } },
      hAC('div', { className: 'm-stagger', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } },
        EXAMPLES.map(ex => hAC('button', { key: ex.id, onClick: () => onPick(ex), className: 'm-press', style: { position: 'relative', padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
          hAC(Portrait, { char: { ...char, hue: ex.hue }, variant: ex.variant, ratio: '4 / 5', expr: ex.expr }),
          hAC('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,26,.5), transparent 46%)' } }),
          hAC('div', { style: { position: 'absolute', left: 11, bottom: 10, right: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
            hAC('span', { style: { fontSize: 13.5, fontWeight: 700, color: '#fff' } }, ex.name),
            hAC('span', { style: { width: 24, height: 24, borderRadius: 99, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hAC(Icons.arrowR, { size: 13, stroke: 2.4 }))))))));
}

// —— 描述表单 ——
function AIForm({ onGenerate, onClose, char }) {
  const [name, setName] = useStateAC('柔光妆造');
  const [age, setAge] = useStateAC('未指定');
  const [gender, setGender] = useStateAC('未指定');
  const [ethnic, setEthnic] = useStateAC('未指定');
  const [desc, setDesc] = useStateAC('');
  const [orient, setOrient] = useStateAC('竖屏');
  const [pose, setPose] = useStateAC('半身');
  const [style, setStyle] = useStateAC('未指定');
  const [examples, setExamples] = useStateAC(false);

  const applyExample = (ex) => { setDesc(ex.desc); setName(ex.name); setExamples(false); toast('已套用「' + ex.name + '」示例', { tone: 'ok' }); };

  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('button', { className: 'nav-back m-tap', onClick: onClose }, hAC(Icons.chevL, { size: 24, stroke: 2.2 })),
      hAC('span', { className: 'nav-title' }, '描述形象'),
      hAC('span', { className: 'nav-spacer' })),
    hAC('div', { className: 'm-body', style: { padding: '4px 18px 100px' } },
      hAC('h1', { style: { fontSize: 23, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 16px' } }, '描述你的数字人形象'),
      // 选择示例横幅 → 打开「选择外观」
      hAC('button', { onClick: () => setExamples(true), className: 'm-tap', style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '12px 14px', marginBottom: 22,
        background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left' } },
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 } },
          hAC('span', { style: { width: 36, height: 36, flex: '0 0 36px', borderRadius: 10, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAC(Icons.images, { size: 18, stroke: 1.8 })),
          hAC('div', { style: { minWidth: 0 } },
            hAC('div', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, '选择一个示例'),
            hAC('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, '从范例形象快速套用描述'))),
        hAC('span', { style: { flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', background: 'var(--ink)', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center' } }, '试试')),

      // 基础信息
      hAC('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 12 } }, '基础信息'),
      hAC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 } },
        hAC(UI.Field, { label: '名称', required: true }, hAC(UI.Input, { value: name, onChange: setName })),
        hAC(UI.Field, { label: '年龄', required: true }, hAC(UI.Select, { value: age, onChange: setAge, options: ['未指定', '青年', '中年', '年长'] })),
        hAC(UI.Field, { label: '性别', required: true }, hAC(UI.Select, { value: gender, onChange: setGender, options: ['未指定', '女', '男', '中性'] })),
        hAC(UI.Field, { label: '族裔' }, hAC(UI.Select, { value: ethnic, onChange: setEthnic, options: ['未指定', '东亚', '欧美', '南亚', '非洲', '拉美'] }))),

      // 外观
      hAC('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 12 } }, '外观'),
      hAC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
        hAC('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' } }, '描述你的形象'),
        hAC('button', { onClick: () => setExamples(true), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)' } }, '选择外观')),
      hAC(UI.Textarea, { value: desc, onChange: setDesc, rows: 4, placeholder: '描述外貌、气质、服饰、场景与光线…', style: { marginBottom: 22 } }),

      hAC(UI.Field, { label: '朝向', style: { marginBottom: 18 } }, hAC(SegRow, { options: ['横屏', '竖屏', '方形'], value: orient, onChange: setOrient })),
      hAC(UI.Field, { label: '姿态', style: { marginBottom: 18 } }, hAC(SegRow, { options: ['全身', '半身', '脸部'], value: pose, onChange: setPose })),
      hAC(UI.Field, { label: '风格' }, hAC(UI.Select, { value: style, onChange: setStyle, options: ['未指定', '写实', '二次元', '国风', '电影感', '赛博'] }))),

    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', onClick: onClose }, '上一步'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', iconR: Icons.sparkle, onClick: () => onGenerate({ name, desc, orient, pose }) }, '生成预览')),

    examples && hAC(ExamplePicker, { char, onPick: applyExample, onClose: () => setExamples(false) }));
}

// —— 生成中 ——
function AIGenerating({ onDone, label }) {
  useEffectAC(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return hAC('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } }, hAC('span', { className: 'nav-spacer' }), hAC('span', { className: 'nav-title' }), hAC('span', { className: 'nav-spacer' })),
    hAC('div', { className: 'm-body', style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
      hAC('div', { className: 'm-fade' },
        hAC('div', { style: { width: 80, height: 80, margin: '0 auto 24px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hAC('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, border: '3px solid var(--primary-soft)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' } }),
          hAC(Icons.sparkle, { size: 30, style: { color: 'var(--primary)' } })),
        hAC('h2', { style: { fontSize: 21, fontWeight: 800, marginBottom: 8 } }, label || '正在生成你的形象…'),
        hAC('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 } }, '约需 15–30 秒，请勿离开本页面。'))));
}

// —— 推荐音色（保存形象前，系统按形象推荐一个内置 AI 音色，可试听 / 更换）——
function RecVoice({ value, onChange }) {
  const VOICES = useApi(() => VoiceApi.builtin(), seed.builtinVoices());
  const [open, setOpen] = useStateAC(false);
  const [playing, setPlaying] = useStateAC(false);
  const cur = VOICES.find(v => v.name === value) || VOICES[0];
  if (!cur) return null;
  return hAC('div', { style: { textAlign: 'left', marginTop: 18 } },
    hAC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 } },
      hAC('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' } }, '推荐音色'),
      hAC('button', { onClick: () => setOpen(o => !o), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3 } },
        open ? '收起' : '更换', hAC(Icons.chevD, { size: 14, stroke: 2, style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' } }))),
    // 当前推荐
    hAC('div', { style: { padding: '13px 14px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-lg)' } },
      hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        hAC('button', { onClick: () => setPlaying(p => !p), style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 99, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: playing ? 'var(--primary)' : 'var(--surface)', color: playing ? '#fff' : 'var(--primary)', boxShadow: 'var(--sh-1)' } }, hAC(playing ? Icons.bolt : Icons.play, { size: 16 })),
        hAC('div', { style: { flex: 1, minWidth: 0 } },
          hAC('div', { style: { fontSize: 14.5, fontWeight: 700 } }, cur.name),
          hAC('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, cur.traits)),
        hAC('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', background: 'var(--surface)', padding: '4px 10px', borderRadius: 'var(--r-pill)', flex: '0 0 auto' } }, '推荐')),
      hAC('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 } },
        cur.scenes.slice(0, 4).map(s => hAC('span', { key: s, style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)', padding: '3px 9px', borderRadius: 'var(--r-pill)' } }, s)))),
    // 可选列表（全部内置音色）
    open && hAC('div', { className: 'm-fade', style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 } },
      VOICES.filter(v => v.id !== cur.id).map(v => hAC('button', { key: v.id, onClick: () => { onChange(v.name); setOpen(false); }, className: 'm-tap', style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'left' } },
        hAC('span', { style: { width: 32, height: 32, flex: '0 0 32px', borderRadius: 99, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' } }, hAC(v.gender === 'female' ? Icons.user : Icons.user, { size: 15, stroke: 1.9 })),
        hAC('div', { style: { flex: 1, minWidth: 0 } },
          hAC('div', { style: { fontSize: 14, fontWeight: 700 } }, v.name),
          hAC('div', { className: 'm-clip1', style: { fontSize: 11, color: 'var(--ink-3)', marginTop: 1 } }, v.traits)),
        hAC('span', { style: { fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 'var(--r-pill)', flex: '0 0 auto' } }, v.gender === 'female' ? '女声' : '男声')))));
}

// —— 挑选形象（四宫格，AI 设计路径）——
function AIPick({ char, onSave, onRegen, onEdit, onClose }) {
  const [sel, setSel] = useStateAC(0);
  const [voice, setVoice] = useStateAC((seed.builtinVoices()[0] || {}).name);
  const variants = ['key', 'threeq', 'side', 'look'];
  const hues = [0, 18, -16, 30];
  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('button', { className: 'nav-back m-tap', onClick: onEdit }, hAC(Icons.chevL, { size: 24, stroke: 2.2 })),
      hAC('span', { className: 'nav-title' }, '挑选形象'),
      hAC('button', { className: 'nav-back m-tap', onClick: onClose }, hAC(Icons.x, { size: 22, stroke: 2.2 }))),
    hAC('div', { className: 'm-body', style: { padding: '4px 18px 96px' } },
      hAC('h1', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 16px' } }, '挑一张作为你的形象'),
      hAC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        variants.map((v, i) => {
          const on = sel === i;
          return hAC('button', { key: i, onClick: () => setSel(i), className: 'm-press', style: { position: 'relative', padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)', outline: on ? '2px solid var(--primary)' : 'none', outlineOffset: -2 } },
            hAC(Portrait, { char: { ...char, hue: (char.hue || 210) + hues[i] }, variant: v, ratio: '3 / 4', expr: i % 2 ? 'smile' : 'calm' }),
            hAC('span', { style: { position: 'absolute', top: 9, left: 9, width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (on ? 'var(--primary)' : 'rgba(255,255,255,.9)'), background: on ? 'var(--primary)' : 'rgba(255,255,255,.4)', display: 'grid', placeItems: 'center' } },
              on && hAC(Icons.check, { size: 13, stroke: 3, style: { color: '#fff' } })));
        })),
      hAC(RecVoice, { value: voice, onChange: setVoice }),
      hAC('div', { style: { display: 'flex', gap: 11, marginTop: 18 } },
        hAC(UI.Button, { variant: 'line', full: true, icon: Icons.refresh, onClick: onRegen }, '重新生成'),
        hAC(UI.Button, { variant: 'line', full: true, icon: Icons.pen, onClick: onEdit }, '编辑描述'))),
    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', onClick: onClose }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', onClick: () => onSave(sel, voice) }, '保存形象')));
}

// —— 就绪 + 命名（上传照片路径，参考截图：你的虚拟形象已就绪）——
function AIReady({ char, defaultName, onConfirm, onClose }) {
  const [name, setName] = useStateAC(defaultName || '星碎');
  const [voice, setVoice] = useStateAC((seed.builtinVoices()[0] || {}).name);
  return hAC('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('span', { className: 'nav-spacer' }),
      hAC('span', { className: 'nav-title' }, '已就绪'),
      hAC('button', { className: 'nav-back m-tap', onClick: onClose, style: { marginLeft: 'auto' } }, hAC(Icons.x, { size: 22, stroke: 2.2 }))),
    hAC('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hAC('div', { className: 'm-fade' },
        hAC('h1', { style: { fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 7px' } }, '你的虚拟形象已就绪'),
        hAC('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 20px' } }, '现在添加一些细节，让你的虚拟形象更生动'),
        hAC('div', { style: { width: 200, margin: '0 auto 22px', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
          hAC(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' })),
        hAC('div', { style: { textAlign: 'left' } },
          hAC(UI.Field, { label: '名称', required: true }, hAC(UI.Input, { value: name, onChange: setName, placeholder: '为你的虚拟形象命名' })),
          hAC(RecVoice, { value: voice, onChange: setVoice })))),
    hAC('div', { style: { flex: '0 0 auto', padding: '12px 22px calc(14px + var(--home-ind))', display: 'flex', gap: 11, borderTop: '1px solid var(--line)' } },
      hAC(UI.Button, { variant: 'line', onClick: onClose }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', onClick: () => onConfirm(name, voice) }, '完成')));
}

// —— 外壳 ——
function MAICreate({ char, ctx }) {
  const [stage, setStage] = useStateAC('choose'); // choose | upload | form | gen | pick | ready
  const [mode, setMode] = useStateAC('ai');        // ai | upload
  const [name, setName] = useStateAC(char.name || '新建数字人');

  const save = (n, voice) => {
    const fresh = { ...char, name: n || name, status: 'archived' };
    if (voice) ctx.setVoice(fresh, voice);
    toast('形象已保存' + (voice ? ' · 音色 ' + voice : ''), { tone: 'ok' });
    ctx.finishCreate(fresh);
  };

  return hAC('div', { className: 'm-overlay', 'data-screen-label': 'AI 创建' },
    stage === 'choose' && hAC(AIChoosePath, { onClose: ctx.back, onPick: (k) => { setMode(k); setStage(k === 'upload' ? 'upload' : 'form'); } }),
    stage === 'upload' && hAC(AIUpload, { char, onClose: ctx.back, onUploaded: () => setStage('gen') }),
    stage === 'form' && hAC(AIForm, { char, onClose: () => setStage('choose'), onGenerate: (d) => { if (d.name) setName(d.name); setStage('gen'); } }),
    stage === 'gen' && hAC(AIGenerating, { label: mode === 'upload' ? '正在复刻你的形象…' : '正在生成你的形象…', onDone: () => setStage(mode === 'upload' ? 'ready' : 'pick') }),
    stage === 'pick' && hAC(AIPick, { char: { ...char, name }, onClose: ctx.back, onEdit: () => setStage('form'), onRegen: () => setStage('gen'), onSave: (sel, voice) => save(name, voice) }),
    stage === 'ready' && hAC(AIReady, { char, defaultName: '星碎', onClose: ctx.back, onConfirm: (n, voice) => save(n, voice) }));
}

export { MAICreate };
