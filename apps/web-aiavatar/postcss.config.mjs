// Tailwind v4 —— 只为 src/styles/ip-desktop.css（AI IP 工作台桌面面）服务。
// 本 app 其余部分是手写 CSS（src/styles/globals.css，1000+ 行），**没有 reset**，
// 所以 ip-desktop.css 刻意不引 Tailwind 的 preflight。理由与实测数据见那个文件的头注释。
// 注意这个插件会过一遍本 app 所有 CSS，包括 globals.css —— 它对不含 Tailwind
// at-rule 的文件应当原样透传，改动本文件后要复核 globals.css 的产物没有变化。
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
