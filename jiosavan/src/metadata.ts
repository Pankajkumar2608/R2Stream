export interface ScrapedMetadata {
  type: 'song' | 'playlist' | 'unknown'
  title: string
  artist?: string
  searchQueries: string[] // List of search strings (e.g. "Song Name - Artist")
}

export async function scrapeSpotifyUrl(url: string): Promise<ScrapedMetadata | null> {
  try {
    // We can use Spotify's oEmbed endpoint to get basic info without API keys
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    const res = await fetch(oembedUrl)
    
    if (!res.ok) return null
    const data = await res.json() as any

    const title = data.title || "Unknown"
    
    if (url.includes("/track/")) {
      // The oembed title for tracks is usually something like "Track Name"
      // We can search JioSaavn using this title.
      return {
        type: 'song',
        title,
        searchQueries: [title]
      }
    } else if (url.includes("/playlist/") || url.includes("/album/")) {
      // For playlists, oEmbed only gives us the playlist name.
      // To get all tracks without a Spotify API key, we would need to do complex HTML scraping.
      // For now, we return just the playlist name.
      return {
        type: 'playlist',
        title,
        searchQueries: [] // We don't have the individual tracks yet
      }
    }

    return null
  } catch (e) {
    console.error("Failed to scrape Spotify URL", e)
    return null
  }
}

export async function resolveAnyUrl(url: string): Promise<string[]> {
  // If it's a Spotify URL, we try to get the track names to search JioSaavn
  if (url.includes('spotify.com')) {
    const meta = await scrapeSpotifyUrl(url)
    if (meta && meta.type === 'song') {
      return meta.searchQueries
    } else if (meta && meta.type === 'playlist') {
      throw new Error(`Spotify playlists are not fully supported without an API key yet. Please use JioSaavn playlist URLs.`)
    }
  }

  // If it's YouTube (very basic track title extraction from oembed)
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl)
    if (res.ok) {
      const data = await res.json() as any
      // Remove generic terms like "Official Video", "Lyrics" to improve JioSaavn search
      let cleanTitle = (data.title || "").replace(/(\[.*?\]|\(.*?\)|official|video|audio|lyrics)/gi, "").trim()
      return [cleanTitle]
    }
  }

  return []
}
