import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async redirects() {
    return [{ source: "/about/:path*", destination: "/wiki/:path*", permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.ppy.sh",
        port: "",
        pathname: "/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "assets.ppy.sh",
        port: "",
        pathname: "/beatmaps/**",
      },
    ],
  },

  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  devIndicators: false,
};

export default nextConfig;
