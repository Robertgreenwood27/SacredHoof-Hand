/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public bucket (for practitioner-uploaded hero images)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
