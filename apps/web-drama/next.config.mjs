/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 drama.aistar.com 根路径，无 basePath；本地 dev: localhost:3011
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
    ];
  },
  // 兼容遗留链接：旧 apps/web 时代 drama landing 挂在 /drama，新 sub-app
  // 独占子域后根路径就是 landing，把 /drama* 一律重定向回 / 避免 404。
  async redirects() {
    return [
      { source: "/drama", destination: "/", permanent: false },
      { source: "/drama/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
