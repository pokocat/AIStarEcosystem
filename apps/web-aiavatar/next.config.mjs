import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Isolated local acceptance can coexist with another task's dev server.
  distDir: process.env.AEP_NEXT_DIST_DIR || ".next",
  // Local preview surfaces can use the loopback IP as their request origin.
  // Allow both loopback hosts so Next's development resource guard does not block page scripts.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  output: "standalone",
  poweredByHeader: false,
  // Media imports accept 128 MiB plus multipart headers, and may normalize codecs before returning.
  // Next's 10 MiB / 30s proxy defaults otherwise reject valid uploads in rewrite-based deployments.
  experimental: { proxyClientMaxBodySize: '130mb', proxyTimeout: 180_000 },
  // v0.149：统一账号中心接入 —— 复用共享包的 OIDC/PKCE 与开通门（源码需 Next 编译）。
  // 注意本 app 的屏幕层仍是自带的 src/proto/*，只借用 auth 相关能力。
  transpilePackages: [
    "@ai-star-eco/types",
    "@ai-star-eco/ui",
    "@ai-star-eco/api-client",
    "@ai-star-eco/landing",
  ],
  // 部署到 aistar.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3013
  // 2026-11-10 账号区统一到 /me 下面（设计稿「账号区（三）」）。旧地址永久跳转，书签和外部链接不失效。
  // 对外分享的 /invite/{code}、/enterprise/invite、/card/p/… 不在这里，地址不变。
  async redirects() {
    return [
      { source: "/invitations", destination: "/me/invitations", permanent: true },
      { source: "/enterprise", destination: "/me/enterprise", permanent: true },
      { source: "/licenses", destination: "/me/authorization", permanent: true },
      { source: "/model-results", destination: "/me/tasks", permanent: true },
      { source: "/cards", destination: "/assets/cards", permanent: true },
      { source: "/cards/:id/edit", destination: "/assets/cards/:id/edit", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/generated/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/plaza/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/mediapipe/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      // dev fake-CDN（aep.cdn.driver=local 时生成产物的 /cdn/<key>）
      {
        source: "/cdn/:path*",
        destination: `${apiBase}/cdn/:path*`,
      },
      // server 静态资源兜底（/static/files 等）
      {
        source: "/static/:path*",
        destination: `${apiBase}/static/:path*`,
      },
    ];
  },
};

// Local development only: Next 16.2.6 otherwise retains 5 recent pages for 60s.
// Keep the active page and a recent neighbour; revisiting an evicted route recompiles it.
// Radix's umbrella entry imports all primitives even when Studio only uses Select.
// Production settings stay identical; no vendor cache-plugin internals are patched.
export default (phase) => phase === PHASE_DEVELOPMENT_SERVER ? {
  ...nextConfig,
  onDemandEntries: { maxInactiveAge: 25_000, pagesBufferLength: 2 },
  experimental: {
    ...nextConfig.experimental,
    optimizePackageImports: ["radix-ui"],
  },
} : nextConfig;
