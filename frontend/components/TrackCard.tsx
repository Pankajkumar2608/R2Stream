"use client"

import { Play, MoreVertical } from "lucide-react"
import type { Track } from "@/types"

interface TrackCardProps {
  track: Track
  onClick: () => void
}

export function TrackCard({ track, onClick }: TrackCardProps) {
  return (
    <div 
      className="group relative bg-white/5 hover:bg-white/10 p-3 md:p-4 rounded-2xl transition-all duration-300 cursor-pointer border border-white/5 hover:border-white/10 overflow-hidden"
      onClick={onClick}
    >
      <div className="relative aspect-square mb-4 rounded-xl overflow-hidden shadow-lg shadow-black/20 group-hover:shadow-primary/20 transition-all">
        {track.coverUrl ? (
          <img 
            src={track.coverUrl} 
            alt={track.title} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-white/30 text-sm font-medium">No Cover</span>
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-2 md:p-3">
          <button className="bg-primary hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black rounded-full p-3 md:p-4 shadow-[0_8px_30px_rgba(29,185,84,0.4)] transition-all duration-300 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
            <Play size={22} className="fill-black ml-1" />
          </button>
        </div>
      </div>
      
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate text-base md:text-lg tracking-tight group-hover:text-primary transition-colors duration-300">{track.title}</h3>
          <p className="text-white/50 text-xs md:text-sm truncate mt-0.5 font-medium">{track.artist}</p>
        </div>
        <button className="text-white/30 hover:text-white transition-colors p-1" onClick={(e) => e.stopPropagation()}>
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  )
}
