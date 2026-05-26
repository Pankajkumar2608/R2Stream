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

export interface FailedTrack {
  title: string;
  error: string;
  attempted: string;
}

export interface Manifest {
  lastUpdated: string | null;
  trackCount: number;
  tracks: Record<string, Track>;
  failed: Record<string, FailedTrack>;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url?: string;
  uploader?: string;
  artist?: string;
  album?: string;
  duration?: number;
  webpage_url?: string;
}
