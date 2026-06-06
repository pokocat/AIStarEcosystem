/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // 部署到 aiavatar.aibuzz.cn 根路径，无 basePath；本地 dev: localhost:3013
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
