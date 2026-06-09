"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, VoiceApi, AvatarApi, awaitJob, useApi, seed, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 V4 · AI 虚拟形象创建（全屏切屏）
//   选择方式(上传照片/AI设计) ──▶ 上传照片 ─▶ 生成中 ─▶ 就绪+命名
//                          └▶ 描述表单(选择外观示例) ─▶ 生成中 ─▶ 挑选形象
//   live 模式：create → photos/generate → 轮询 job → pick → 命名+音色 → finalize 入库
// ============================================================
const hAC : any = React.createElement;
const { useState: useStateAC, useEffect: useEffectAC, useRef: useRefAC } = React;

// 「选择外观」范例人物
const EXAMPLES = [
  { id: 'e1', name: '林澈 · 播客主播', age: '青年', gender: '男', ethnic: '东亚', style: '写实', hue: 258, variant: 'key', expr: 'smile', image: '/generated/avatar-previews/example-podcast-host.jpg', desc: '戴着监听耳机的青年男性播客主播，清爽短发，深色圆领卫衣，坐在专业录音棚桌前，身边有麦克风与笔记本，蓝紫柔光打亮脸部，气质冷静、专业、亲和。' },
  { id: 'e2', name: '苏念 · 美妆主理人', age: '青年', gender: '女', ethnic: '东亚', style: '写实', hue: 28, variant: 'threeq', expr: 'smile', image: '/generated/avatar-previews/example-beauty-creator.jpg', desc: '皮肤通透的青年女性美妆主理人，柔顺长发，精致自然妆容，浅色针织上衣，坐在化妆台前，环形灯柔和照亮脸部，气质温柔、干净、专业。' },
  { id: 'e3', name: '秦野 · 街拍创作者', age: '青年', gender: '女', ethnic: '欧美', style: '写实', hue: 8, variant: 'look', expr: 'calm', image: '/generated/avatar-previews/example-street-fashion.jpg', desc: '金发青年女性街拍创作者，五官利落，做旧夹克与白色内搭，城市街头背景，光线自然，气质自信、独立、有潮流感，但脸部清晰居中。' },
  { id: 'e4', name: '顾安 · 烘焙店主', age: '青年', gender: '女', ethnic: '东亚', style: '写实', hue: 178, variant: 'key', expr: 'smile', image: '/generated/avatar-previews/example-baking-kitchen.jpg', desc: '系着浅色围裙的青年女性烘焙店主，温暖笑容，柔和短发，站在明亮厨房中，木桌和蛋糕作为背景，暖色自然光，气质亲切、可靠、有手作温度。' },
  { id: 'e5', name: '许遥 · 健身教练', age: '青年', gender: '女', ethnic: '东亚', style: '写实', hue: 318, variant: 'side', expr: 'serious', image: '/generated/avatar-previews/example-fitness-coach.jpg', desc: '身材健康的青年女性健身教练，干净马尾，运动背心外搭轻薄外套，站在自然光训练室中，表情专注，气质阳光、自律、充满能量。' },
  { id: 'e6', name: '沈泊 · 家居博主', age: '青年', gender: '男', ethnic: '东亚', style: '写实', hue: 200, variant: 'threeq', expr: 'calm', image: '/generated/avatar-previews/example-home-lifestyle.jpg', desc: '青年男性家居生活博主，清爽短发，米色衬衫，站在明亮开放式厨房中，自然光从窗边进入，背景有餐具和绿植，气质温和、松弛、有生活感。' },
  { id: 'e7', name: '陈一然 · 财经分析师', age: '青年', gender: '女', ethnic: '东亚', style: '写实', hue: 214, variant: 'key', expr: 'calm', image: '/generated/avatar-previews/example-chen-yiran.jpg', desc: '青年女性财经分析师，短发或利落束发，浅灰西装外套，坐在整洁办公桌前，背景有模糊的数据屏幕与玻璃隔断，正面脸部清晰，气质理性、可信、干练。' },
  { id: 'e8', name: '陆明 · 数码测评人', age: '青年', gender: '男', ethnic: '东亚', style: '写实', hue: 190, variant: 'key', expr: 'smile', image: '/generated/avatar-previews/example-lu-ming.jpg', desc: '青年男性数码测评人，清爽短发，深色夹克，桌面有手机和相机设备，背景是现代工作室，正面脸部清晰，气质聪明、自然、表达欲强。' },
  { id: 'e9', name: '徐婉清 · 品牌主持', age: '中年', gender: '女', ethnic: '东亚', style: '写实', hue: 34, variant: 'key', expr: 'smile', image: '/generated/avatar-previews/example-xu-wanqing.jpg', desc: '成熟优雅的女性品牌主持人，精致盘发，米白西装，站在高端品牌展厅中，柔和灯光突出脸部，气质从容、可信、优雅。' },
  { id: 'e10', name: '何予 · 健康教练', age: '青年', gender: '男', ethnic: '东亚', style: '写实', hue: 150, variant: 'key', expr: 'calm', image: '/generated/avatar-previews/example-he-yu.jpg', desc: '青年男性健康教练，短发，运动休闲上衣，站在明亮瑜伽训练空间里，背景干净有绿植，正面脸部清晰，气质健康、温和、专业。' },
  { id: 'e11', name: '林小满 · 旅行创作者', age: '青年', gender: '女', ethnic: '东亚', style: '写实', hue: 300, variant: 'key', expr: 'smile', image: '/generated/avatar-previews/example-lin-xiaoman.jpg', desc: '青年女性旅行创作者，长发，浅色风衣，背景是明亮城市街景或车站窗光，正面脸部清晰，气质轻盈、好奇、有亲和力。' },
  { id: 'e12', name: '周辰 · 知识讲师', age: '中年', gender: '男', ethnic: '东亚', style: '写实', hue: 226, variant: 'key', expr: 'calm', image: '/generated/avatar-previews/example-zhou-chen.jpg', desc: '中年男性知识讲师，短发，深色针织衫或西装外套，背景是书架和柔和台灯，正面脸部清晰，气质沉稳、清晰、值得信赖。' },
];

