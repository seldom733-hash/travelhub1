import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // LAN-доступ к dev-серверу (10.20/22.10.x): без этого Next 16 блокирует
  // кросс-доменные dev-запросы (/_next/*) с чужих origin и страницы не грузятся.
  allowedDevOrigins: ["*", "*.trycloudflare.com", "10.1.10.*", "10.20.10.*", "10.22.10.*", "192.168.*", "localhost", "127.0.0.1"],
  // A live supplier search (KOMPAS/Summer) takes 60–150 s before the backend
  // answers. Next's rewrite proxy times out at 30 s by default, which returned
  // 500 to the browser and was rendered as "туры не найдены" on the first
  // (cold) search; a refresh after the backend had cached the answer worked.
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
