export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  coverUrl: string | null
  streamUrl: string
  added: string
  sizeBytes: number
}

export interface LibraryStatus {
  ok: boolean
  trackCount: number
  failedCount: number
  lastUpdated: string
  totalSizeMB: string
}
