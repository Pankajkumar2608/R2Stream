import type { Env, Manifest, Track, TrackResponse } from "./types.js";

const MANIFEST_KEY = "manifest.json";

//  Load manifest from R2 
// Workers are stateless per request — we fetch fresh each time.
// R2 GET is fast (~10ms within Cloudflare network).

export async function loadManifest(env: Env): Promise<Manifest> {
  const obj = await env.BUCKET.get(MANIFEST_KEY);
  if (!obj) {
    return { lastUpdated: null, trackCount: 0, tracks: {}, failed: {} };
  }
  return obj.json<Manifest>();
}

//  Build public URLs 

export function buildTrackResponse(
  track: Track,
  env: Env,
  baseUrl: string,
): TrackResponse {
  const pub = env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

  return {
    ...track,
    // Stream URL goes through our Worker (so we can add headers, auth later)
    streamUrl: `${baseUrl}/stream/${track.id}`,
    // Cover URL points directly at R2 public bucket (no auth needed for images)
    coverUrl: pub && track.coverKey ? `${pub}/${track.coverKey}` : null,
    fileUrl: pub && track.fileKey ? `${pub}/${track.fileKey}` : null,
  };
}

//  Sort tracks by date added (newest first) 

export function sortedTracks(manifest: Manifest): Track[] {
  return Object.values(manifest.tracks).sort((a, b) =>
    (b.added ?? "").localeCompare(a.added ?? ""),
  );
}
