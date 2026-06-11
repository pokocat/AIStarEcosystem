/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 star.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3014
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  transpilePackages: [
    "@ai-star-eco/types",
    "@ai-star-eco/ui",
    "@ai-star-eco/api-client",
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      // server 静态产出（fake-CDN /cdn、渲染产物 /static）代理到 8080。
      {
        source: "/static/:path*",
        destination: `${apiBase}/static/:path*`,
      },
      {
        source: "/cdn/:path*",
        destination: `${apiBase}/cdn/:path*`,
      },
    ];
  },
};

export default nextConfig;
