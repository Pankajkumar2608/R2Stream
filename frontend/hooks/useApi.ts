import useSWR from 'swr'
import type { Track, LibraryStatus } from '../types'

const API_URL = '/api/proxy'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useTracks(page = 1, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<{ tracks: Track[], total: number }>(
    `${API_URL}/tracks?page=${page}&limit=${limit}`,
    fetcher
  )

  return {
    tracks: data?.tracks || [],
    total: data?.total || 0,
    isLoading,
    isError: error,
    mutate
  }
}

export function useSearch(query: string) {
  const { data, error, isLoading } = useSWR<Track[]>(
    query ? `${API_URL}/search?q=${encodeURIComponent(query)}` : null,
    fetcher
  )

  return {
    results: data || [],
    isLoading,
    isError: error
  }
}

export function useStatus() {
  const { data, error, isLoading, mutate } = useSWR<LibraryStatus>(
    `${API_URL}/status`,
    fetcher,
    { refreshInterval: 10000 } // Auto refresh every 10s
  )

  return {
    status: data,
    isLoading,
    isError: error,
    mutate
  }
}

export async function addMusic(url: string) {
  const DOWNLOADER_URL = process.env.NEXT_PUBLIC_DOWNLOADER_URL || API_URL
  const res = await fetch(`${DOWNLOADER_URL}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ urls: [url] })
  })
  
  if (!res.ok) {
    throw new Error('Failed to add music')
  }
  
  return res.json()
}
