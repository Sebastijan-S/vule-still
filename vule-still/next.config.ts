import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep production builds independent from a running local dev server.
  distDir: process.env.VULE_BUILD_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
