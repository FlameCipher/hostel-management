import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:"/tenant/activate/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}]},
    {source:"/hostel-sw.js",headers:[{key:"Content-Type",value:"application/javascript; charset=utf-8"},{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"},{key:"X-Content-Type-Options",value:"nosniff"},{key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self'"}]},
    {source:"/open-app",headers:[{key:"Cache-Control",value:"private, no-store"}]},
  ];},
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
