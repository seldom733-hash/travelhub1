import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Summer (SAMO) searches take 25–55s (Playwright scrape). The default dev
  // proxy timeout is 30s and kills long price-calendar requests with ECONNRESET
  // → PDP "Уточнить цену" could never complete in the browser (HIMEROS E2E P0).
  experimental: {
    proxyTimeout: 120_000,
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
