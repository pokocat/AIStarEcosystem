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
  transpilePackages: [
    "@ai-star-eco/types",
    "@ai-star-eco/ui",
    "@ai-star-eco/api-client",
    "@ai-star-eco/landing",
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
      // AiAvatar 资产产出（图/视频/3D）挂在 /static/aiavatar-assets/** —— 代理到 server。
      { source: "/static/:path*", destination: `${apiBase}/static/:path*` },
    ];
  },
};

export default nextConfig;
