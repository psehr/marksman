import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.ppy.sh",
        port: "",
        pathname: "/beatmaps/**",
      },
      {
        protocol: "https",
        hostname: "a.ppy.sh",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "osu.ppy.sh",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
