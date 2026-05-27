// Env bindings (defined in wrangler.toml + secrets) 

export interface Env {
  // R2 bucket binding
  BUCKET: R2Bucket;

  // Secrets — set via: wrangler secret put <NAME>
  GITHUB_TOKEN: string; // PAT with actions:write
  GITHUB_OWNER: string; // your GitHub username
  GITHUB_REPO: string; // repo with the sync workflow
  R2_PUBLIC_URL: string; // https://your-bucket.r2.dev
}

//  Manifest shape (mirrors what sync.ts writes) 

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileKey: string;
  coverKey: string | null;
  fileUrl: string | null;
  coverUrl: string | null;
  sizeBytes: number;
  added: string;
}

export interface Manifest {
  lastUpdated: string | null;
  trackCount: number;
  tracks: Record<string, Track>;
  failed: Record<string, { title: string; error: string; attempted: string }>;
}

// API response shapes 

export interface TrackResponse extends Track {
  streamUrl: string; // /stream/:id  — always present, constructed by API
}

export interface TracksListResponse {
  tracks: TrackResponse[];
  total: number;
  lastUpdated: string | null;
}

export interface TriggerResponse {
  ok: boolean;
  message: string;
  runUrl?: string;
}
