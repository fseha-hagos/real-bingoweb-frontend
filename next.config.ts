import type { NextConfig } from "next";

// const PRODUCTION_BACKEND_URL = "https://bingo-tg-bot-d1ca.onrender.com";
const PRODUCTION_BACKEND_URL = "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? PRODUCTION_BACKEND_URL
        : "http://localhost:3001");

    return [
      // Auth is handled by src/app/api/auth/[...all]/route.ts (cookie-safe proxy)
      {
        source: "/api/((?!auth/).*)",
        destination: `${backendUrl}/api/$1`,
      },
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
