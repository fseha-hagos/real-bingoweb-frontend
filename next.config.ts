import type { NextConfig } from "next";

// const PRODUCTION_BACKEND_URL = "https://bingo-tg-bot-d1ca.onrender.com";
const PRODUCTION_BACKEND_URL = "https://real-bingoweb-backend.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? PRODUCTION_BACKEND_URL
        : "https://real-bingoweb-backend.onrender.com");

    return [
      // Player + auth APIs use Route Handlers (see src/app/api/**) so methods
      // like PATCH are forwarded correctly. Keep games/health rewrites only.
      {
        source: "/games",
        destination: `${backendUrl}/games`,
      },
      {
        source: "/games/:path*",
        destination: `${backendUrl}/games/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
