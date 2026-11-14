import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // TypeScript 5 provides the compiler API; avoid spawning a detached CLI
    // process during builds in restricted CI environments.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
