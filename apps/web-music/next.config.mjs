/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 music.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3010
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
  // 共享 packages/* 里的 TS/TSX 源码需要 Next 编译
  transpilePackages: [
    "@ai-star-eco/types",
    "@ai-star-eco/ui",
    "@ai-star-eco/api-client",
    "@ai-star-eco/landing",
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      // 前端 /api/* 请求代理到 Spring Boot 后端（同 apps/web 历史约定）。
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  // 注意：旧 apps/web 时代曾把 music landing 挂在 /music，但子域独立后根 / 就是
  // landing，且新工作台第二组 "音乐商业" tab 占用了 `/music` 顶层路径，因此该
  // redirect 已删除（保留会导致 /music → /，把工作台 tab 顶掉）。
};

export default nextConfig;
