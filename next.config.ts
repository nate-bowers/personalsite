import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake barrel-export-heavy client deps so only the used surface ships
  // (e.g. only `Html` from drei). Build-time only; rendered output is identical.
  experimental: {
    optimizePackageImports: [
      "@react-three/drei",
      "@react-three/fiber",
      "@react-three/postprocessing",
      "three",
      "motion",
    ],
  },
  // Strip stray console.* from the production bundle (keep error/warn).
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
};

export default nextConfig;
