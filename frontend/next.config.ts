import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Standard Next.js config compatible with Vercel, Netlify, Render, and Docker */
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
