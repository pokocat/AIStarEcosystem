/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: "/web",
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || 'http://localhost:8080';
    return [
      // 将前端 /api/* 请求代理到 Spring Boot 后端
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
