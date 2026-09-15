import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Summer (SAMO) searches with 31-day windows take 25–55s per window.
  // 6-month horizon = ~6 windows × 2 programs = up to 5 min total.
  // Set proxy timeout to 5 min to cover full horizon search.
  experimental: {
    proxyTimeout: 300_000,
  },
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
