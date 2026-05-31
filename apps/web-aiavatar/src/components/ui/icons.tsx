// ============================================================
// 图标库 — 线性科技风 SVG（统一 stroke / currentColor）。
// 从原型 app/icons.jsx 1:1 移植为类型化 TSX。
// ============================================================
import * as React from "react";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  stroke?: number;
}

type PathDef = string | { t: "circle" | "rect"; a: Record<string, number> };

function makeIcon(paths: PathDef[], vb = 24) {
  const Icon = ({ size = 18, stroke = 1.6, style, ...rest }: IconProps) =>
    React.createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: `0 0 ${vb} ${vb}`,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style,
        ...rest,
      },
      paths.map((d, i) =>
        typeof d === "string"
          ? React.createElement("path", { key: i, d })
          : React.createElement(d.t, { key: i, ...d.a }),
      ),
    );
  Icon.displayName = "Icon";
  return Icon;
}

export type IconComponent = ReturnType<typeof makeIcon>;

export const Icons = {
  grid: makeIcon(["M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"]),
  list: makeIcon(["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"]),
  gallery: makeIcon(["M3 5h8v14H3zM13 5h8v6h-8zM13 13h8v6h-8z"]),
  plus: makeIcon(["M12 5v14M5 12h14"]),
  search: makeIcon([{ t: "circle", a: { cx: 11, cy: 11, r: 7 } }, "M21 21l-4.3-4.3"]),
  user: makeIcon([{ t: "circle", a: { cx: 12, cy: 8, r: 4 } }, "M4 21a8 8 0 0 1 16 0"]),
  sparkle: makeIcon(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"]),
  cube: makeIcon(["M12 2l9 5v10l-9 5-9-5V7z", "M12 2v20", "M21 7l-9 5-9-5"]),
  film: makeIcon([{ t: "rect", a: { x: 3, y: 4, width: 18, height: 16, rx: 2 } }, "M3 9h18M3 15h18M8 4v16M16 4v16"]),
  shield: makeIcon(["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"]),
  layers: makeIcon(["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5", "M3 18l9 5 9-5"]),
  sliders: makeIcon(["M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3", "M1 14h6M9 8h6M17 16h6"]),
  wand: makeIcon(["M15 4V2M15 10V8M11 6H9M21 6h-2", "M5 21l11-11-2-2L3 19z", "M17 8l-2-2"]),
  check: makeIcon(["M20 6L9 17l-5-5"]),
  chevR: makeIcon(["M9 18l6-6-6-6"]),
  chevL: makeIcon(["M15 18l-6-6 6-6"]),
  chevD: makeIcon(["M6 9l6 6 6-6"]),
  arrowR: makeIcon(["M5 12h14M13 6l6 6-6 6"]),
  x: makeIcon(["M18 6L6 18M6 6l12 12"]),
  upload: makeIcon(["M12 16V4M7 9l5-5 5 5", "M4 20h16"]),
  image: makeIcon([{ t: "rect", a: { x: 3, y: 3, width: 18, height: 18, rx: 2 } }, { t: "circle", a: { cx: 8.5, cy: 8.5, r: 1.6 } }, "M21 15l-5-5L5 21"]),
  clock: makeIcon([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "M12 7v5l3 3"]),
  retry: makeIcon(["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"]),
  history: makeIcon(["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 8v5l3 2"]),
  tag: makeIcon(["M3 3h7l11 11-7 7L3 10z", { t: "circle", a: { cx: 7, cy: 7, r: 1.3 } }]),
  filter: makeIcon(["M3 5h18l-7 8v6l-4-2v-4z"]),
  download: makeIcon(["M12 4v12M7 11l5 5 5-5", "M4 20h16"]),
  copy: makeIcon([{ t: "rect", a: { x: 9, y: 9, width: 12, height: 12, rx: 2 } }, "M5 15V5a2 2 0 0 1 2-2h8"]),
  trash: makeIcon(["M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"]),
  eye: makeIcon(["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", { t: "circle", a: { cx: 12, cy: 12, r: 3 } }]),
  heart: makeIcon(["M12 21C5 14 3 11 3 8a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 3-2 6-9 13z"]),
  lock: makeIcon([{ t: "rect", a: { x: 4, y: 11, width: 16, height: 10, rx: 2 } }, "M8 11V7a4 4 0 0 1 8 0v4"]),
  bolt: makeIcon(["M13 2L4 14h7l-1 8 9-12h-7z"]),
  doc: makeIcon(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6M9 17h6"]),
  camera: makeIcon(["M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z", { t: "circle", a: { cx: 12, cy: 13, r: 4 } }]),
  palette: makeIcon([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, { t: "circle", a: { cx: 8, cy: 9, r: 1 } }, { t: "circle", a: { cx: 15, cy: 8, r: 1 } }, { t: "circle", a: { cx: 16, cy: 13, r: 1 } }]),
  more: makeIcon([{ t: "circle", a: { cx: 5, cy: 12, r: 1.4 } }, { t: "circle", a: { cx: 12, cy: 12, r: 1.4 } }, { t: "circle", a: { cx: 19, cy: 12, r: 1.4 } }]),
  back: makeIcon(["M19 12H5M11 18l-6-6 6-6"]),
  star: makeIcon(["M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19l1-5.8L3.5 9.1l5.9-.9z"]),
  compare: makeIcon(["M12 3v18", "M5 8l-3 4 3 4M19 8l3 4-3 4"]),
  scan: makeIcon(["M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2", "M4 12h16"]),
  folder: makeIcon(["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"]),
  bell: makeIcon(["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"]),
  settings: makeIcon([{ t: "circle", a: { cx: 12, cy: 12, r: 3 } }, "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"]),
  dim: makeIcon(["M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"]),
  logout: makeIcon(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]),
  activity: makeIcon(["M22 12h-4l-3 9L9 3l-3 9H2"]),
  cpu: makeIcon([{ t: "rect", a: { x: 4, y: 4, width: 16, height: 16, rx: 2 } }, { t: "rect", a: { x: 9, y: 9, width: 6, height: 6 } }, "M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"]),
} as const;

export type IconName = keyof typeof Icons;
