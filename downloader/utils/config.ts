export const config = {
  r2: {
    endpoint: requireEnv("R2_ENDPOINT"),
    accessKey: requireEnv("R2_ACCESS_KEY"),
    secretKey: requireEnv("R2_SECRET_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "",
  },
  keys: {
    manifest: "manifest.json",
    music: "music/",
    covers: "covers/",
  },
  download: {
    maxWorkers: 3, // parallel downloads
    audioFormat: "mp3",
    audioQuality: "320",
  },
} as const;

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}
