/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 celebrity.aistar.com 根路径，无 basePath；本地 dev: localhost:3012
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
  transpilePackages: [
    "@ai-star-eco/types",
    "@ai-star-eco/ui",
    "@ai-star-eco/api-client",
    "@ai-star-eco/landing",
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      // 后端把 ffmpeg 渲染产出挂在 /static/mixcut/<jobId>/v<N>.mp4 —— 代理到 server。
      {
        source: "/static/:path*",
        destination: `${apiBase}/static/:path*`,
      },
    ];
  },
  // 兼容遗留链接：
  // - /celebrity → / （旧 apps/web 把 landing 挂在 /celebrity，新 sub-app 子域根就是 landing）
  // - /producer/celebrity-zone/:path* → /console/:path* （Phase 4b 把工作台从 /producer/celebrity-zone 搬到 /console）
  async redirects() {
    return [
      { source: "/celebrity", destination: "/", permanent: false },
      { source: "/producer/celebrity-zone", destination: "/console", permanent: false },
      { source: "/producer/celebrity-zone/:path*", destination: "/console/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
