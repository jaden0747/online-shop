import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/addresses", destination: "/customers", permanent: true },
      { source: "/subscriptions", destination: "/customers", permanent: true },
    ];
  },
};

export default nextConfig;
