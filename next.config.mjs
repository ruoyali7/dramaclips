const remotePatterns = [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "v-img.crazymaplestudios.com" },
  { protocol: "https", hostname: "**.r2.dev" }
];

try {
  const r2Public = new URL(process.env.R2_PUBLIC_BASE_URL || "");
  if (r2Public.protocol === "https:") remotePatterns.push({ protocol: "https", hostname: r2Public.hostname });
} catch {
  // R2 is optional in local environments; production provides this URL.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { remotePatterns },
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@yixiaoermail/cli/**/*"]
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ] }];
  }
};
export default nextConfig;
