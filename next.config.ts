import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Integration SDKs run only on the server and are loaded by Node at runtime.
  serverExternalPackages: ["@composio/core", "parallel-web"],
};

export default nextConfig;
