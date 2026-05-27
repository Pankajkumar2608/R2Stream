import { mkdtemp, readdir, rm } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";
import { statSync } from "fs";
import { execa } from "execa";
import { config } from "./config.js";
import { makeR2Client, loadManifest, saveManifest, uploadFile } from "./r2.js";
import type { Track } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFilename(text: string, maxLen = 80): string {
  return text
    .replace(/[^\w\s\-.'()]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function log(msg: string) {
  console.log(`${new Date().toTimeString().slice(0, 8)} ${msg}`);
}

/** Run yt-dlp, log stderr on failure */
async function ytdlp(args: string[]) {
  const result = await execa("yt-dlp", args, {
    reject: false,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0 && result.stderr) {
    log(`[yt-dlp err] ${result.stderr.slice(0, 300)}`);
  }
  return result;
}

// ── Extract metadata for a single video ──────────────────────────────────────

export interface VideoMeta {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
}

export async function extractMeta(url: string): Promise<VideoMeta | null> {
  const result = await ytdlp([
    "--no-playlist",
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    url,
  ]);

  const raw = (result.stdout ?? "").trim();
  if (!raw) return null;

  try {
    const info = JSON.parse(raw);
    let artist = (info.uploader ?? info.artist ?? "Unknown Artist").replace(
      / - Topic$/,
      "",
    );

    return {
      id: info.id,
      title: info.title ?? "Unknown Title",
      artist,
      album: info.album ?? "",
      duration: info.duration ?? 0,
      url: info.webpage_url ?? url,
    };
  } catch {
    return null;
  }
}

// ── Extract all entries from a playlist URL ───────────────────────────────────

export async function extractPlaylist(url: string): Promise<VideoMeta[]> {
  const result = await ytdlp([
    "--flat-playlist",
    "--yes-playlist",
    "--ignore-errors",
    "--no-warnings",
    "--print-json",
    "--quiet",
    url,
  ]);

  const entries: VideoMeta[] = [];
  for (const line of (result.stdout ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const e = JSON.parse(trimmed);
      if (e.id) {
        let artist = (e.uploader ?? e.artist ?? "Unknown Artist").replace(
          / - Topic$/,
          "",
        );
        entries.push({
          id: e.id,
          title: e.title ?? "Unknown Title",
          artist,
          album: e.album ?? "",
          duration: e.duration ?? 0,
          url:
            e.webpage_url ?? e.url ?? `https://www.youtube.com/watch?v=${e.id}`,
        });
      }
    } catch {
      /* skip bad lines */
    }
  }
  return entries;
}

// ── Detect if URL is a playlist ───────────────────────────────────────────────

export function isPlaylist(url: string): boolean {
  try {
    const u = new URL(url);
    return !!u.searchParams.get("list") || url.includes("/sets/");
  } catch {
    return false;
  }
}

// ── Download one track and upload to R2 ──────────────────────────────────────

export async function downloadTrack(meta: VideoMeta): Promise<Track | null> {
  const r2 = makeR2Client();

  // Build safe filenames
  const safeArtist = safeFilename(meta.artist);
  const titleClean = meta.title
    .toLowerCase()
    .startsWith(meta.artist.toLowerCase() + " - ")
    ? meta.title.slice(meta.artist.length + 3)
    : meta.title;
  const safeTitle = safeFilename(titleClean);
  const filename = `${safeArtist} - ${safeTitle}.${config.download.audioFormat}`;
  const musicKey = `${config.keys.music}${filename}`;
  const coverKey = `${config.keys.covers}${meta.id}.jpg`;

  log(`⬇  Downloading: ${meta.title}`);

  const tmpDir = await mkdtemp(join(tmpdir(), `musync-${meta.id}-`));

  try {
    // ── yt-dlp download ───────────────────────────────────────────────────────
    const dlResult = await ytdlp([
      "--format",
      "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
      "--extract-audio",
      "--audio-format",
      config.download.audioFormat,
      "--audio-quality",
      config.download.audioQuality,
      "--embed-thumbnail",
      "--embed-metadata",
      "--write-thumbnail",
      "--concurrent-fragments",
      "5",
      "--no-warnings",
      "--quiet",
      "--output",
      join(tmpDir, "%(id)s.%(ext)s"),
      meta.url,
    ]);

    if (dlResult.exitCode !== 0) {
      log(`✗ Download failed: ${meta.title}`);
      return null;
    }

    // ── Find downloaded files ─────────────────────────────────────────────────
    const files = await readdir(tmpDir);
    const audioFile = files.find((f) =>
      f.endsWith(`.${config.download.audioFormat}`),
    );
    const coverFile = files.find((f) => /\.(jpg|jpeg|webp|png)$/i.test(f));

    if (!audioFile) {
      log(`✗ Audio file not found after download: ${meta.title}`);
      return null;
    }

    const audioPath = join(tmpDir, audioFile);
    const coverPath = coverFile ? join(tmpDir, coverFile) : null;

    // ── Upload audio ──────────────────────────────────────────────────────────
    // S3 metadata headers only allow ASCII printable chars — encode everything
    const cleanMeta = (s: string) => encodeURIComponent(s).slice(0, 200); // URI-encode + cap length

    const sizeBytes = await uploadFile(r2, musicKey, audioPath, "audio/mpeg", {
      title: cleanMeta(meta.title),
      artist: cleanMeta(meta.artist),
      album: cleanMeta(meta.album),
      duration: String(meta.duration),
      videoId: meta.id,
    });
    log(`✓ Uploaded: ${filename} (${Math.round(sizeBytes / 1024)} KB)`);

    // ── Upload cover ──────────────────────────────────────────────────────────
    let coverUploaded = false;
    if (coverPath) {
      try {
        const ext = extname(coverPath).toLowerCase();
        const ctype =
          ext === ".webp"
            ? "image/webp"
            : ext === ".png"
              ? "image/png"
              : "image/jpeg";
        await uploadFile(r2, coverKey, coverPath, ctype);
        coverUploaded = true;
        log(`✓ Cover uploaded: ${meta.id}`);
      } catch {
        log(`⚠ Cover upload failed: ${meta.id}`);
      }
    }

    // ── Build track object ────────────────────────────────────────────────────
    const base = config.r2.publicUrl;
    const track: Track = {
      id: meta.id,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      duration: meta.duration,
      fileKey: musicKey,
      coverKey: coverUploaded ? coverKey : null,
      fileUrl: base ? `${base}/${musicKey}` : null,
      coverUrl: base && coverUploaded ? `${base}/${coverKey}` : null,
      sizeBytes,
      added: new Date().toISOString().slice(0, 10),
    };

    // ── Update manifest ───────────────────────────────────────────────────────
    const manifest = await loadManifest(r2);
    manifest.tracks[track.id] = track;
    await saveManifest(r2, manifest);

    return track;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
