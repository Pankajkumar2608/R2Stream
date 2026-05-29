export interface ScrapedMetadata {
  type: 'song' | 'playlist' | 'unknown'
  title: string
  artist?: string
  searchQueries: string[] // List of search strings (e.g. "Song Name - Artist")
}

/**
 * Clean a YouTube/Spotify video title into a usable JioSaavn search query.
 * YouTube titles are full of garbage like:
 *   "Let It Go" | Fotty Seven | Official Music Video
 *   Arijit Singh - Tum Hi Ho (Official Video) [Lyrics]
 *   DIVINE - Mirchi feat. Stylo G, MC Altaf & Phenom | Official Music Video
 */
function cleanTitle(raw: string): string {
  let title = raw

  // Remove content in brackets/parens: [Official Video], (Lyrics), etc.
  title = title.replace(/[\[\(].*?[\]\)]/g, "")

  // Split on pipe | and take the first part (usually the song name)
  // But also keep the second part if it looks like an artist name
  const pipeParts = title.split("|").map(s => s.trim()).filter(Boolean)
  
  // Build search query: first part is song, second is usually artist
  if (pipeParts.length >= 2) {
    title = `${pipeParts[0]} ${pipeParts[1]}`
  } else {
    title = pipeParts[0] || title
  }

  // Remove common noise words (case-insensitive)
  const noiseWords = [
    /\b(official|video|audio|lyrics|lyric|music|full|song|hd|4k|1080p)\b/gi,
    /\b(feat\.?|ft\.?|featuring)\b/gi,
    /\b(prod\.?\s*by)\b/gi,
    /\b(visuali[sz]er)\b/gi,
    /[""'']/g,              // smart quotes
    /[|:~•·–—]/g,           // special separators
  ]

  for (const regex of noiseWords) {
    title = title.replace(regex, "")
  }

  // Collapse extra whitespace
  title = title.replace(/\s+/g, " ").trim()

  return title
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
      return {
        type: 'song',
        title,
        searchQueries: [cleanTitle(title)]
      }
    } else if (url.includes("/playlist/") || url.includes("/album/")) {
      return {
        type: 'playlist',
        title,
        searchQueries: []
      }
    }

    return null
  } catch (e) {
    console.error("Failed to scrape Spotify URL", e)
    return null
  }
}

export async function resolveAnyUrl(url: string): Promise<string[]> {
  // If it's a Spotify URL
  if (url.includes('spotify.com')) {
    const meta = await scrapeSpotifyUrl(url)
    if (meta && meta.type === 'song') {
      return meta.searchQueries
    } else if (meta && meta.type === 'playlist') {
      throw new Error(`Spotify playlists are not fully supported without an API key yet. Please use JioSaavn playlist URLs.`)
    }
  }

  // If it's YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl)
    if (res.ok) {
      const data = await res.json() as any
      const rawTitle = data.title || ""
      const cleaned = cleanTitle(rawTitle)
      console.log(`[METADATA] YouTube raw title: "${rawTitle}"`)
      console.log(`[METADATA] Cleaned query:     "${cleaned}"`)
      return cleaned ? [cleaned] : []
    }
  }

  return []
}
