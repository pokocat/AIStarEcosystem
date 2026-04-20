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
      // 将前端 /api/* 请求代理到 Spring Boot 后端。
      // basePath: false 让 rewrite 不受 basePath="/web" 影响，保持裸 /api/* 路径，
      // 与线上 Nginx 直接转发 /api/* 的行为一致。
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
