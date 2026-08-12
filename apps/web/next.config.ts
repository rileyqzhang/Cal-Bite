import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // eslint-config-next is hoisted to the repo root while `next` stays in apps/web,
    // so the legacy .eslintrc parser path breaks during Vercel/monorepo builds.
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@berkeley-dining/shared"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,DELETE,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