// 分段控件（浅底胶囊，选中白底）
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
const AI_ENTRY_IMAGES = {
  ai: '/generated/create-entry/ai-design.jpg',
  upload: '/generated/create-entry/photo-upload.jpg',
};

function AIChoosePath({ onPick, onClose }) {
  const opt = (key, icon, label, image, accent) => hAC('button', { onClick: () => onPick(key), className: 'm-press', style: {
    position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12,
    width: '100%', height: 76, padding: '0 15px', borderRadius: 'var(--r-xl)', border: '1px solid rgba(255,255,255,.78)',
    cursor: 'pointer', background: '#F9FDFF', color: 'var(--ink)', textAlign: 'left',
    boxShadow: '0 14px 34px rgba(76,92,125,.14), 0 1px 0 rgba(255,255,255,.92) inset' } },
    hAC('img', { src: image, alt: '', draggable: false, style: {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .94, pointerEvents: 'none' } }),
    hAC('span', { style: { position: 'absolute', inset: 0, background:
      'linear-gradient(102deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.9) 45%, rgba(255,255,255,.48) 76%, rgba(255,255,255,.18) 100%)' } }),
    hAC('span', { style: { position: 'absolute', inset: 1, borderRadius: 'calc(var(--r-xl) - 1px)', background:
      'linear-gradient(180deg, rgba(255,255,255,.72), transparent 48%, rgba(238,248,255,.22))', pointerEvents: 'none' } }),
    hAC('span', { style: { position: 'relative', display: 'grid', placeItems: 'center', width: 42, height: 42, flex: '0 0 42px', borderRadius: 14,
      background: accent, color: '#fff', boxShadow: '0 10px 22px rgba(18,179,222,.22), 0 1px 0 rgba(255,255,255,.36) inset' } },
      hAC(icon, { size: 20, stroke: 2 })),
    hAC('span', { style: { position: 'relative', flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, textShadow: '0 1px 0 rgba(255,255,255,.72)' } }, label),
    hAC(Icons.chevR, { size: 18, stroke: 2.2, style: { position: 'relative', color: 'rgba(34,43,58,.42)', flex: '0 0 auto' } }));
  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } },
    hAC('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#EAF0FF,#F1E8FB 46%,#FCE6F1)' } }),
    hAC('div', { style: { position: 'absolute', top: '-12%', left: '-14%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(123,150,255,.5), transparent 70%)', filter: 'blur(14px)' } }),
    hAC('div', { style: { position: 'absolute', bottom: '4%', right: '-16%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(232,120,200,.42), transparent 70%)', filter: 'blur(16px)' } }),
    hAC('div', { style: { position: 'absolute', top: '32%', right: '6%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(110,210,255,.4), transparent 70%)', filter: 'blur(14px)' } }),
    hAC('div', { className: 'wx-nav', style: { position: 'relative', zIndex: 2, paddingLeft: 8 } },
      hAC('button', { className: 'nav-back m-tap', onClick: onClose, style: { color: 'var(--ink)' } }, hAC(Icons.x, { size: 22, stroke: 2.2 })),
      hAC('span', { className: 'nav-title' }), hAC('span', { className: 'nav-spacer' })),
    hAC('div', { style: { position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 26px' } },
      hAC('div', { className: 'm-fade', style: { textAlign: 'center', marginBottom: 'auto', marginTop: '18%' } },
        hAC('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', background: 'rgba(255,255,255,.66)', backdropFilter: 'blur(8px)', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 16, whiteSpace: 'nowrap' } },
          hAC(Icons.sparkle, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }), 'AI 原创虚拟形象'),
        hAC('h1', { style: { fontSize: 27, fontWeight: 800, letterSpacing: 0, lineHeight: 1.18, margin: 0, color: 'var(--ink)' } }, '创建你的', hAC('br', null), 'AI 数字人形象'),
        hAC('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '12px auto 0', maxWidth: 280 } }, '上传本人生活照复刻真实长相，或用文字描述从零原创一个虚构形象。')),
      hAC('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 'calc(30px + var(--home-ind))' } },
        opt('ai', Icons.wand, '使用 AI 设计', AI_ENTRY_IMAGES.ai, 'linear-gradient(155deg,#2C67F2,#8F6BFF)'),
        opt('upload', Icons.upload, '上传照片', AI_ENTRY_IMAGES.upload, 'linear-gradient(155deg,#13B8D7,#5FD8BC)'))));
}

