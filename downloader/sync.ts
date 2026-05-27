import express from "express";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { config } from "./utils/config";
import {
  extractMeta,
  extractPlaylist,
  isPlaylist,
  downloadTrack,
  type VideoMeta,
} from "./utils/download";
import { makeR2Client, loadManifest } from "./utils/r2";
import type { DownloadJob } from "./utils/type";

const COOKIE_PATH = "/tmp/yt-cookies.txt";

function setupCookies(): void {
  const b64 = process.env.YOUTUBE_COOKIES_B64;
  if (!b64) {
    console.log(
      "⚠  No YOUTUBE_COOKIES_B64 set — downloads may fail on restricted videos",
    );
    return;
  }
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    writeFileSync(COOKIE_PATH, decoded, "utf-8");
    process.env.YOUTUBE_COOKIES = COOKIE_PATH;
    console.log(`✓  YouTube cookies written to ${COOKIE_PATH}`);
  } catch (err) {
    console.error("✗  Failed to write cookies:", err);
  }
}

setupCookies();

const app = express();
app.use(express.json());

// ── In-memory job queue ───────────────────────────────────────────────────────
// Jobs are processed one at a time to avoid overloading the free instance.
// State resets on restart — fine for personal use.

const jobs = new Map<string, DownloadJob>();
const queue: string[] = []; // jobIds waiting to run
let running = false;

// ── Auth middleware (optional) ────────────────────────────────────────────────

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!config.apiKey) return next(); // no key set = open

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (token !== config.apiKey) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  next();
}

// ── Process queue sequentially ────────────────────────────────────────────────

async function processQueue() {
  if (running || queue.length === 0) return;
  running = true;

  while (queue.length > 0) {
    const jobId = queue.shift()!;
    const job = jobs.get(jobId);
    if (!job) continue;

    job.status = "downloading";
    console.log(`\n[job:${jobId.slice(0, 8)}] Starting: ${job.url}`);

    try {
      // 1. Extract metadata
      let meta: VideoMeta | null = null;

      if (isPlaylist(job.url)) {
        // For playlists, process all tracks — but report job as done after all
        job.status = "downloading";
        const entries = await extractPlaylist(job.url);
        console.log(
          `[job:${jobId.slice(0, 8)}] Playlist has ${entries.length} tracks`,
        );

        // Load existing manifest to skip already-downloaded tracks
        const r2 = makeR2Client();
        const manifest = await loadManifest(r2);
        const existing = new Set(Object.keys(manifest.tracks));
        const newTracks = entries.filter((e) => !existing.has(e.id));

        console.log(
          `[job:${jobId.slice(0, 8)}] ${newTracks.length} new tracks to download`,
        );

        let lastTrack = null;
        for (const entry of newTracks) {
          job.status = "downloading";
          const track = await downloadTrack(entry);
          if (track) lastTrack = track;
        }

        job.status = "done";
        job.track = lastTrack ?? undefined;
        job.finishedAt = new Date().toISOString();
      } else {
        // Single video
        meta = await extractMeta(job.url);
        if (!meta) throw new Error("Could not extract video metadata");

        // Check if already exists
        const r2 = makeR2Client();
        const manifest = await loadManifest(r2);
        if (manifest.tracks[meta.id]) {
          console.log(
            `[job:${jobId.slice(0, 8)}] Already exists: ${meta.title}`,
          );
          job.status = "done";
          job.track = manifest.tracks[meta.id];
          job.finishedAt = new Date().toISOString();
          continue;
        }

        job.status = "uploading";
        const track = await downloadTrack(meta);
        if (!track) throw new Error("Download or upload failed");

        job.status = "done";
        job.track = track;
        job.finishedAt = new Date().toISOString();
      }

      console.log(`[job:${jobId.slice(0, 8)}] ✓ Done`);
    } catch (err: any) {
      job.status = "failed";
      job.error = err?.message ?? "Unknown error";
      job.finishedAt = new Date().toISOString();
      console.error(`[job:${jobId.slice(0, 8)}] ✗ Failed: ${job.error}`);
    }
  }

  running = false;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET / — health check
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "musync-downloader",
    version: "1.0.0",
    queue: queue.length,
    running,
  });
});

// POST /download — queue a download job
// Body: { "url": "https://youtube.com/..." }
app.post("/download", auth, async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || !url.startsWith("http")) {
    res
      .status(400)
      .json({ ok: false, error: "Valid URL required in body: { url }" });
    return;
  }

  const jobId: string = randomUUID();
  const job: DownloadJob = {
    jobId,
    url,
    status: "pending",
    startedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);
  queue.push(jobId);

  console.log(`[job:${jobId.slice(0, 8)}] Queued: ${url}`);

  // Start processing (non-blocking)
  processQueue().catch(console.error);

  res.status(202).json({
    ok: true,
    jobId,
    message: "Download queued. Poll /jobs/:jobId for status.",
    pollUrl: `/jobs/${jobId}`,
  });
});

// GET /jobs/:jobId — check job status
app.get("/jobs/:jobId", auth, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ ok: false, error: "Job not found" });
    return;
  }
  res.json({ ok: true, job });
});

// GET /jobs — list recent jobs
app.get("/jobs", auth, (_req, res) => {
  const list = Array.from(jobs.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 20);
  res.json({ ok: true, jobs: list, total: jobs.size });
});

// GET /debug/cookies — check cookie status (remove after debugging)
app.get("/debug/cookies", (_req, res) => {
  const b64 = process.env.YOUTUBE_COOKIES_B64;
  const cookiePath = process.env.YOUTUBE_COOKIES;

  let fileContents = "";
  try {
    if (cookiePath) {
      const { readFileSync } = require("fs");
      fileContents = readFileSync(cookiePath, "utf-8").slice(0, 200);
    }
  } catch (e: any) {
    fileContents = `Error reading: ${e.message}`;
  }

  res.json({
    b64Set: !!b64,
    b64Length: b64?.length ?? 0,
    cookiePath,
    filePreview: fileContents,
  });
});

// GET /status — library stats from R2
app.get("/status", auth, async (_req, res) => {
  try {
    const r2 = makeR2Client();
    const manifest = await loadManifest(r2);
    const totalSize = Object.values(manifest.tracks).reduce(
      (sum, t) => sum + (t.sizeBytes ?? 0),
      0,
    );

    res.json({
      ok: true,
      trackCount: manifest.trackCount ?? Object.keys(manifest.tracks).length,
      failedCount: Object.keys(manifest.failed ?? {}).length,
      lastUpdated: manifest.lastUpdated,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
      queue: queue.length,
      running,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`\n🎵 musync-downloader running on port ${config.port}`);
  console.log(
    `   Auth: ${config.apiKey ? "enabled" : "disabled (set API_KEY to enable)"}`,
  );
  console.log(`   R2 bucket: ${config.r2.bucket}`);
  console.log(`   Ready.\n`);
});