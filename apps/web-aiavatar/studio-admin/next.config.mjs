const basePath = process.env.NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH || "";
if (basePath && (!basePath.startsWith("/") || basePath.endsWith("/"))) {
  throw new Error("NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH must start with / and have no trailing slash");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  basePath,
  transpilePackages: ["@ai-star-eco/types", "@ai-star-eco/ui"],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_SERVER_API_BASE || "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${apiBase}/api/:path*`, basePath: false }];
  },
};
export default nextConfig;
