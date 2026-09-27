import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.CLOUDFLARE_PAGES === "1" ? "export" : undefined,
};

export default nextConfig;
