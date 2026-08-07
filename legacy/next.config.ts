import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * В dev-режиме Next.js блокирует кросс-ориджин запросы к dev-only эндпоинтам
   * (в т.ч. HMR WebSocket /_next/webpack-hmr). Без этого сайт, открытый по IP
   * (http://10.22.10.34:3000), получает отказ WebSocket-апгрейда, из-за чего
   * клиентский JS не исполняется: пропадают кнопки «Войти/Регистрация»,
   * не работают фильтры и форма входа в /admin.
   * Разрешаем доступ с локальной сети (IP этой машины + подстановка localhost).
   */
  allowedDevOrigins: [
    "10.22.10.34",
    "*.local",
    "localhost",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
