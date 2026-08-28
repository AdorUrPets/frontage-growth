import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray package.json in C:\Users\GGPC otherwise makes Next.js infer the
  // wrong workspace root and warn about the ignored lockfile there.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
