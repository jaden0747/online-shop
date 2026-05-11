import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "dist/**",
      "data/**",
      ".git/**",
      "scripts/**",
      "**/*.md",
      "**/*.py",
      "**/*.sh",
      "**/*.db",
      "**/*.tsbuildinfo",
      "package-lock.json",
    ],
  },
  async redirects() {
    return [
      { source: "/addresses", destination: "/customers", permanent: true },
      { source: "/subscriptions", destination: "/customers", permanent: true },
    ];
  },
};

export default nextConfig;
