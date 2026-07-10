import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native binaries / browser executables — let Next.js resolve
  // them from node_modules at runtime instead of trying to trace/bundle
  // them into the serverless function output.
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "sharp"],
  // serverExternalPackages above only stops the bundler from touching these
  // packages' JS — it doesn't make Vercel's separate file-tracing step copy
  // their non-JS assets (browsers.json, the compressed chromium binary) into
  // the deployed function. Those are loaded via dynamic requires the tracer
  // can't follow statically, so without this they're silently missing at
  // runtime ("Cannot find module .../browsers.json").
  outputFileTracingIncludes: {
    "/api/evaluate": ["./node_modules/playwright-core/**/*", "./node_modules/@sparticuz/chromium/**/*"],
    "/api/capture-preview": ["./node_modules/playwright-core/**/*", "./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
