/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 aiavatar.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3013
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
  transpilePackages: ["@ai-star-eco/types", "@ai-star-eco/api-client"],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      // 业务 API 反代到 Spring Boot server。
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
      // 后端把 AiAvatar 渲染产出 / 加密素材原文挂在 /static/aiavatar/** —— 代理到 server。
      { source: "/static/:path*", destination: `${apiBase}/static/:path*` },
    ];
  },
};

export default nextConfig;
