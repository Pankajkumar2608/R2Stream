"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Search, Plus, Music, BarChart2, Library } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStatus } from "@/hooks/useApi"
import { cn } from "@/lib/utils"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useStatus()

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get('q') as string
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    } else {
      router.push('/')
    }
  }

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-transparent md:bg-[#121212] supports-[backdrop-filter]:bg-[#121212]/80 md:backdrop-blur-2xl transition-all h-16">
      {/* Mobile Logo */}
      <div className="flex md:hidden items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-white font-black text-xl tracking-tighter">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Music className="fill-black text-black w-4 h-4" />
          </div>
          <span>MuSync</span>
        </Link>
      </div>

      <div className="hidden md:flex flex-1" /> {/* Spacer */}

      {/* Search Bar */}
      <div className="flex-1 max-w-md px-4 hidden sm:block">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-full blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white transition-colors z-10" size={18} />
          <input
            name="q"
            type="text"
            placeholder="Search tracks, artists, albums..."
            defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : ''}
            className="relative w-full h-10 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-white/20 rounded-full pl-11 pr-4 text-sm font-medium text-white outline-none transition-all placeholder:text-white/40 z-10 shadow-inner"
          />
        </form>
      </div>

      {/* Stats */}
      <div className="hidden lg:flex items-center gap-6 text-xs font-bold text-white/40 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
        <div className="flex items-center gap-2">
          <Music size={14} className="text-primary" />
          <span>{status?.trackCount || 0} Tracks</span>
        </div>
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-primary" />
          <span>{status ? `${status.totalSizeMB} MB` : '0 MB'}</span>
        </div>
      </div>
    </nav>
  )
}
