/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_EXPORT === "true" ? { output: "export" } : {}),
  serverExternalPackages: ["firebase-admin"],
  async rewrites() {
    return [
      {
        source: "/api/flutterwave/:path*",
        destination: "https://etechglobalhub.duckdns.org/api/flutterwave/:path*",
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "e-global-tech-kano.vercel.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
