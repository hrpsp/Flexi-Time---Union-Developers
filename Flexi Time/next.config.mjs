/** @type {import("next").NextConfig} */
const nextConfig = {
  // pdfjs-dist must not be bundled by webpack for server-side use.
  // It relies on Node.js native APIs and must run as an external package.
  serverExternalPackages: ["pdfjs-dist"],

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
    typescript: {
          ignoreBuildErrors: true,
    },
    eslint: {
          ignoreDuringBuilds: true,
    },
}

export default nextConfig
