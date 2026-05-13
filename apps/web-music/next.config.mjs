/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 music.aistar.com 根路径，无 basePath；本地 dev: localhost:3010
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
  // 兼容遗留链接：旧 apps/web 时代 music landing 挂在 /music，新 sub-app
  // 独占子域后根路径就是 landing，把 /music* 一律重定向回 / 避免 404。
  async redirects() {
    return [
      { source: "/music", destination: "/", permanent: false },
      { source: "/music/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
