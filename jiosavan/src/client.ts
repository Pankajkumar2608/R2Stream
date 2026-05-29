import { decryptUrl } from "./crypto.js";

const BASE = "https://www.jiosaavn.com/api.php";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

// ── Types 

export interface SaavnSong {
  id:          string;
  title:       string;
  artist:      string;
  album:       string;
  duration:    number;
  imageUrl:    string | null;
  downloadUrl: string;          // decrypted 320kbps URL
  permaUrl:    string;
  language:    string;
}

// ── Raw API helpers 

async function apiGet(params: Record<string, string>): Promise<any> {
  const url = new URL(BASE);
  Object.entries({
    _format: "json",
    _marker: "0",
    cc: "in",
    ...params,
  }).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url.toString(), { headers: HEADERS });
  if (!resp.ok) throw new Error(`JioSaavn API error: ${resp.status}`);
  return resp.json();
}

function parseRawSong(raw: any): SaavnSong | null {
  try {
    // encrypted_media_url is the key field
    const encUrl = raw.encrypted_media_url ?? raw.more_info?.encrypted_media_url;
    if (!encUrl) return null;

    const downloadUrl = decryptUrl(encUrl);

    // Parse artists
    const artists =
      raw.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(", ") ||
      raw.primary_artists ||
      raw.more_info?.singers ||
      "Unknown Artist";

    // Best image — JioSaavn gives 50x50 by default, upgrade to 500x500
    const image = (raw.image || raw.more_info?.image || "")
      .replace("150x150", "500x500")
      .replace("50x50", "500x500");

    return {
      id:          raw.id,
      title:       raw.title || raw.song || "Unknown Title",
      artist:      artists,
      album:       raw.more_info?.album || raw.album || "",
      duration:    Number(raw.more_info?.duration || raw.duration || 0),
      imageUrl:    image || null,
      downloadUrl,
      permaUrl:    raw.perma_url || "",
      language:    raw.language || "",
    };
  } catch {
    return null;
  }
}

// ── Public API ─────

/**
 * Search JioSaavn for a song by name + artist
 * Returns the best match or null
 */
export async function searchSong(query: string): Promise<SaavnSong | null> {
  // Try the proper search endpoint first (better results than autocomplete)
  try {
    const data = await apiGet({
      __call: "search.getResults",
      p: "1",
      q: query,
      n: "5",
    });

    const results = data?.results;
    if (Array.isArray(results) && results.length > 0) {
      // Try to parse each result until one works (has encrypted_media_url)
      for (const raw of results) {
        const song = parseRawSong(raw);
        if (song) return song;
      }

      // If direct parse failed, get full details by ID
      const topId = results[0].id;
      if (topId) return getSongById(topId);
    }
  } catch (e) {
    console.log(`[SEARCH] search.getResults failed, falling back to autocomplete: ${e}`);
  }

  // Fallback: autocomplete endpoint
  try {
    const data = await apiGet({
      __call: "autocomplete.get",
      query,
      includeMetaTags: "1",
    });

    const songs = data?.songs?.data;
    if (!Array.isArray(songs) || songs.length === 0) return null;

    const topId = songs[0].id;
    return getSongById(topId);
  } catch (e) {
    console.error(`[SEARCH] Both search methods failed for "${query}": ${e}`);
    return null;
  }
}

/**
 * Get full song details including download URL by song ID
 */
export async function getSongById(id: string): Promise<SaavnSong | null> {
  const data = await apiGet({
    __call: "song.getDetails",
    pids:   id,
  });

  const raw = data?.[id] ?? Object.values(data ?? {})[0];
  if (!raw) return null;

  return parseRawSong(raw);
}

/**
 * Get all songs from a JioSaavn playlist URL
 */
export async function getPlaylist(url: string): Promise<SaavnSong[]> {
  // Extract playlist token from URL
  // e.g. https://www.jiosaavn.com/featured/top-50-songs/xxxxx
  const token = url.split("/").pop() ?? "";

  const data = await apiGet({
    __call:         "playlist.getDetails",
    listid:         token,
    includeMetaTags: "1",
  });

  const songs = data?.list ?? [];
  return songs.map(parseRawSong).filter(Boolean) as SaavnSong[];
}

/**
 * Get all songs from a JioSaavn album URL
 */
export async function getAlbum(url: string): Promise<SaavnSong[]> {
  const token = url.split("/").pop() ?? "";

  const data = await apiGet({
    __call:  "content.getAlbumDetails",
    albumid: token,
  });

  const songs = data?.list ?? [];
  return songs.map(parseRawSong).filter(Boolean) as SaavnSong[];
}

/**
 * Auto-detect URL type and return songs
 * Handles: song, album, playlist, featured playlist
 */
export async function resolveSaavnUrl(url: string): Promise<SaavnSong[]> {
  if (url.includes("/song/")) {
    const song = await getSongByPermaUrl(url);
    return song ? [song] : [];
  }
  if (url.includes("/album/")) {
    return getAlbum(url);
  }
  if (url.includes("/featured/") || url.includes("/playlist/")) {
    return getPlaylist(url);
  }
  // Try as search query
  const result = await searchSong(url);
  return result ? [result] : [];
}

async function getSongByPermaUrl(url: string): Promise<SaavnSong | null> {
  const data = await apiGet({
    __call: "song.getDetails",
    token:  url.split("/").pop() ?? "",
    type:   "song",
  });

  const raw = Object.values(data ?? {})[0] as any;
  if (!raw) return null;
  return parseRawSong(raw);
}
