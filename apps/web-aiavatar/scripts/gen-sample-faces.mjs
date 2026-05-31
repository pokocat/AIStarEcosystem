// 生成「MediaPipe 可检测」的占位人脸 SVG（public/samples/face-*.svg）。
// 用途：mock 模式下AiAvatar封面 / 打样 / 出图用真实结构的正面脸，让人像精调的
// MediaPipe FaceLandmarker 能真的检测到 478 关键点（眼/鼻/嘴/脸轮廓齐全、正面、对比清晰）。
// 用户可把自己的照片放到 public/samples/portrait-1.jpg 等替换默认脸（见 README）。
//
// 运行：node apps/web-aiavatar/scripts/gen-sample-faces.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../public/samples");
mkdirSync(OUT, { recursive: true });

const W = 384, H = 512;

// 变体：肤色 / 发色 / 发型(short|long) / 唇色 / 背景。结构对齐已验证可被 MediaPipe 检测的正面脸。
const VARIANTS = [
  { id: 1, label: "男·短发", skin: "#e8c4a0", skin2: "#d4a87f", hair: "#241c16", style: "short", lip: "#b06a55", bg: ["#2a2b30", "#16171b"], beard: true },
  { id: 2, label: "女·长发", skin: "#f0d2b4", skin2: "#e0b896", hair: "#2a201a", style: "long", lip: "#c66a66", bg: ["#33323a", "#1a1820"], smile: true },
  { id: 3, label: "男·利落", skin: "#dcb189", skin2: "#c79a72", hair: "#1c1712", style: "short", lip: "#a8624f", bg: ["#26303a", "#141a20"] },
  { id: 4, label: "女·盘发", skin: "#f3d8bd", skin2: "#e6c2a2", hair: "#33271d", style: "bun", lip: "#cc6f6a", bg: ["#322a36", "#1b1620"], smile: true },
];

const cx = W / 2;
const faceCy = 250, faceRx = 118, faceRy = 150;
const eyeY = 232, eyeDx = 50, eyeRx = 26, eyeRy = 15;
const noseY = 268, mouthY = 322, browY = 198;

