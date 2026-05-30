# MuSync

MuSync is a self-hosted music streaming system built from three main pieces:

- `frontend/` — a Next.js music player UI
- `worker/` — a Cloudflare Worker API that exposes track listing, search, status, and streaming
- `jiosavan/` — a Cloudflare Worker downloader that resolves music URLs and stores audio + metadata in Cloudflare R2
- `downloader/` — a local CLI sync tool that can populate R2 directly using `yt-dlp`

## Why this exists

This repo is designed to let you run your own music library service without relying on a third-party streaming backend.
It stores audio files and cover images in Cloudflare R2, tracks metadata in a `manifest.json` file, and exposes a simple API that a web client uses to browse, search, and play songs.

## How it works

### Data flow

1. A playlist or track URL is submitted from the frontend.
2. The downloader service resolves the URL and downloads the audio file.
3. The audio file and cover image are uploaded to Cloudflare R2.
4. A `manifest.json` file in R2 is updated with track metadata.
5. The API worker reads `manifest.json` and serves catalog/search/stream endpoints.
6. The frontend renders the track list and plays audio through the API worker.

### Components

#### `frontend/`

- Next.js app for browsing and playing music.
- Uses `frontend/hooks/useApi.ts` to call the API worker.
- Uses `/api/proxy` rewrites to route frontend requests to `worker/`.
- Uses `NEXT_PUBLIC_DOWNLOADER_URL` to submit download jobs to the downloader service.

#### `worker/`

- Cloudflare Worker API named `musync-api`.
- Routes:
  - `GET /tracks` — list tracks
  - `GET /tracks/:id` — get track metadata
  - `GET /search?q=` — search tracks by title/artist/album
  - `GET /status` — library status and health info
  - `GET /stream/:id` — stream a track
  - `POST /trigger` — trigger a library sync workflow
- The stream endpoint either redirects to a public R2 URL or proxies audio from a private R2 bucket with range support.

#### `jiosavan/`

- Cloudflare Worker downloader service.
- Resolves JioSaavn and other music links, finds download URLs, and saves audio and cover images to R2.
- Updates the shared `manifest.json` in R2, so the API worker can serve newly added tracks.

#### `downloader/`

- Local command-line tool for bulk importing playlists and tracks into R2.
- Uses `yt-dlp` to download audio and upload it directly to Cloudflare R2.
- Maintains the same `manifest.json` format used by the API worker.
- This is useful when you want to seed the library from a desktop/server without deploying a worker-based downloader.

## Setup guide

### 1. Create Cloudflare R2 storage

- Create a Cloudflare R2 bucket.
- Optionally make it public if you want direct file URLs for covers/audio.
- Record the bucket name, access key, secret key, and endpoint.

### 2. Deploy the API worker (`worker/`)

- `cd worker`
- `npm install`
- Configure Cloudflare bindings in `wrangler.toml` and environment secrets:
  - `BUCKET` binding to your R2 bucket
  - optionally `R2_PUBLIC_URL` for public bucket access
- Run locally with `npm run dev` or deploy with `npm run deploy`.

### 3. Deploy the downloader service (`jiosavan/`)

- `cd jiosavan`
- `npm install`
- Configure the worker to bind the same R2 bucket as `BUCKET`
- Run locally with `npm run dev` or deploy with `npm run deploy`.

### 4. Configure the frontend (`frontend/`)

- `cd frontend`
- `npm install`
- Create `frontend/.env.local` with at least:
  ```env
  NEXT_PUBLIC_DOWNLOADER_URL=https://your-downloader-worker.workers.dev
  ```
- The frontend currently sends catalog/search requests through `/api/proxy`, and `frontend/next.config.ts` rewrites that to the API worker endpoint.
- If you change your API worker address, update `frontend/next.config.ts` or update `frontend/hooks/useApi.ts` to use a direct `NEXT_PUBLIC_API_URL`.
- Run `npm run dev` and open `http://localhost:3000`.

### 5. Add music

- Use the frontend `Add` page to paste a YouTube/Spotify/JioSaavn playlist or track URL.
- The downloader worker accepts `/download` requests and queues the sync in the background.
- After the download completes, the track appears in the library and becomes streamable.

### 6. Optional local import with `downloader/`

Use this path when you want to populate R2 from a machine with `yt-dlp` available.

- `cd downloader`
- `npm install`
- Create `.env` with the required R2 variables:
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY`
  - `R2_SECRET_KEY`
  - `R2_BUCKET`
  - optional `R2_PUBLIC_URL`
  - optional `YOUTUBE_COOKIES`
- Run:
  ```bash
  npx tsx sync.ts https://www.youtube.com/watch?v=... https://open.spotify.com/playlist/...
  ```
- This uploads audio/covers to R2 and updates `manifest.json`.

## Important behavior

- `manifest.json` in R2 is the single source of truth for library metadata.
- The API worker reads the manifest on every request so the frontend always sees fresh library state.
- The stream endpoint preserves `Range` headers to support seeking in the browser.
- The frontend uses a proxy path (`/api/proxy`) to avoid CORS issues and keep API URLs configurable.

## Notes for other maintainers

- If you want to swap the downloader implementation, keep the same manifest and R2 storage layout.
- The frontend uses track objects with `streamUrl`, `coverUrl`, and `fileUrl` generated by the API worker.
- Any new track added to `manifest.json` becomes available immediately.
- If you deploy the bucket as private, the API worker will stream audio through Cloudflare Worker instead of redirecting.

## Troubleshooting

- If the frontend can’t load tracks:
  - confirm `NEXT_PUBLIC_API_URL` is correct
  - confirm `frontend/next.config.ts` rewrite points to your running worker
- If downloads do not appear:
  - verify the downloader service can write to R2
  - check `manifest.json` exists and is updated
- If streaming fails:
  - ensure `R2_PUBLIC_URL` is set if using public redirects
  - confirm `GET /stream/:id` returns the audio data or redirects properly

## Local workflow summary

- Start the API worker: `cd worker && npm run dev`
- Start the downloader worker: `cd jiosavan && npm run dev`
- Start the frontend: `cd frontend && npm run dev`

That’s the full MuSync streaming system: a browser player, an API gateway, and a downloader layer that keeps your R2 music library populated.
