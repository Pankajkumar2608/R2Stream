"use client"

import { useTracks } from "@/hooks/useApi"
import { usePlayerStore } from "@/store/usePlayerStore"
import { TrackCard } from "@/components/TrackCard"
import { Loader2, Music, Library } from "lucide-react"

export default function Home() {
  const { tracks, isLoading, isError } = useTracks(1, 100) // Fetching first 100 for now
  const { playTrack, setQueue } = usePlayerStore()

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-red-400 mt-32">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Library className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-red-400/70 max-w-md text-center">Failed to load library. Ensure your Cloudflare Worker API is running and configured correctly in .env.local.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-primary mt-40 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-white/40 font-medium tracking-wide animate-pulse">Loading your library...</p>
      </div>
    )
  }

  const handlePlay = (index: number) => {
    setQueue(tracks)
    playTrack(tracks[index], tracks)
  }

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
      {/* Header section with gradient and glow */}
      <div className="relative mb-10 mt-4">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/20 rounded-full mix-blend-screen filter blur-[80px] opacity-50 pointer-events-none" />
        
        <div className="relative z-10 flex items-end gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-primary/80 to-blue-600/80 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
            <Library size={48} className="text-white/90 drop-shadow-lg" />
          </div>
          <div className="flex flex-col gap-1 pb-2">
            <span className="text-sm font-bold tracking-widest text-white/50 uppercase">Playlist</span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">
              Your Library
            </h1>
            <p className="text-white/50 font-medium mt-1">
              {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            </p>
          </div>
        </div>
      </div>
      
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center mt-32 bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/5 max-w-2xl mx-auto shadow-2xl">
          <Music size={64} className="text-white/20 mb-6" />
          <h2 className="text-3xl font-bold text-white mb-3">Your library is empty</h2>
          <p className="text-white/50 text-lg mb-8 max-w-sm">Build your perfect collection. Add songs or playlists from YouTube and Spotify.</p>
          <a href="/add" className="bg-primary hover:bg-primary/90 text-black font-bold py-3 px-8 rounded-full shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] hover:scale-105 active:scale-95 transition-all">
            Find Music to Add
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
          {tracks.map((track, idx) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              onClick={() => handlePlay(idx)} 
            />
          ))}
        </div>
      )}
    </div>
  )
}
