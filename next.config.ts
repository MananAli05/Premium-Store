import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseSocket = supabaseUrl.replace(/^https:/, "wss:");
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Cloudflare adds its Web Analytics beacon to every page on the live site.
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl} https://res.cloudinary.com`,
  "font-src 'self' data:",
  // data: and blob: let the app turn a picked image into a file before uploading it.
  `connect-src 'self' data: blob: ${supabaseUrl} ${supabaseSocket} https://api.cloudinary.com https://cloudflareinsights.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Keeps every page, image and file out of Google and other search engines; customers come by direct link.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
