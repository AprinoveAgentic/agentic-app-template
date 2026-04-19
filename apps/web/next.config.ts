import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone", // Required for Docker multi-stage builds
};

export default config;
