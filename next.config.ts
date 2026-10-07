import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:"/tenant/activate/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}]}];},
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
