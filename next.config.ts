import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native binaries / browser executables — let Next.js resolve
  // them from node_modules at runtime instead of trying to trace/bundle
  // them into the serverless function output.
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "sharp"],
};

export default nextConfig;
