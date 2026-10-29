import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
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
