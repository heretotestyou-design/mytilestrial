import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "https://*.supabase.co";
const supabaseWs = supabase.replace(/^http/, "ws");

// Razorpay Checkout: its script, the payment iframe, its API/telemetry and bank logos.
const razorpay = {
  script: "https://checkout.razorpay.com",
  frame: "https://api.razorpay.com https://checkout.razorpay.com",
  connect: "https://api.razorpay.com https://lumberjack.razorpay.com",
  img: "https://cdn.razorpay.com",
};

// Content Security Policy: only our own code, Supabase, Razorpay, and the model CDNs.
// 'unsafe-inline' scripts are needed by Next.js without nonces; 'wasm-unsafe-eval' by the
// in-browser depth model (WebAssembly). Dev additionally needs eval + the HMR websocket.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net ${razorpay.script}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} ${razorpay.img}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs} https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co ${razorpay.connect}${isDev ? " ws: http://localhost:*" : ""}`,
  `frame-src 'self' ${razorpay.frame}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: 'camera=(self), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com"), usb=(), interest-cohort=()' },
  // Bank / 3-D Secure pages open in popups that must be able to report back to Razorpay.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the Next.js "N" dev-tools badge (it only ever shows in `next dev`).
  devIndicators: false,
  // Lets a production build run beside `next dev` (NEXT_DIST_DIR=.next-build npm run build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
