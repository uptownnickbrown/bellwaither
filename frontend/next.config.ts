import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return {
      // beforeFiles runs before Next.js API routes — skip it for onboarding
      beforeFiles: [],
      // afterFiles runs after Next.js API routes — use this for the proxy
      // so custom route handlers at /api/onboarding/* take priority
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
      // fallback is not needed
      fallback: [],
    };
  },
};

export default nextConfig;
