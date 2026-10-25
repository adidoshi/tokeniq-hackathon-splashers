/**
 * Public runtime config. NEXT_PUBLIC_* vars are inlined at build time
 * (set them in .env.local locally, and in Vercel project settings for deploys).
 */
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const env = {
  apiUrl,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? `${apiUrl.replace(/^http/, "ws")}/ws`,
} as const;
