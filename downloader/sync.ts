import { readFileSync } from "fs";
import { rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join, extname } from "path";
import { createReadStream, statSync } from "fs";
import { mkdtemp } from "fs/promises";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { execa } from "execa";

import type { Manifest, FailedTrack, PlaylistEntry, Track } from "./utils/type";

import { config } from "./utils/config";

import { log, time } from "./utils/logger";

// R2 Client

function makeR2Client(): S3Client {
  return new S3Client({
    endpoint: config.r2.endpoint,
    region: "auto",
    credentials: {
      accessKeyId: config.r2.accessKey,
      secretAccessKey: config.r2.secretKey,
    },
    forcePathStyle: true,
  });
}

//  Manifest ─

async function loadManifest(r2: S3Client): Promise<Manifest> {
  try {
    const resp: GetObjectCommandOutput = await r2.send(
      new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: config.keys.manifest,
      }),
    );
    const body = await resp.Body!.transformToString("utf-8");
    const data = JSON.parse(body) as Manifest;
    log.info(
      `Manifest loaded — ${Object.keys(data.tracks).length} tracks in library`,
    );
    return data;
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      log.info("No manifest found — starting fresh");
      return { lastUpdated: null, trackCount: 0, tracks: {}, failed: {} };
    }
    throw err;
  }
}

async function saveManifest(r2: S3Client, manifest: Manifest): Promise<void> {
  manifest.lastUpdated = new Date().toISOString();
  manifest.trackCount = Object.keys(manifest.tracks).length;

  await r2.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: config.keys.manifest,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
      CacheControl: "no-cache",
    }),
  );
  log.ok(`Manifest saved — ${manifest.trackCount} tracks total`);
}

//  Helpers 

/** Strip characters unsafe for filenames */
function safeFilename(text: string, maxLen = 80): string {
  return text
    .replace(/[^\w\s\-.'()]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Run a yt-dlp command and return result */
async function ytdlp(args: string[]): Promise<any> {
  const result = await execa("yt-dlp", args, {
    reject: false,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0 && result.stderr) {
    log.error("yt-dlp stderr: " + result.stderr.slice(0, 500));
  }
  return result;
}

/** Returns --cookies flag args if YOUTUBE_COOKIES env var is set */
function cookieArgs(): string[] {
  const cookiePath = process.env.YOUTUBE_COOKIES;
  return cookiePath ? ["--cookies", cookiePath] : [];
}

/** Pool: run tasks with limited concurrency */
async function pool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

//  Playlist Extraction ─

/** Detect if URL is a single video or a playlist */
function isPlaylistUrl(url: string): boolean {
  return (
    url.includes("playlist?list=") ||
    url.includes("/sets/") || // SoundCloud playlist
    url.includes("music.youtube.com/playlist")
  );
}

async function extractPlaylistEntries(url: string): Promise<PlaylistEntry[]> {
  //  Single video 
  if (!isPlaylistUrl(url)) {
    log.info(`Single video: ${url}`);
    const result = await ytdlp([
      "--no-playlist", // never expand a playlist even if URL has one
      "--dump-single-json", // return full metadata as one JSON object
      "--no-warnings",
      ...cookieArgs(),
      url,
    ]);

    const singleOut = (result.stdout ?? result.all ?? "").toString().trim();
    if (result.exitCode !== 0 || !singleOut) {
      log.warn(`Could not extract video info: ${url}`);
      return [];
    }

    try {
      const entry = JSON.parse(singleOut) as PlaylistEntry;
      if (entry.id) {
        log.info(`Found 1 track: ${entry.title}`);
        return [entry];
      }
    } catch {
      log.warn(`Failed to parse video info for: ${url}`);
    }
    return [];
  }

  //  Playlist ─
  log.info(`Extracting playlist: ${url}`);
  const result = await ytdlp([
    "--flat-playlist", // fast: list entries without downloading
    "--ignore-errors",
    "--no-warnings",
    "--print-json", // one JSON object per line
    "--quiet",
    ...cookieArgs(),
    url,
  ]);

  if (result.exitCode !== 0 && !result.stdout?.trim()) {
    log.warn(`Could not extract playlist: ${url}`);
    return [];
  }

  const entries: PlaylistEntry[] = [];
  const rawOut = (result.stdout ?? result.all ?? "").toString();
  for (const line of rawOut.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as PlaylistEntry;
      if (entry.id) entries.push(entry);
    } catch {
      // skip malformed lines
    }
  }

  log.info(`Found ${entries.length} tracks in playlist`);
  return entries;
}

//  Download + Upload ─

async function downloadAndUpload(
  entry: PlaylistEntry,
  r2: S3Client,
  manifest: Manifest,
): Promise<Track | null> {
  const videoId = entry.id;
  const rawTitle = entry.title ?? "Unknown Title";

  // Clean up YouTube "Artist - Topic" channel names
  let artist = (entry.uploader ?? entry.artist ?? "Unknown Artist").replace(
    / - Topic$/,
    "",
  );
  const album = entry.album ?? "";
  const duration = entry.duration ?? 0;

  const safeArtist = safeFilename(artist);
  // If title already starts with "Artist - ", strip it to avoid "Artist - Artist - Title"
  const titleWithoutArtist = rawTitle
    .toLowerCase()
    .startsWith(artist.toLowerCase() + " - ")
    ? rawTitle.slice(artist.length + 3)
    : rawTitle;
  const safeTitle = safeFilename(titleWithoutArtist);
  const filename = `${safeArtist} - ${safeTitle}.${config.download.audioFormat}`;
  const musicKey = `${config.keys.music}${filename}`;
  const coverKey = `${config.keys.covers}${videoId}.jpg`;
  const trackUrl =
    entry.webpage_url ??
    entry.url ??
    `https://www.youtube.com/watch?v=${videoId}`;

  log.info(`⬇  Downloading: ${rawTitle}`);

  // Create an isolated temp dir per track so parallel runs don't collide
  const tmpDir = await mkdtemp(join(tmpdir(), `musync-${videoId}-`));

  try {
    //  yt-dlp download ─
    const dlResult = await ytdlp([
      "--format",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      config.download.audioFormat,
      "--audio-quality",
      config.download.audioQuality,
      "--embed-thumbnail", // embed cover art into MP3
      "--embed-metadata", // embed ID3 tags
      "--write-thumbnail", // also write cover as separate file
      "--concurrent-fragments",
      "5", // faster fragment downloads
      "--no-warnings",
      "--quiet",
      ...cookieArgs(),
      "--output",
      join(tmpDir, "%(id)s.%(ext)s"),
      trackUrl,
    ]);

    if (dlResult.exitCode !== 0) {
      log.error(
        `Download failed [${rawTitle}]: ${dlResult.stderr?.slice(0, 200)}`,
      );
      return null;
    }

    //  Find downloaded files ─
    const files = await readdir(tmpDir);
    const audioFile = files.find((f) =>
      f.endsWith(`.${config.download.audioFormat}`),
    );
    const coverFile = files.find((f) => /\.(jpg|jpeg|webp|png)$/i.test(f));

    if (!audioFile) {
      log.error(`MP3 not found after download [${rawTitle}]`);
      return null;
    }

    const audioPath = join(tmpDir, audioFile);
    const coverPath = coverFile ? join(tmpDir, coverFile) : null;
    const sizeBytes = statSync(audioPath).size;

    //  Upload audio to R2 
    await r2.send(
      new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: musicKey,
        Body: createReadStream(audioPath),
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000",
        Metadata: {
          title: rawTitle,
          artist: artist,
          album: album,
          duration: String(duration),
          videoId: videoId,
        },
      }),
    );
    log.ok(`Uploaded audio: ${filename} (${Math.round(sizeBytes / 1024)} KB)`);

    //  Upload cover art to R2 
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

        await r2.send(
          new PutObjectCommand({
            Bucket: config.r2.bucket,
            Key: coverKey,
            Body: createReadStream(coverPath),
            ContentType: ctype,
            CacheControl: "public, max-age=31536000",
          }),
        );
        coverUploaded = true;
        log.ok(`Uploaded cover: ${coverKey}`);
      } catch {
        log.warn(`Cover upload failed for ${videoId}`);
      }
    }

    //  Build track metadata 
    const base = config.r2.publicUrl;
    const track: Track = {
      id: videoId,
      title: rawTitle,
      artist,
      album,
      duration,
      fileKey: musicKey,
      coverKey: coverUploaded ? coverKey : null,
      fileUrl: base ? `${base}/${musicKey}` : null,
      coverUrl: base && coverUploaded ? `${base}/${coverKey}` : null,
      sizeBytes,
      added: new Date().toISOString().slice(0, 10),
    };

    return track;
  } finally {
    // Always clean up temp dir, even on failure
    await rm(tmpDir, { recursive: true, force: true });
  }
}

