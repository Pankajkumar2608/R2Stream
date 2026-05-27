import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { config } from "./config.js";
import type { Manifest, Track } from "./types.js";

// ── R2 Client ─────────────────────────────────────────────────────────────────

export function makeR2Client(): S3Client {
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

// ── Manifest ──────────────────────────────────────────────────────────────────

export async function loadManifest(r2: S3Client): Promise<Manifest> {
  try {
    const resp = await r2.send(
      new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: config.keys.manifest,
      }),
    );
    const body = await resp.Body!.transformToString("utf-8");
    return JSON.parse(body) as Manifest;
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return { lastUpdated: null, trackCount: 0, tracks: {}, failed: {} };
    }
    throw err;
  }
}

export async function saveManifest(
  r2: S3Client,
  manifest: Manifest,
): Promise<void> {
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
}

// ── Upload file to R2 ─────────────────────────────────────────────────────────

export async function uploadFile(
  r2: S3Client,
  key: string,
  filePath: string,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<number> {
  const { statSync } = await import("fs");
  const size = statSync(filePath).size;

  await r2.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
      Metadata: metadata,
    }),
  );

  return size;
}
