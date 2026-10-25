import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless", "pg", "bcryptjs"],
};

export default nextConfig;
