import dotenv from "dotenv";

dotenv.config({ path: ".env" });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),

  r2: {
    endpoint: requireEnv("R2_ENDPOINT"),
    accessKey: requireEnv("R2_ACCESS_KEY"),
    secretKey: requireEnv("R2_SECRET_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "",
  },

  // Optional API key to protect the endpoint
  // Set API_KEY env var — if not set, endpoint is open (fine for personal use)
  apiKey: process.env.API_KEY ?? null,

  keys: {
    manifest: "manifest.json",
    music: "music/",
    covers: "covers/",
  },

  download: {
    audioFormat: "mp3",
    audioQuality: "320",
    maxWorkers: 2,
  },
} as const;
