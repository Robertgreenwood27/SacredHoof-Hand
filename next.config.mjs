import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep output tracing scoped to this repository even when parent directories
  // contain unrelated lockfiles.
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      // Supabase Storage public bucket (for practitioner-uploaded hero images)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    const privatePageHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive",
      },
    ];
    return [
      {
        source: "/manage/:path*",
        headers: privatePageHeaders,
      },
      {
        source: "/book/success",
        headers: privatePageHeaders,
      },
    ];
  },
};

export default nextConfig;
