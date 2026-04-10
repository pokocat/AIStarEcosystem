/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    typedRoutes: false
  }
};

export default nextConfig;
