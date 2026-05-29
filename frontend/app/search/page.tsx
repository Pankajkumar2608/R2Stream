"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSearch } from "@/hooks/useApi"
import { usePlayerStore } from "@/store/usePlayerStore"
import { TrackCard } from "@/components/TrackCard"
import { Loader2, SearchX, Search } from "lucide-react"

function SearchContent() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  
  const { results, isLoading, isError } = useSearch(q)
  const { playTrack, setQueue } = usePlayerStore()

  const handlePlay = (index: number) => {
    setQueue(results)
    playTrack(results[index], results)
  }

  return (
    <>
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white flex items-center gap-4">
          <Search size={40} className="text-primary opacity-80" />
          {q ? `Results for "${q}"` : "Search"}
        </h1>
      </div>

      {!q ? (
        <div className="flex flex-col items-center justify-center text-center mt-32 bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/5 max-w-2xl mx-auto">
          <Search size={64} className="text-white/20 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">What do you want to listen to?</h2>
          <p className="text-white/50">Search for tracks, artists, or albums in your library.</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-primary gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-white/40 font-medium">Searching library...</p>
        </div>
      ) : isError ? (
        <div className="text-red-400 text-center mt-32 font-medium bg-red-500/10 p-6 rounded-2xl max-w-lg mx-auto">
          Failed to load search results. Please check your connection.
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center text-center mt-32 bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/5 max-w-2xl mx-auto">
          <SearchX size={64} className="text-white/20 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">No results found for "{q}"</h2>
          <p className="text-white/50 max-w-sm">Please make sure your words are spelled correctly or use fewer or different keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
          {results.map((track, idx) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              onClick={() => handlePlay(idx)} 
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function SearchPage() {
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center h-64 text-primary gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-white/40 font-medium">Loading search...</p>
        </div>
      }>
        <SearchContent />
      </Suspense>
    </div>
  )
}
