import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Проксирование REST API модульного монолита: /api/v1 → backend (port 4000)
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
