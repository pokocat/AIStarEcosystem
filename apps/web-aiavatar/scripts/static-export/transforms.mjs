// Source changes that turn a throwaway checkout of web-aiavatar into a static demo build.
// Every edit matches an exact anchor and throws when it is gone: a silent miss would ship a page that hits a dead API.
import fs from "node:fs";
import path from "node:path";

const read = (f) => fs.readFileSync(f, "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

function edit(file, change) {
  const before = read(file);
  const after = change(before);
  if (after === before) throw new Error(`没有改动：${file}`);
  write(file, after);
}

/** Exact-string replacement that fails loudly when the source moved on. */
function swap(source, anchor, replacement, file) {
  if (!source.includes(anchor)) throw new Error(`源码变了，请更新 scripts/static-export/transforms.mjs：\n  ${file}\n  找不到：${anchor.slice(0, 90)}`);
  return source.replace(anchor, () => replacement);
}

function swapPattern(source, pattern, replacement, file) {
  if (!pattern.test(source)) throw new Error(`源码变了，请更新 scripts/static-export/transforms.mjs：\n  ${file}\n  找不到：${pattern}`);
  return source.replace(pattern, replacement);
}

function nextConfig(app) {
  const file = path.join(app, "next.config.mjs");
  edit(file, (s) => {
    s = swap(s, 'output: "standalone",', 'output: "export",\n  images: { unoptimized: true },\n  typescript: { ignoreBuildErrors: true },', file);
    // Headers and rewrites don't exist in a static export.
    return swapPattern(s, /async headers\(\) \{[\s\S]*?\n  \},\n  async rewrites\(\) \{[\s\S]*?\n  \},\n\};/, "};", file);
  });
}

function findDynamicPages(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findDynamicPages(full, found);
    else if (entry.name === "page.tsx" && full.includes("[")) found.push(full);
  }
  return found;
}

/**
 * One prebuilt shell per dynamic route; the page reads the real value from the address bar, and serve.py maps any id to
 * the shell. Returns the URL patterns for serve.py.
 */