// ============================================================
// 上传照片（真实文件选择 + 预览）
// ============================================================
function PhotoDemo({ src, ok }) {
  return hAC('div', { style: { position: 'relative', flex: 1, aspectRatio: '3 / 4', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
    hAC('img', { src, alt: ok ? '优质照片示例' : '不合格照片示例', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: ok ? 'none' : 'grayscale(.5) brightness(.92)' } }),
    hAC('span', { style: { position: 'absolute', right: 4, bottom: 4, width: 17, height: 17, borderRadius: 99, display: 'grid', placeItems: 'center',
      background: ok ? 'var(--ok)' : 'var(--err)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' } },
      hAC(ok ? Icons.check : Icons.x, { size: 11, stroke: 3 })));
}

function AIUpload({ char, onUploaded, onClose }) {
  const [files, setFiles] = useStateAC([] as File[]);
  const [previews, setPreviews] = useStateAC([] as string[]);
  const inputRef = useRefAC(null as any);
  useEffectAC(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const onPickFiles = (e) => {
    const list: File[] = Array.from(e.target.files || []).slice(0, 6) as File[];
    if (!list.length) return;
    const over = list.find((f: File) => f.size > 200 * 1024 * 1024);
    if (over) { toast('单张照片不能超过 200MB', { tone: 'warn' }); return; }
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const goods = [
    { src: '/generated/avatar-previews/photo-good-front.jpg' },
    { src: '/generated/avatar-previews/photo-good-three-quarter.jpg' },
    { src: '/generated/avatar-previews/photo-good-side.jpg' },
    { src: '/generated/avatar-previews/photo-good-smile.jpg' },
    { src: '/generated/avatar-previews/photo-good-fullbody.jpg' },
  ];
  const bads = [
    { src: '/generated/avatar-previews/photo-bad-group.jpg' },
    { src: '/generated/avatar-previews/photo-bad-sunglasses.jpg' },
    { src: '/generated/avatar-previews/photo-bad-pet.jpg' },
    { src: '/generated/avatar-previews/photo-bad-filter.jpg' },
    { src: '/generated/avatar-previews/photo-bad-lowres.jpg' },
  ];
  const picked = files.length > 0;

  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('input', { ref: inputRef, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/heic', multiple: true, style: { display: 'none' }, onChange: onPickFiles }),
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('span', { className: 'nav-spacer' }),
      hAC('span', { className: 'nav-title' }, '上传照片'),
      hAC('button', { className: 'nav-back m-tap', onClick: onClose, style: { marginLeft: 'auto' } }, hAC(Icons.x, { size: 22, stroke: 2.2 }))),
    hAC('div', { className: 'm-body', style: { padding: '0 18px 96px' } },
      hAC('div', { style: { textAlign: 'center', marginBottom: 18 } },
        hAC('h1', { style: { fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 6px' } }, '上传你的虚拟形象照片'),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 } }, '上传 1-6 张本人照片，AI 将保持身份一致地复刻为数字人')),

      // 选择/预览区
      hAC('div', { style: { border: '2px dashed ' + (picked ? 'var(--primary)' : 'var(--primary-soft)'), borderRadius: 'var(--r-xl)', background: 'var(--primary-tint)', padding: '28px 20px', textAlign: 'center', marginBottom: 22 } },
        picked
          ? hAC('div', { className: 'm-fade' },
              hAC('div', { style: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' } },
                previews.slice(0, 6).map((u, i) => hAC('div', { key: i, style: { width: 56, height: 72, borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
                  hAC('img', { src: u, alt: '照片 ' + (i + 1), style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })))),
              hAC('div', { style: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, '已选择 ' + files.length + ' 张照片'),
              hAC('button', { onClick: () => inputRef.current && inputRef.current.click(), style: { marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' } }, '重新选择'))
          : hAC('div', null,
              hAC('div', { style: { width: 60, height: 60, margin: '0 auto 16px', borderRadius: 16, background: 'var(--surface)', border: '1.5px dashed var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAC(Icons.upload, { size: 26, stroke: 1.8 })),
              hAC('div', { style: { fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 } }, '选择照片以上传'),
              hAC('div', { style: { fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 16 } }, '支持 PNG、JPG、HEIC、WebP，单张不超过 200MB'),
              hAC('button', { onClick: () => inputRef.current && inputRef.current.click(), className: 'm-tap', style: { height: 38, padding: '0 20px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, '选择照片'))),

      // 照片要求
      hAC('div', { style: { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', padding: '18px 16px' } },
        hAC('div', { style: { fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 16 } }, '照片要求'),
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          hAC('span', { style: { width: 22, height: 22, borderRadius: 99, background: 'var(--ok)', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' } }, hAC(Icons.check, { size: 13, stroke: 3 })),
          hAC('span', { style: { fontSize: 14.5, fontWeight: 700 } }, '优质照片')),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 12px' } }, '近期的个人照片（仅限本人），包含近景和全身照，涵盖不同角度、表情（微笑、中性、严肃）和多样服装。确保为高分辨率，并与当前外貌一致。'),
        hAC('div', { style: { display: 'flex', gap: 7, marginBottom: 20 } },
          goods.map((g, i) => hAC(PhotoDemo, { key: i, src: g.src, ok: true }))),
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          hAC('span', { style: { width: 22, height: 22, borderRadius: 99, background: 'var(--err)', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' } }, hAC(Icons.x, { size: 13, stroke: 3 })),
          hAC('span', { style: { fontSize: 14.5, fontWeight: 700 } }, '不合格照片')),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 12px' } }, '不要上传合照、帽子、太阳镜、宠物、重度滤镜、低分辨率图片或截图。避免过旧、过度编辑或与当前外貌不符的照片。'),
        hAC('div', { style: { display: 'flex', gap: 7 } },
          bads.map((g, i) => hAC(PhotoDemo, { key: i, src: g.src, ok: false }))))),

    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', onClick: onClose, style: { flex: '0 0 88px', padding: '0 12px' } }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', disabled: !picked, icon: Icons.upload, onClick: () => onUploaded(files), style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, '上传并生成')));
}

// ============================================================
// 「选择外观」示例选择器
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
          hAC('img', { src: ex.image, alt: ex.name, style: { display: 'block', width: '100%', aspectRatio: '4 / 5', objectFit: 'cover' } }),
          hAC('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,26,.5), transparent 46%)' } }),
          hAC('div', { style: { position: 'absolute', left: 11, bottom: 10, right: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
            hAC('span', { className: 'm-clip1', style: { minWidth: 0, fontSize: 13.5, fontWeight: 700, color: '#fff', textAlign: 'left' } }, ex.name),
            hAC('span', { style: { width: 24, height: 24, borderRadius: 99, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hAC(Icons.arrowR, { size: 13, stroke: 2.4 }))))))));
}

// —— 描述表单 ——
function AIForm({ onGenerate, onClose, char, initial }) {
  const [name, setName] = useStateAC(initial?.name || '');
  const [age, setAge] = useStateAC(initial?.age || '未指定');
  const [gender, setGender] = useStateAC(initial?.gender || '未指定');
  const [ethnic, setEthnic] = useStateAC(initial?.ethnic || '未指定');
  const [desc, setDesc] = useStateAC(initial?.desc || '');
  const orient = '竖屏';
  const pose = '脸部';
  const [style, setStyle] = useStateAC(initial?.style || '未指定');
  const [examples, setExamples] = useStateAC(false);

  const applyExample = (ex) => {
    setDesc(ex.desc);
    if (!name) setName(ex.name);
    if (ex.age) setAge(ex.age);
    if (ex.gender) setGender(ex.gender);
    if (ex.ethnic) setEthnic(ex.ethnic);
    if (ex.style) setStyle(ex.style);
    setExamples(false);
    toast('已套用「' + ex.name + '」示例', { tone: 'ok' });
  };
  const submit = () => {
    if (!desc.trim()) { toast('请先描述形象，或从示例中挑一个', { tone: 'warn' }); return; }
    onGenerate({ name: name.trim(), desc: desc.trim(), age, gender, ethnic, orient, pose, style });
  };

  return hAC('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAC('button', { className: 'nav-back m-tap', onClick: onClose }, hAC(Icons.chevL, { size: 24, stroke: 2.2 })),
      hAC('span', { className: 'nav-title' }, '描述形象'),
      hAC('span', { className: 'nav-spacer' })),
    hAC('div', { className: 'm-body', style: { padding: '4px 18px 100px' } },
      hAC('h1', { style: { fontSize: 23, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 16px' } }, '描述你的数字人形象'),
      hAC('button', { onClick: () => setExamples(true), className: 'm-tap', style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '12px 14px', marginBottom: 22,
        background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left' } },
        hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 } },
          hAC('span', { style: { width: 36, height: 36, flex: '0 0 36px', borderRadius: 10, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAC(Icons.images, { size: 18, stroke: 1.8 })),
          hAC('div', { style: { minWidth: 0 } },
            hAC('div', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, '选择一个示例'),
            hAC('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, '从范例形象快速套用描述'))),
        hAC('span', { style: { flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', background: 'var(--ink)', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center' } }, '试试')),

      hAC('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 12 } }, '基础信息'),
      hAC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 } },
        hAC(UI.Field, { label: '名称', hint: '留空由 AI 起名' }, hAC(UI.Input, { value: name, onChange: setName, placeholder: 'AI 自动起名' })),
        hAC(UI.Field, { label: '年龄' }, hAC(UI.Select, { value: age, onChange: setAge, options: ['未指定', '青年', '中年', '年长'] })),
        hAC(UI.Field, { label: '性别' }, hAC(UI.Select, { value: gender, onChange: setGender, options: ['未指定', '女', '男', '中性'] })),
        hAC(UI.Field, { label: '族裔' }, hAC(UI.Select, { value: ethnic, onChange: setEthnic, options: ['未指定', '东亚', '欧美', '南亚', '非洲', '拉美'] }))),

      hAC('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 12 } }, '外观'),
      hAC('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
        hAC('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' } }, '描述你的形象', hAC('span', { style: { color: 'var(--err)' } }, ' *')),
        hAC('button', { onClick: () => setExamples(true), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)' } }, '选择外观')),
      hAC(UI.Textarea, { value: desc, onChange: setDesc, rows: 4, placeholder: '描述外貌、气质、服饰、场景与光线…', style: { marginBottom: 22 } }),

      hAC('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 } },
        hAC(UI.Field, { label: '朝向' }, hAC('div', { style: { height: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line-2)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, '竖屏')),
        hAC(UI.Field, { label: '姿态' }, hAC('div', { style: { height: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line-2)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, '脸部'))),
      hAC(UI.Field, { label: '风格' }, hAC(UI.Select, { value: style, onChange: setStyle, options: ['未指定', '写实', '二次元', '国风', '电影感', '赛博'] }))),

    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', onClick: onClose, style: { flex: '0 0 104px', padding: '0 12px' } }, '上一步'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', iconR: Icons.sparkle, disabled: !desc.trim(), onClick: submit, style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, '生成预览')),

    examples && hAC(ExamplePicker, { char, onPick: applyExample, onClose: () => setExamples(false) }));
}

// —— 生成中（真实任务轮询）——
function AIGenerating({ label, pct, eta }) {
  return hAC('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } }, hAC('span', { className: 'nav-spacer' }), hAC('span', { className: 'nav-title' }), hAC('span', { className: 'nav-spacer' })),
    hAC('div', { className: 'm-body', style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
      hAC('div', { className: 'm-fade', style: { width: '100%', maxWidth: 300 } },
        hAC('div', { style: { width: 80, height: 80, margin: '0 auto 24px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hAC('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, border: '3px solid var(--primary-soft)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' } }),
          hAC(Icons.sparkle, { size: 30, style: { color: 'var(--primary)' } })),
        hAC('h2', { style: { fontSize: 21, fontWeight: 800, marginBottom: 8 } }, label || '正在生成你的形象…'),
        hAC('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 18 } }, eta || '约需 30–60 秒，请勿离开本页面。'),
        pct != null && hAC(UI.Progress, { pct: Math.round(pct), showLabel: true }))));
}

// —— 失败重试 ——
function AIFailed({ message, onRetry, onBack }) {
  return hAC('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hAC('div', { className: 'wx-nav', style: { paddingLeft: 8 } }, hAC('span', { className: 'nav-spacer' }), hAC('span', { className: 'nav-title' }), hAC('span', { className: 'nav-spacer' })),
    hAC('div', { className: 'm-body', style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 30px' } },
      hAC('div', { className: 'm-fade', style: { width: '100%', maxWidth: 300 } },
        hAC('div', { style: { width: 72, height: 72, margin: '0 auto 18px', borderRadius: 99, background: 'var(--err-s)', color: 'var(--err)', display: 'grid', placeItems: 'center' } }, hAC(Icons.warn, { size: 34 })),
        hAC('h2', { style: { fontSize: 20, fontWeight: 800, marginBottom: 8 } }, '生成没有成功'),
        hAC('p', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22, wordBreak: 'break-all' } }, message || '请稍后重试'),
        hAC('div', { style: { display: 'flex', gap: 10 } },
          hAC(UI.Button, { variant: 'line', full: true, onClick: onBack }, '返回修改'),
          hAC(UI.Button, { variant: 'primary', full: true, icon: Icons.retry, onClick: onRetry }, '重试')))));
}

// —— 推荐音色 ——
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
    hAC('div', { style: { padding: '13px 14px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-lg)' } },
      hAC('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        hAC('button', { onClick: () => setPlaying(p => !p), style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 99, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: playing ? 'var(--primary)' : 'var(--surface)', color: playing ? '#fff' : 'var(--primary)', boxShadow: 'var(--sh-1)' } }, hAC(playing ? Icons.bolt : Icons.play, { size: 16 })),
        hAC('div', { style: { flex: 1, minWidth: 0 } },
          hAC('div', { style: { fontSize: 14.5, fontWeight: 700 } }, cur.name),
          hAC('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, cur.traits)),
        hAC('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', background: 'var(--surface)', padding: '4px 10px', borderRadius: 'var(--r-pill)', flex: '0 0 auto' } }, '推荐')),
      hAC('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 } },
        cur.scenes.slice(0, 4).map(s => hAC('span', { key: s, style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)', padding: '3px 9px', borderRadius: 'var(--r-pill)' } }, s)))),
    open && hAC('div', { className: 'm-fade', style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 } },
      VOICES.filter(v => v.id !== cur.id).map(v => hAC('button', { key: v.id, onClick: () => { onChange(v.name); setOpen(false); }, className: 'm-tap', style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'left' } },
        hAC('span', { style: { width: 32, height: 32, flex: '0 0 32px', borderRadius: 99, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' } }, hAC(Icons.user, { size: 15, stroke: 1.9 })),
        hAC('div', { style: { flex: 1, minWidth: 0 } },
          hAC('div', { style: { fontSize: 14, fontWeight: 700 } }, v.name),
          hAC('div', { className: 'm-clip1', style: { fontSize: 11, color: 'var(--ink-3)', marginTop: 1 } }, v.traits)),
        hAC('span', { style: { fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 'var(--r-pill)', flex: '0 0 auto' } }, v.gender === 'female' ? '女声' : '男声')))));
}

// —— 挑选形象（四宫格 · 真实候选图）——
function AIPick({ avatar, busy, onSave, onRegen, onEdit, onClose }) {
  const [sel, setSel] = useStateAC(0);
  const [name, setName] = useStateAC(avatar?.name || '');
  const [voice, setVoice] = useStateAC(avatar?.voiceName || (seed.builtinVoices()[0] || {}).name || '亲和邻家女声');
  const variants = ['key', 'threeq', 'side', 'look'];
  const hues = [0, 18, -16, 30];
  const imgs: string[] = avatar?.variantImages || [];
  useEffectAC(() => { if (avatar?.name && !name) setName(avatar.name); if (avatar?.voiceName) setVoice(avatar.voiceName); }, [avatar]);

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
            hAC(Portrait, { char: { ...(avatar || {}), shotImages: null, imageUrl: null, hue: ((avatar && avatar.hue) || 210) + hues[i] }, src: imgs[i] || null, variant: v, ratio: '3 / 4', expr: i % 2 ? 'smile' : 'calm' }),
            hAC('span', { style: { position: 'absolute', top: 9, left: 9, width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (on ? 'var(--primary)' : 'rgba(255,255,255,.9)'), background: on ? 'var(--primary)' : 'rgba(255,255,255,.4)', display: 'grid', placeItems: 'center' } },
              on && hAC(Icons.check, { size: 13, stroke: 3, style: { color: '#fff' } })),
            hAC('div', { className: 'ph-label', style: { left: 8, bottom: 8 } }, 'v' + (i + 1)));
        })),
      hAC('div', { style: { textAlign: 'left', marginTop: 18 } },
        hAC(UI.Field, { label: '名称', required: true }, hAC(UI.Input, { value: name, onChange: setName, placeholder: '为你的数字人命名' }))),
      hAC(RecVoice, { value: voice, onChange: setVoice }),
      hAC('div', { style: { display: 'flex', gap: 11, marginTop: 18 } },
        hAC(UI.Button, { variant: 'line', full: true, icon: Icons.refresh, disabled: busy, onClick: onRegen }, '重新生成'),
        hAC(UI.Button, { variant: 'line', full: true, icon: Icons.pen, disabled: busy, onClick: onEdit }, '编辑描述'))),
    hAC('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hAC(UI.Button, { variant: 'line', disabled: busy, onClick: onClose, style: { flex: '0 0 88px', padding: '0 12px' } }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', disabled: busy || !name.trim(), onClick: () => onSave(sel, name.trim(), voice), style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, busy ? '保存中…' : '保存形象')));
}

// —— 就绪 + 命名（上传照片路径）——
function AIReady({ avatar, busy, onConfirm, onClose }) {
  const [name, setName] = useStateAC(avatar?.name && !avatar.name.startsWith('新建') ? avatar.name : '');
  const [voice, setVoice] = useStateAC(avatar?.voiceName || (seed.builtinVoices()[0] || {}).name || '亲和邻家女声');
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
          hAC(Portrait, { char: avatar || {}, variant: 'key', ratio: '4 / 5', expr: 'calm' })),
        hAC('div', { style: { textAlign: 'left' } },
          hAC(UI.Field, { label: '名称', required: true }, hAC(UI.Input, { value: name, onChange: setName, placeholder: '为你的虚拟形象命名' })),
          hAC(RecVoice, { value: voice, onChange: setVoice })))),
    hAC('div', { style: { flex: '0 0 auto', padding: '12px 22px calc(14px + var(--home-ind))', display: 'flex', gap: 11, borderTop: '1px solid var(--line)' } },
      hAC(UI.Button, { variant: 'line', disabled: busy, onClick: onClose, style: { flex: '0 0 88px', padding: '0 12px' } }, '取消'),
      hAC(UI.Button, { variant: 'dark', full: true, size: 'lg', disabled: busy || !name.trim(), onClick: () => onConfirm(name.trim(), voice), style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, busy ? '保存中…' : '完成')));
}

// —— 外壳：编排 create → photos/generate → poll → pick/ready → finalize ——
function MAICreate({ char, ctx }) {
  const [stage, setStage] = useStateAC('choose'); // choose | upload | form | gen | pick | ready | failed
  const [mode, setMode] = useStateAC('ai');        // ai | upload
  const [avatar, setAvatar] = useStateAC(null as any); // server 实体
  const [form, setForm] = useStateAC(null as any);
  const [pendingFiles, setPendingFiles] = useStateAC([] as File[]);
  const [job, setJob] = useStateAC(null as any);
  const [errMsg, setErrMsg] = useStateAC('');
  const [busy, setBusy] = useStateAC(false);
  const aliveRef = useRefAC(true);
  // StrictMode（dev）会 mount→unmount→remount：cleanup 把 ref 置 false 后必须在 effect body 复位，
  // 否则所有 setState 被守卫拦截 → 生成完成 UI 也不动（实测 bug）。
  useEffectAC(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  /** 确保 server 端已建草稿资产。 */
  const ensureAvatar = async () => {
    if (avatar) return avatar;
    const created = await AvatarApi.create({ path: 'ai' });
    if (aliveRef.current) setAvatar(created);
    return created;
  };

  const runGenerate = async (genMode: 'describe' | 'upload', f?: any, files?: File[]) => {
    // —— AI 设计（4 变体，约 1 分钟）：提交即回数字人库，卡片上看实时进度，
    //    完成后从资产「继续创建链路」挑选形象 —— 不再全屏阻塞等待。
    if (genMode === 'describe') {
      setStage('gen');
      try {
        const a = await ensureAvatar();
        if (f && f.name) await AvatarApi.patch(a.id, { name: f.name }).catch(() => {});
        await AvatarApi.generate(a.id, { mode: 'describe', form: f });
        toast('已开始生成 · 在卡片上查看进度，完成后进入挑选', { tone: 'ok' });
        (ctx.submitToLibrary || ctx.finishCreate)({ ...a, status: 'proofing' });
      } catch (e: any) {
        if (!aliveRef.current) return;
        setErrMsg(e?.message || '生成失败');
        setStage('failed');
      }
      return;
    }
    // —— 照片复刻（单图，约 30 秒）：保持原地等待，出图后命名 + 选音色 ——
    setStage('gen');
    try {
      const a = await ensureAvatar();
      if (files && files.length) {
        const fd = new FormData();
        files.forEach((file) => fd.append('files', file));
        await AvatarApi.photos(a.id, fd);
      }
      const j = await AvatarApi.generate(a.id, { mode: 'upload' });
      setJob(j);
      await awaitJob(j.id, (jj) => aliveRef.current && setJob({ ...jj }));
      const freshA = await AvatarApi.get(a.id);
      if (!aliveRef.current) return;
      setAvatar(freshA);
      setStage('ready');
      toast('复刻完成', { tone: 'ok' });
    } catch (e: any) {
      if (!aliveRef.current) return;
      setErrMsg(e?.message || '生成失败');
      setStage('failed');
    }
  };

  const save = async (sel: number, name: string, voice: string) => {
    setBusy(true);
    try {
      const a = avatar || await ensureAvatar();
      if (mode === 'ai') await AvatarApi.pick(a.id, sel);
      await AvatarApi.patch(a.id, { name });
      if (voice) await VoiceApi.bind(a.id, voice).catch(() => {});
      const fresh = await AvatarApi.get(a.id).catch(() => ({ ...a, name }));
      toast('已生成形象 · 下一步精调' + (voice ? ' · 音色 ' + voice : ''), { tone: 'ok' });
      (ctx.continueAdjust || ctx.realToWizard || ctx.finishCreate)({ ...fresh, name, _startAdjust: true });
    } catch (e: any) {
      toast(e?.message || '保存失败', { tone: 'err' });
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const retry = () => {
    if (mode === 'upload') runGenerate('upload', null, pendingFiles);
    else runGenerate('describe', form);
  };

  return hAC('div', { className: 'm-overlay', 'data-screen-label': 'AI 创建' },
    stage === 'choose' && hAC(AIChoosePath, { onClose: ctx.back, onPick: (k) => { setMode(k === 'upload' ? 'upload' : 'ai'); setStage(k === 'upload' ? 'upload' : 'form'); } }),
    stage === 'upload' && hAC(AIUpload, { char, onClose: () => setStage('choose'), onUploaded: (files) => { setPendingFiles(files); runGenerate('upload', null, files); } }),
    stage === 'form' && hAC(AIForm, { char, initial: form, onClose: () => setStage('choose'), onGenerate: (d) => { setForm(d); runGenerate('describe', d); } }),
    stage === 'gen' && hAC(AIGenerating, {
      label: mode === 'upload' ? '正在复刻你的形象…' : '正在生成你的形象…',
      pct: job ? job.pct : null,
      eta: job && job.status === 'running' ? (job.eta || '约需 30–60 秒，请勿离开本页面。') : null }),
    stage === 'failed' && hAC(AIFailed, { message: errMsg, onRetry: retry, onBack: () => setStage(mode === 'upload' ? 'upload' : 'form') }),
    stage === 'pick' && hAC(AIPick, { avatar, busy, onClose: ctx.back, onEdit: () => setStage('form'), onRegen: () => runGenerate('describe', form), onSave: save }),
    stage === 'ready' && hAC(AIReady, { avatar, busy, onClose: ctx.back, onConfirm: (n, voice) => save(0, n, voice) }));
}

export { MAICreate };
