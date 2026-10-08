import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve this repository's existing AGENTS.md during development.
  agentRules: false,
};

export default nextConfig;