function dynamicRoutes(app) {
  const appDir = path.join(app, "src/app");
  const routes = [];
  for (const pageFile of findDynamicPages(appDir)) {
    const dir = path.dirname(pageFile);
    const segments = path.relative(appDir, dir).split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
    const dynamic = segments.filter((s) => s.startsWith("["));
    if (dynamic.length !== 1 || dynamic[0].startsWith("[...") || dynamic[0].startsWith("[[")) throw new Error(`只支持带一个普通参数的路由：${pageFile}`);
    const param = dynamic[0].slice(1, -1);
    const index = segments.indexOf(dynamic[0]) + 1; // location.pathname starts with "/", so segment 0 is empty

    let source = read(pageFile);
    if (!/^\s*["']use client["']/.test(source)) {
      // A server wrapper that only awaits params: same page as a client component (metadata can't live there).
      source = source
        .replace(/export const metadata\s*:\s*Metadata\s*=\s*\{[\s\S]*?\};\n?/, "")
        .replace("export default async function", "export default function")
        .replaceAll("await params", "use(params)");
      if (/\bawait\b|export const metadata/.test(source)) throw new Error(`这个服务端页面不只是等 params，脚本转不了：${pageFile}`);
      source = `"use client";\nimport { use } from "react";\n${source}`;
    }
    write(path.join(dir, "original-page.tsx"), source);
    write(path.join(dir, "shell.tsx"), `"use client";
import { useMemo } from "react";
import Original from "./original-page";
import { useRouteSegment } from "@/static-export/route-segment";
export default function Shell() {
  const value = useRouteSegment(${index});
  // Already settled, so use() in the page never suspends inside the synchronous re-render.
  const params = useMemo(() => Object.assign(Promise.resolve({ ${param}: value }), { status: "fulfilled", value: { ${param}: value } }), [value]);
  if (!value) return null;
  return <Original key={value} params={params as never} />;
}
`);
    write(pageFile, `import Shell from "./shell";
export function generateStaticParams() { return [{ ${param}: "_" }]; }
export default function Page() { return <Shell />; }
`);
    routes.push("/" + segments.join("/"));
  }
  if (!routes.length) throw new Error("没有找到带参数的页面");
  return routes;
}

/** A server page can't read the query in a static export; forward it from the browser instead. */
function ipsRedirect(app) {
  const file = path.join(app, "src/app/ips/page.tsx");
  if (!read(file).includes("searchParams")) throw new Error(`源码变了，请更新 transforms.mjs：${file}`);
  write(file, `"use client";
import { useEffect } from "react";
export default function IpManagementPage() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set("tab", "ips");
    window.location.replace(\`/assets?\${query}\`);
  }, []);
  return null;
}
`);
}

function layout(app) {
  const file = path.join(app, "src/app/layout.tsx");
  edit(file, (s) => {
    s = swap(s, "import { StudioNotifications } from", 'import { MockBoot } from "@/static-export/mock-boot";\nimport { StudioNotifications } from', file);
    s = swap(s, "        <link rel=\"stylesheet\" href={FONTS_HREF} />\n", "", file);
    return swapPattern(s, /(<body[^>]*>)/, "$1<MockBoot fonts={FONTS_HREF} />", file);
  });
}

/** Writes without a sample response explain themselves instead of surfacing a raw 404. */
function apiClient(root) {
  const client = path.join(root, "packages/api-client/src/_client.ts");
  const anchor = "      return (await match.handler({ params: match.params, query, body })) as T;\n    }\n  }\n";
  edit(client, (s) => swap(s, anchor, `      return (await match.handler({ params: match.params, query, body })) as T;
    }
    if (method !== "GET") throw new ApiError({ code: "STATIC_DEMO", message: "静态演示版不能执行这项操作，这里只用来看界面。" }, 400);
  }
`, client));
  const enterprise = path.join(root, "packages/api-client/src/api/enterprise.ts");
  edit(enterprise, (s) => {
    const head = "export async function previewInvitation(token: string, signal?: AbortSignal): Promise<EnterpriseInvitationPreview> {\n";
    s = swap(s, head, head + '  if (USE_MOCK) return { enterpriseId: "sample-enterprise", enterpriseName: "示例企业", expiresAt: "2027-02-01T00:00:00Z" };\n', enterprise);
    return swap(s, "API_BASE_URL } from \"../_client\";", "API_BASE_URL, USE_MOCK } from \"../_client\";", enterprise);
  });
}

/** The invitation page needs the account centre; show the valid-invitation state. */
function invitation(app) {
  const file = path.join(app, "src/ip/invitation-registration.tsx");
  edit(file, (s) => swap(s, 'if (!isIdMode()) { setPreview("error"); return; }', 'if (!isIdMode()) { setInviter("周敏"); setPreview("valid"); return; }', file));
}

/** Director: a sample work; anything that would generate says it is unavailable here. */
function director(app) {
  const file = path.join(app, "src/ip/api/director.ts");
  const notFound = 'throw new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404)';
  edit(file, (d) => {
    d = swap(d, 'import { ApiError } from "@ai-star-eco/api-client";', 'import { ApiError } from "@ai-star-eco/api-client";\nimport { fixtureCreate, fixtureEstimate, fixturePatch, fixtureQuote, fixtureSummaries, fixtureWork } from "@/static-export/director-fixture";', file);
    d = swap(d, '"演示模式不支持短剧导演台，请登录后使用。"', '"静态演示版不能执行这项操作，这里只用来看界面。"', file);
    d = swap(d, "if (USE_MOCK) return mockDelay([]);\n  return apiFetch<DirectorWorkSummary[]>", "if (USE_MOCK) return mockDelay(fixtureSummaries());\n  return apiFetch<DirectorWorkSummary[]>", file);
    d = swap(d, 'Promise<DirectorWork> {\n  if (USE_MOCK) demoUnavailable();\n  return apiFetch<DirectorWork>("/v1/ip-studio/director/works", { method: "POST"', 'Promise<DirectorWork> {\n  if (USE_MOCK) return mockDelay(fixtureCreate(body));\n  return apiFetch<DirectorWork>("/v1/ip-studio/director/works", { method: "POST"', file);
    d = swap(d, "export async function getWork(id: string): Promise<DirectorWork> {\n  if (USE_MOCK) demoUnavailable();", `export async function getWork(id: string): Promise<DirectorWork> {\n  if (USE_MOCK) { const w = fixtureWork(id); if (!w) ${notFound}; return mockDelay(w); }`, file);
    d = swapPattern(d, /(export async function patchWork\([\s\S]*?Promise<DirectorWork> \{\n)  if \(USE_MOCK\) demoUnavailable\(\);/, `$1  if (USE_MOCK) { const w = fixturePatch(id, body); if (!w) ${notFound}; return mockDelay(w); }`, file);
    d = swapPattern(d, /(export async function estimatePipeline\([\s\S]*?\{\n)  if \(USE_MOCK\) demoUnavailable\(\);/, "$1  if (USE_MOCK) return mockDelay(fixtureEstimate(body.target));", file);
    return swapPattern(d, /(export async function quote\([\s\S]*?\{\n)  if \(USE_MOCK\) demoUnavailable\(\);/, "$1  if (USE_MOCK) return mockDelay(fixtureQuote(targetIds));", file);
  });
}

/** Canvases survive a reload; the mock store is otherwise memory-only and a just-made canvas would read as "not found". */
function canvasStore(app) {
  const file = path.join(app, "src/ip/mocks/ip-studio.ts");
  edit(file, (s) => swap(s, "export function mockStore(): MockStore {\n  if (!store) store = seedStore();\n  return store;\n}", `const STATIC_STORE_KEY = "studio-static-export-store-v1";
export function mockStore(): MockStore {
  if (!store) {
    store = seedStore();
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem(STATIC_STORE_KEY) || "null");
        if (saved) { store.projects = new Map(saved.projects); store.seq = saved.seq; }
      } catch { /* start from the samples */ }
      window.addEventListener("pagehide", () => {
        try { localStorage.setItem(STATIC_STORE_KEY, JSON.stringify({ projects: [...store!.projects], seq: store!.seq })); } catch { /* too large: keep the session only */ }
      });
    }
  }
  return store;
}`, file));
}

/** The assistant says "done": show a result on the canvas. */
function dialogueResults(app) {
  const file = path.join(app, "src/ip/mocks/studio-dialogue.ts");
  edit(file, (s) => {
    const anchor = '  else if (type === "text") { studio.kind = "text"; metadata.content = run.output.textRevision?.content ?? run.output.text ?? ""; }\n';
    s = swap(s, anchor, anchor + '  else if (type === "image") metadata.content = mockPlaceholderImage(s.title, s.title.length);\n  else if (type === "video") metadata.content = "/sample-video.mp4";\n', file);
    return /import \{[^}]*mockPlaceholderImage/.test(s) ? s : swapPattern(s, /^import /m, 'import { mockPlaceholderImage } from "./ip-studio";\nimport ', file);
  });
}

/** The full scene catalogue instead of the five in the normal demo mode. */
function scenes(root, app) {
  fs.copyFileSync(path.join(root, "apps/server/src/main/resources/ipstudio/scenes.json"), path.join(app, "src/static-export/scenes.json"));
  const file = path.join(app, "src/ip/mocks/scenes.ts");
  edit(file, (s) => {
    s = swapPattern(s, /export const MOCK_SCENES: StudioSceneCatalog = \{[\s\S]*?\n\};\n/, "export const MOCK_SCENES = realCatalog as unknown as StudioSceneCatalog;\n", file);
    return 'import realCatalog from "@/static-export/scenes.json";\n' + s;
  });
}

/** Applies every change; returns the dynamic route patterns for serve.py. */
export function applyTransforms(root, overlayDir) {
  const app = path.join(root, "apps/web-aiavatar");
  fs.cpSync(overlayDir, path.join(app, "src/static-export"), { recursive: true });
  nextConfig(app);
  const routes = dynamicRoutes(app);
  ipsRedirect(app);
  layout(app);
  apiClient(root);
  invitation(app);
  director(app);
  canvasStore(app);
  dialogueResults(app);
  scenes(root, app);
  // The font route needs a server; export.mjs downloads the files into public/ at the same paths instead.
  fs.rmSync(path.join(app, "src/app/ip-fonts"), { recursive: true, force: true });
  return routes;
}