//  Main ─

async function sync(playlistUrls: string[]): Promise<void> {
  if (playlistUrls.length === 0) {
    log.warn("No playlist URLs provided. Nothing to do.");
    return;
  }

  const r2 = makeR2Client();
  const manifest = await loadManifest(r2);
  const existing = new Set(Object.keys(manifest.tracks));

  log.info(`Already have ${existing.size} tracks in library`);

  //  Collect all new entries across all playlists 
  const newEntries: PlaylistEntry[] = [];
  const seenIds = new Set<string>();

  for (const url of playlistUrls) {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const entries = await extractPlaylistEntries(trimmed);
    for (const entry of entries) {
      if (entry.id && !seenIds.has(entry.id) && !existing.has(entry.id)) {
        seenIds.add(entry.id);
        newEntries.push(entry);
      }
    }
  }

  if (newEntries.length === 0) {
    log.ok("Library is up to date — nothing new to download.");
    return;
  }

  log.info(`🆕 ${newEntries.length} new tracks to download`);

  //  Download + upload with limited concurrency 
  let added = 0;
  let failed = 0;

  await pool(
    newEntries,
    async (entry) => {
      try {
        const track = await downloadAndUpload(entry, r2, manifest);

        if (track) {
          manifest.tracks[track.id] = track;
          added++;
          // Save after every successful upload — crash-safe
          await saveManifest(r2, manifest);
        } else {
          manifest.failed[entry.id] = {
            title: entry.title ?? "Unknown",
            error: "Download or upload failed",
            attempted: new Date().toISOString().slice(0, 10),
          };
          failed++;
        }
      } catch (err: any) {
        log.error(`Unexpected error for "${entry.title}": ${err?.message}`);
        failed++;
      }
    },
    config.download.maxWorkers,
  );

  //  Summary 
  console.log("\n" + "=".repeat(50));
  log.ok(`Sync complete: ${added} added, ${failed} failed`);
  log.info(`Total library: ${Object.keys(manifest.tracks).length} tracks`);
  console.log("=".repeat(50) + "\n");
}

//  Entry Point 

const urls: string[] = (() => {
  // CLI args: npx tsx sync.ts <url1> <url2>
  const args = process.argv.slice(2).filter((a) => a.startsWith("http"));
  if (args.length > 0) return args;

  // Env var: PLAYLIST_URLS="url1\nurl2" or comma-separated
  const env = process.env.PLAYLIST_URLS ?? "";
  return env
    .replace(/,/g, "\n")
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
})();

sync(urls).catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});