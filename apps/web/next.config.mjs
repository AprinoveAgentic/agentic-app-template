/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Transpile workspace packages so Next.js can consume TypeScript source directly
  transpilePackages: ["@app/shared"],
  // Allow the Next.js image optimizer to serve images from the API host
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
