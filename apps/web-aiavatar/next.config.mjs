/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  // 部署到 aistar.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3013
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

export default nextConfig;
