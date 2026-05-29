"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Plus, Music2, Library } from "lucide-react"
import { TopNav } from "./TopNav"
import { BottomPlayer } from "../player/BottomPlayer"
import { FullPlayerOverlay } from "../player/FullPlayerOverlay"
import { cn } from "@/lib/utils"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="relative flex h-[100dvh] w-full bg-black overflow-hidden selection:bg-primary/30">
      
      {/* Desktop Sidebar (Spotify Vibe) */}
      <aside className="hidden md:flex flex-col w-64 bg-black p-2 gap-2 z-40">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 px-4 py-4 text-white hover:text-white/80 transition-colors group">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_-3px_rgba(29,185,84,0.5)] group-hover:shadow-[0_0_20px_-3px_rgba(29,185,84,0.7)] transition-shadow">
            <Music2 className="fill-black text-black w-4 h-4" />
          </div>
          <span className="font-black text-xl tracking-tighter">MuSync</span>
        </Link>

        {/* Main Nav Card */}
        <div className="bg-[#121212] rounded-xl flex flex-col gap-1 p-3">
          <Link href="/" className={cn(
            "flex items-center gap-4 px-3 py-3 rounded-md font-bold transition-all duration-200",
            pathname === "/" ? "text-white bg-white/5" : "text-white/60 hover:text-white hover:bg-white/5"
          )}>
            <Home size={24} className={pathname === "/" ? "stroke-[2.5]" : "stroke-2"} />
            Home
          </Link>
          <Link href="/search" className={cn(
            "flex items-center gap-4 px-3 py-3 rounded-md font-bold transition-all duration-200",
            pathname.startsWith("/search") ? "text-white bg-white/5" : "text-white/60 hover:text-white hover:bg-white/5"
          )}>
            <Search size={24} className={pathname.startsWith("/search") ? "stroke-[2.5]" : "stroke-2"} />
            Search
          </Link>
        </div>

        {/* Library Card */}
        <div className="bg-[#121212] rounded-xl flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 pb-2 shadow-sm">
            <Link href="/" className="flex items-center gap-3 text-white/60 hover:text-white transition-colors font-bold group">
              <Library size={24} className="group-hover:stroke-[2.5] transition-all" />
              Your Library
            </Link>
            <Link href="/add" className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors">
              <Plus size={20} />
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
            {/* We could render playlists here in the future */}
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-bold text-white mb-2">Create your first playlist</p>
              <p className="text-xs text-white/60 mb-4">It's easy, we'll help you</p>
              <Link href="/add" className="bg-white text-black text-sm font-bold px-4 py-1.5 rounded-full hover:scale-105 transition-transform inline-block">
                Add Music
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#121212] md:mt-2 md:mr-2 md:mb-[90px] md:rounded-xl overflow-hidden relative">
        <TopNav />
        
        <main className="flex-1 overflow-y-auto pb-28 md:pb-6 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav (Visible only on small screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-[45] pb-safe">
        <Link href="/" className={cn("flex flex-col items-center gap-1 p-2", pathname === "/" ? "text-white" : "text-white/50")}>
          <Home size={24} className={pathname === "/" ? "fill-white" : ""} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/search" className={cn("flex flex-col items-center gap-1 p-2", pathname.startsWith("/search") ? "text-white" : "text-white/50")}>
          <Search size={24} className={pathname.startsWith("/search") ? "stroke-[3]" : ""} />
          <span className="text-[10px] font-medium">Search</span>
        </Link>
        <Link href="/add" className={cn("flex flex-col items-center gap-1 p-2", pathname === "/add" ? "text-white" : "text-white/50")}>
          <Library size={24} className={pathname === "/add" ? "fill-white" : ""} />
          <span className="text-[10px] font-medium">Library</span>
        </Link>
      </div>

      {/* Player Components */}
      <BottomPlayer onExpand={() => setIsPlayerOpen(true)} />
      <FullPlayerOverlay isOpen={isPlayerOpen} onClose={() => setIsPlayerOpen(false)} />
    </div>
  )
}
