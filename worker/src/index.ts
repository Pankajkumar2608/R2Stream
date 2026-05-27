import { Hono } from "hono";
import { cors } from "hono/cors";
import { cache } from "hono/cache";

import type { Env } from "./types.js";
import { loadManifest, buildTrackResponse, sortedTracks } from "./manifest.js";
import { triggerSync } from "./github.js";

const app = new Hono<{ Bindings: Env }>();

//  CORS 
app.use(
  "*",
  cors({
    origin: ["*"]
  }),
);

//  Helpers

function json<T>(data: T, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

// Base URL of this worker (used to build streamUrl)
function baseUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

//  GET / — health check 

app.get("/", (c) => {
  return json({
    ok: true,
    service: "musync-api",
    version: "1.0.0",
    endpoints: [
      "GET  /tracks",
      "GET  /tracks/:id",
      "GET  /stream/:id",
      "GET  /search?q=",
      "GET  /status",
      "POST /trigger",
    ],
  });
});

//  GET /tracks — list all tracks ─

app.get("/tracks", async (c) => {
  const manifest = await loadManifest(c.env);
  const tracks = sortedTracks(manifest);
  const base = baseUrl(c.req.raw);

  // Optional pagination
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const start = (page - 1) * limit;
  const paged = tracks.slice(start, start + limit);

  return json({
    tracks: paged.map((t) => buildTrackResponse(t, c.env, base)),
    total: tracks.length,
    page,
    limit,
    pages: Math.ceil(tracks.length / limit),
    lastUpdated: manifest.lastUpdated,
  });
});

//  GET /tracks/:id — single track ─

app.get("/tracks/:id", async (c) => {
  const id = c.req.param("id");
  const manifest = await loadManifest(c.env);
  const track = manifest.tracks[id];

  if (!track) return err("Track not found", 404);

  return json(buildTrackResponse(track, c.env, baseUrl(c.req.raw)));
});

//  GET /stream/:id — stream audio ─
// Redirects to the R2 public URL so the browser/app streams directly from R2.
// R2 handles range requests natively → seeking works perfectly.

app.get("/stream/:id", async (c) => {
  const id = c.req.param("id");
  const manifest = await loadManifest(c.env);
  const track = manifest.tracks[id];

  if (!track) return err("Track not found", 404);

  const pub = c.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (pub) {
    // Public bucket: redirect directly to R2 — Workers not in the audio path
    return Response.redirect(`${pub}/${track.fileKey}`, 302);
  }

  // Private bucket fallback: stream through the Worker
  const obj = await c.env.BUCKET.get(track.fileKey);
  if (!obj) return err("Audio file not found in storage", 404);

  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Accept-Ranges", "bytes");

  // Forward range header for seeking support
  const range = c.req.header("Range");
  if (range) headers.set("Range", range);

  return new Response(obj.body, { headers });
});

//  GET /search?q= — search tracks ─

app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  if (!q) return err("Query param 'q' is required");

  const manifest = await loadManifest(c.env);
  const base = baseUrl(c.req.raw);

  const results = sortedTracks(manifest).filter(
    (t) =>
      t.title?.toLowerCase().includes(q) ||
      t.artist?.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q),
  );

  return json({
    query: q,
    results: results.map((t) => buildTrackResponse(t, c.env, base)),
    total: results.length,
  });
});

//  GET /status — library stats + last sync info 

app.get("/status", async (c) => {
  const manifest = await loadManifest(c.env);

  const totalSize = Object.values(manifest.tracks).reduce(
    (sum, t) => sum + (t.sizeBytes ?? 0),
    0,
  );

  return json({
    ok: true,
    trackCount: manifest.trackCount ?? Object.keys(manifest.tracks).length,
    failedCount: Object.keys(manifest.failed ?? {}).length,
    lastUpdated: manifest.lastUpdated,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
    failed: Object.values(manifest.failed ?? {}).slice(0, 10),
  });
});

//  POST /trigger — trigger GitHub Actions sync ─
// Body: { "urls": ["https://youtube.com/..."] }

app.post("/trigger", async (c) => {
  let body: { urls?: unknown };

  try {
    body = await c.req.json();
  } catch {
    return err("Invalid JSON body");
  }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return err("Body must be { urls: string[] }");
  }

  const urls = (body.urls as unknown[])
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .slice(0, 10); // max 10 URLs per trigger to stay within Actions limits

  if (urls.length === 0) {
    return err("No valid URLs found in request");
  }

  const result = await triggerSync(urls, c.env);

  return json(result, result.ok ? 200 : 500);
});

//404 fallback 

app.notFound((c) => err(`Bakchodi mat kar bhai: ${c.req.method} ${c.req.path}`, 404));


export default app;
