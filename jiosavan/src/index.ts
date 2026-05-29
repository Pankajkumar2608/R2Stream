import { Hono } from "hono";
import { resolveSaavnUrl, searchSong, type SaavnSong } from "./client.js";
import { resolveAnyUrl } from "./metadata.js";

// Env bindings
export interface Env {
  BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  await next();
  Object.entries(corsHeaders).forEach(([k, v]) => c.res.headers.set(k, v));
});

// Helpers for R2 Manifest
async function getManifest(env: Env) {
  const obj = await env.BUCKET.get("manifest.json");
  if (!obj) return { lastUpdated: null, trackCount: 0, tracks: {}, failed: {} };
  return await obj.json() as any;
}

async function saveManifest(env: Env, manifest: any) {
  manifest.lastUpdated = new Date().toISOString();
  manifest.trackCount = Object.keys(manifest.tracks).length;
  await env.BUCKET.put("manifest.json", JSON.stringify(manifest));
}

// Fetch with timeout (JioSaavn CDN can hang)
async function fetchWithTimeout(url: string, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Background Task
async function processDownloads(urls: string[], env: Env) {
  try {
    const songsToDownload: SaavnSong[] = [];

    // 1. Resolve URLs to SaavnSongs
    for (const url of urls) {
      console.log(`[RESOLVE] Processing URL: ${url}`);
      try {
        if (url.includes("jiosaavn.com")) {
          const songs = await resolveSaavnUrl(url);
          console.log(`[RESOLVE] Found ${songs.length} songs from JioSaavn URL`);
          songsToDownload.push(...songs);
        } else {
          const queries = await resolveAnyUrl(url);
          console.log(`[RESOLVE] Extracted ${queries.length} search queries: ${queries.join(", ")}`);
          for (const q of queries) {
            console.log(`[SEARCH] Searching JioSaavn for: "${q}"`);
            const song = await searchSong(q);
            if (song) {
              console.log(`[SEARCH] Found: "${song.title}" by ${song.artist}`);
              console.log(`[SEARCH] Download URL: ${song.downloadUrl}`);
              songsToDownload.push(song);
            } else {
              console.log(`[SEARCH] No results for: "${q}"`);
            }
          }
        }
      } catch (err: any) {
        console.error(`[RESOLVE] Error resolving ${url}: ${err.message}`);
      }
    }

    console.log(`[SYNC] Total songs to download: ${songsToDownload.length}`);
    if (songsToDownload.length === 0) {
      console.log("[SYNC] Nothing to download, exiting.");
      return;
    }

    // 2. Load Manifest
    const manifest = await getManifest(env);
    console.log(`[SYNC] Current manifest has ${Object.keys(manifest.tracks).length} tracks`);

    // 3. Download and Save each song
    for (const song of songsToDownload) {
      const trackId = `js_${song.id}`;
      if (manifest.tracks[trackId]) {
        console.log(`[SKIP] "${song.title}" already in library`);
        continue;
      }

      try {
        console.log(`[DOWNLOAD] Starting audio download: "${song.title}"`);
        console.log(`[DOWNLOAD] URL: ${song.downloadUrl}`);

        // Fetch audio as ArrayBuffer (not streaming body — avoids CF Worker hanging)
        const audioRes = await fetchWithTimeout(song.downloadUrl);
        console.log(`[DOWNLOAD] Audio response: ${audioRes.status} ${audioRes.statusText}, Content-Length: ${audioRes.headers.get("content-length")}`);

        if (!audioRes.ok) {
          throw new Error(`Audio fetch failed: ${audioRes.status} ${audioRes.statusText}`);
        }

        const audioBuffer = await audioRes.arrayBuffer();
        console.log(`[DOWNLOAD] Audio downloaded: ${(audioBuffer.byteLength / 1024).toFixed(1)} KB`);

        const fileKey = `music/${trackId}.m4a`;
        await env.BUCKET.put(fileKey, audioBuffer, {
          httpMetadata: { contentType: "audio/mp4" },
        });
        console.log(`[R2] Uploaded audio: ${fileKey}`);

        // Fetch Cover Image
        let coverKey: string | null = null;
        if (song.imageUrl) {
          try {
            console.log(`[DOWNLOAD] Fetching cover: ${song.imageUrl}`);
            const imgRes = await fetchWithTimeout(song.imageUrl, 10000);
            if (imgRes.ok) {
              const imgBuffer = await imgRes.arrayBuffer();
              coverKey = `covers/${trackId}.jpg`;
              await env.BUCKET.put(coverKey, imgBuffer, {
                httpMetadata: { contentType: "image/jpeg" },
              });
              console.log(`[R2] Uploaded cover: ${coverKey}`);
            }
          } catch (imgErr: any) {
            console.warn(`[DOWNLOAD] Cover fetch failed (non-critical): ${imgErr.message}`);
          }
        }

        // Add to manifest
        manifest.tracks[trackId] = {
          id: trackId,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          fileKey,
          coverKey,
          fileUrl: null,
          coverUrl: null,
          sizeBytes: audioBuffer.byteLength,
          added: new Date().toISOString().split("T")[0],
        };

        await saveManifest(env, manifest);
        console.log(`[SUCCESS] "${song.title}" added to library! (Total: ${Object.keys(manifest.tracks).length})`);
      } catch (err: any) {
        console.error(`[FAIL] "${song.title}": ${err.message}`);
        manifest.failed = manifest.failed || {};
        manifest.failed[trackId] = {
          title: song.title,
          error: err.message,
          attempted: new Date().toISOString(),
        };
        await saveManifest(env, manifest);
      }
    }

    console.log(`[SYNC] Done! Library now has ${Object.keys(manifest.tracks).length} tracks.`);
  } catch (err: any) {
    console.error(`[CRITICAL] Background sync crashed: ${err.message}`, err.stack);
  }
}

// API Routes

app.post("/download", async (c) => {
  let body: { urls?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return c.json({ ok: false, error: "Requires urls array" }, 400);
  }

  // Pass to background
  c.executionCtx.waitUntil(processDownloads(body.urls, c.env));

  return c.json({
    ok: true,
    message: "Downloads queued! They will appear in the library soon.",
    queuedUrls: body.urls.length,
  });
});

// Debug endpoint - test search without downloading
app.get("/test-search", async (c) => {
  const q = c.req.query("q") || "";
  if (!q) return c.json({ error: "Pass ?q=song+name" }, 400);

  try {
    const song = await searchSong(q);
    if (!song) return c.json({ found: false, query: q });

    return c.json({
      found: true,
      title: song.title,
      artist: song.artist,
      album: song.album,
      downloadUrl: song.downloadUrl,
      imageUrl: song.imageUrl,
      duration: song.duration,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Debug endpoint - test download of a single URL
app.get("/test-download", async (c) => {
  const url = c.req.query("url") || "";
  if (!url) return c.json({ error: "Pass ?url=https://..." }, 400);

  try {
    const res = await fetchWithTimeout(url, 15000);
    const body = await res.arrayBuffer();
    return c.json({
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
      actualBytes: body.byteLength,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/", (c) => c.json({ service: "musync-downloader", status: "running" }));

export default app;
