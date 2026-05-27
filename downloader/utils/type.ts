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

export interface DownloadJob {
  url: string;
  jobId: string;
  status: "pending" | "downloading" | "uploading" | "done" | "failed";
  track?: Track;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}
