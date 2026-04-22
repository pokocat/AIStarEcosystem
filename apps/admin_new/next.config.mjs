/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: "/admin_new",
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
