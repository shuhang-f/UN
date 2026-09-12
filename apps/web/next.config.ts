import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  // agent-core is a workspace package shipped as TypeScript source.
  transpilePackages: ["agent-core"],
};

export default nextConfig;
