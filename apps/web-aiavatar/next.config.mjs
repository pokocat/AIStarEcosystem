/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 aistar.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3013
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