function face(v) {
  const eye = (ex) => `
    <ellipse cx="${ex}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="#fbfbf8"/>
    <ellipse cx="${ex}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="none" stroke="#8a7560" stroke-width="1.5"/>
    <circle cx="${ex}" cy="${eyeY}" r="10.5" fill="#4a3526"/>
    <circle cx="${ex}" cy="${eyeY}" r="5" fill="#1a120c"/>
    <circle cx="${ex - 3}" cy="${eyeY - 4}" r="2.2" fill="#ffffff" opacity="0.9"/>`;
  const brow = (bx, dir) => `<path d="M ${bx - 26} ${browY + (dir > 0 ? 3 : 6)} Q ${bx} ${browY - 8} ${bx + 26} ${browY + (dir > 0 ? 6 : 3)}" stroke="${v.hair}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const mouth = v.smile
    ? `<path d="M ${cx - 34} ${mouthY} Q ${cx} ${mouthY + 26} ${cx + 34} ${mouthY}" stroke="${v.lip}" stroke-width="8" fill="none" stroke-linecap="round"/>
       <path d="M ${cx - 30} ${mouthY + 2} Q ${cx} ${mouthY + 16} ${cx + 30} ${mouthY + 2}" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.55"/>`
    : `<path d="M ${cx - 30} ${mouthY + 6} Q ${cx} ${mouthY + 14} ${cx + 30} ${mouthY + 6}" stroke="${v.lip}" stroke-width="8" fill="none" stroke-linecap="round"/>`;

  const hairTop =
    v.style === "long"
      ? `<path d="M ${cx - faceRx - 16} ${faceCy + 40} Q ${cx - faceRx - 30} ${faceCy - 150} ${cx} ${faceCy - 175} Q ${cx + faceRx + 30} ${faceCy - 150} ${cx + faceRx + 16} ${faceCy + 40} L ${cx + faceRx - 8} ${faceCy + 30} Q ${cx + faceRx} ${faceCy - 110} ${cx} ${faceCy - 132} Q ${cx - faceRx} ${faceCy - 110} ${cx - faceRx + 8} ${faceCy + 30} Z" fill="${v.hair}"/>`
      : v.style === "bun"
      ? `<circle cx="${cx}" cy="${faceCy - 150}" r="34" fill="${v.hair}"/><path d="M ${cx - faceRx + 6} ${faceCy - 30} Q ${cx - faceRx} ${faceCy - 140} ${cx} ${faceCy - 150} Q ${cx + faceRx} ${faceCy - 140} ${cx + faceRx - 6} ${faceCy - 30} Q ${cx} ${faceCy - 118} ${cx - faceRx + 6} ${faceCy - 30} Z" fill="${v.hair}"/>`
      : `<path d="M ${cx - faceRx + 4} ${faceCy - 36} Q ${cx - faceRx - 6} ${faceCy - 150} ${cx} ${faceCy - 158} Q ${cx + faceRx + 6} ${faceCy - 150} ${cx + faceRx - 4} ${faceCy - 36} Q ${cx + faceRx - 30} ${faceCy - 116} ${cx} ${faceCy - 122} Q ${cx - faceRx + 30} ${faceCy - 116} ${cx - faceRx + 4} ${faceCy - 36} Z" fill="${v.hair}"/>`;

  const beard = v.beard
    ? `<path d="M ${cx - 70} ${mouthY + 10} Q ${cx} ${faceCy + faceRy - 70} ${cx + 70} ${mouthY + 10} Q ${cx} ${mouthY + 70} ${cx - 70} ${mouthY + 10} Z" fill="${v.hair}" opacity="0.32"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg${v.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${v.bg[0]}"/><stop offset="1" stop-color="${v.bg[1]}"/>
    </linearGradient>
    <radialGradient id="skin${v.id}" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0" stop-color="${v.skin}"/><stop offset="1" stop-color="${v.skin2}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg${v.id})"/>
  <!-- 脖子 + 肩 -->
  <rect x="${cx - 42}" y="${faceCy + 90}" width="84" height="70" rx="24" fill="${v.skin2}"/>
  <path d="M ${cx - 150} ${H} Q ${cx - 120} ${faceCy + 150} ${cx} ${faceCy + 160} Q ${cx + 120} ${faceCy + 150} ${cx + 150} ${H} Z" fill="${v.bg[0]}" opacity="0.9"/>
  <path d="M ${cx - 120} ${H} Q ${cx - 96} ${faceCy + 168} ${cx} ${faceCy + 176} Q ${cx + 96} ${faceCy + 168} ${cx + 120} ${H} Z" fill="#3a3a42"/>
  <!-- 后发(长发垂肩) -->
  ${v.style === "long" ? `<path d="M ${cx - faceRx - 10} ${faceCy - 20} Q ${cx - faceRx - 40} ${faceCy + 180} ${cx - 60} ${H} L ${cx - 110} ${H} Q ${cx - faceRx - 60} ${faceCy + 60} ${cx - faceRx - 6} ${faceCy - 40} Z M ${cx + faceRx + 10} ${faceCy - 20} Q ${cx + faceRx + 40} ${faceCy + 180} ${cx + 60} ${H} L ${cx + 110} ${H} Q ${cx + faceRx + 60} ${faceCy + 60} ${cx + faceRx + 6} ${faceCy - 40} Z" fill="${v.hair}"/>` : ""}
  <!-- 脸 -->
  <ellipse cx="${cx}" cy="${faceCy}" rx="${faceRx}" ry="${faceRy}" fill="url(#skin${v.id})"/>
  <!-- 腮红 -->
  <ellipse cx="${cx - 62}" cy="${noseY + 6}" rx="22" ry="14" fill="#e08a72" opacity="0.18"/>
  <ellipse cx="${cx + 62}" cy="${noseY + 6}" rx="22" ry="14" fill="#e08a72" opacity="0.18"/>
  ${beard}
  <!-- 鼻 -->
  <path d="M ${cx - 6} ${eyeY + 6} L ${cx - 13} ${noseY} Q ${cx} ${noseY + 12} ${cx + 13} ${noseY} L ${cx + 6} ${eyeY + 6}" fill="none" stroke="${v.skin2}" stroke-width="3"/>
  <ellipse cx="${cx - 9}" cy="${noseY + 4}" rx="4" ry="3" fill="${v.skin2}" opacity="0.7"/>
  <ellipse cx="${cx + 9}" cy="${noseY + 4}" rx="4" ry="3" fill="${v.skin2}" opacity="0.7"/>
  <!-- 眉 / 眼 / 嘴 -->
  ${brow(cx - eyeDx, 1)} ${brow(cx + eyeDx, -1)}
  ${eye(cx - eyeDx)} ${eye(cx + eyeDx)}
  ${mouth}
  <!-- 前发 -->
  ${hairTop}
  <text x="14" y="${H - 14}" font-family="monospace" font-size="13" fill="#f0a83a" opacity="0.85">SAMPLE · ${v.label}</text>
</svg>`;
}

for (const v of VARIANTS) {
  writeFileSync(resolve(OUT, `face-${v.id}.svg`), face(v).trim());
}
console.log(`generated ${VARIANTS.length} sample faces → public/samples/face-{1..${VARIANTS.length}}.svg`);
