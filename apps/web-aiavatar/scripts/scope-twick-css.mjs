// Twick 的两份样式表（@twick/studio、@twick/video-editor）会改全局：`body` 的背景 / 字体，`:root` 上的
// `--color-gray-*` 等变量（和我们 Tailwind v4 的同名变量冲突），还自带 `.flex` `.gap-2` `.text-sm` 这类和
// Tailwind 同名的工具类。所以不直接引入，而是生成一份只在 `.twick-scope` 里生效的副本：
//   · 普通规则前加 `.twick-scope `；
//   · `:root` / `html` / `body` 换成 `.twick-scope`（变量也同时给挂到 body 上的右键菜单）；
//   · `twick-canvas-context-menu*` 是 Twick 用 createPortal 挂到 document.body 的菜单，保留原样。
// 升级 Twick 后重新跑：node apps/web-aiavatar/scripts/scope-twick-css.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const store = join(app, "../../node_modules/.pnpm");
const postcssDir = readdirSync(store).filter(d => /^postcss@8\./.test(d)).sort().pop();
const postcss = createRequire(import.meta.url)(join(store, postcssDir, "node_modules/postcss"));

const SCOPE = ".twick-scope";
const PORTAL = ".twick-canvas-context-menu";
const scopeSelector = selector => {
  const s = selector.trim();
  if (s === ":root" || s === "html" || s === "body") return `${SCOPE}, ${PORTAL}`;
  if (s.startsWith(PORTAL)) return s;
  return `${SCOPE} ${s.replace(/^(html|body)\s+/, "")}`;
};
const sources = ["@twick/video-editor/dist/video-editor.css", "@twick/studio/dist/studio.css"];
const out = [];
for (const source of sources) {
  const css = readFileSync(join(app, "node_modules", source), "utf8");
  const root = postcss.parse(css, { from: source });
  root.walkRules(rule => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    rule.selectors = rule.selectors.map(scopeSelector);
  });
  out.push(`/* ${source} — scoped to ${SCOPE} by scripts/scope-twick-css.mjs */\n${root.toString()}`);
}
const version = JSON.parse(readFileSync(join(app, "node_modules/@twick/studio/package.json"), "utf8")).version;
writeFileSync(join(app, "src/styles/twick-scoped.css"), `/* 生成文件，勿手改。Twick ${version} 的样式，只在 ${SCOPE} 内生效。 */\n${out.join("\n")}`);
console.log(`wrote src/styles/twick-scoped.css (Twick ${version})`);
