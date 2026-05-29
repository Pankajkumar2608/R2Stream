"use client"

import React, { useEffect, useCallback, useState } from "react"
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Music2 } from "lucide-react"
import { usePlayerStore } from "@/store/usePlayerStore"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface FullPlayerOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function FullPlayerOverlay({ isOpen, onClose }: FullPlayerOverlayProps) {
  const { queue, currentIndex, isPlaying, loop, shuffle, togglePlay, nextTrack, prevTrack, toggleLoop, toggleShuffle } = usePlayerStore()
  const currentTrack = queue[currentIndex]

  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Sync with the global audio element via a polling interval (no DOM querySelector hack)
  useEffect(() => {
    if (!isOpen) return

    const getAudio = (): HTMLAudioElement | null => {
      const elements = document.getElementsByTagName('audio')
      return elements.length > 0 ? elements[0] : null
    }

    const audio = getAudio()
    if (audio) {
      setDuration(isNaN(audio.duration) ? 0 : audio.duration)
      if (!isDragging) setProgress(audio.currentTime || 0)
    }

    const interval = setInterval(() => {
      const a = getAudio()
      if (a && !isDragging) {
        setProgress(a.currentTime)
        if (!isNaN(a.duration)) setDuration(a.duration)
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isOpen, currentTrack?.id, isDragging])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00"
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeekChange = useCallback((value: number[]) => {
    setIsDragging(true)
    setProgress(value[0])
  }, [])

  const handleSeekCommit = useCallback((value: number[]) => {
    const elements = document.getElementsByTagName('audio')
    if (elements.length > 0) {
      elements[0].currentTime = value[0]
      setProgress(value[0])
    }
    setIsDragging(false)
  }, [])

  const loopIcon = loop === 'one' ? <Repeat1 size={26} /> : <Repeat size={26} />

  // If we don't return null completely when closed, at least we must make sure
  // the blur doesn't bleed. We can hide it with opacity-0 and pointer-events-none.
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        {/* Dynamic gradient background from cover art */}
        <div className="absolute inset-0 bg-background overflow-hidden">
          {currentTrack?.coverUrl && (
            <>
              <div
                className="absolute inset-0 opacity-40 blur-[100px] scale-150"
                style={{ backgroundImage: `url(${currentTrack.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-background/70 to-background" />
            </>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between py-4">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              <ChevronDown size={28} />
            </button>
            <span className="text-[11px] font-semibold tracking-[0.2em] text-white/40 uppercase">Now Playing</span>
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Cover Art */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-6">
            <div className={cn(
              "relative w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/50 transition-transform duration-700",
              isPlaying ? "scale-100" : "scale-95"
            )}>
              {currentTrack?.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack?.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Music2 className="w-20 h-20 text-white/10" />
                </div>
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white truncate mb-1">{currentTrack?.title || "No Track"}</h2>
            <p className="text-base text-white/50 truncate">{currentTrack?.artist || "Unknown Artist"}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[progress]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
              className="mb-2"
            />
            <div className="flex justify-between text-[11px] text-white/40 font-mono tabular-nums">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-10 max-w-[320px] mx-auto w-full">
            <button
              onClick={toggleShuffle}
              className={cn(
                "p-2 rounded-full transition-colors",
                shuffle ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              <Shuffle size={22} />
            </button>
            <button
              onClick={prevTrack}
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <SkipBack size={28} className="fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
            >
              {isPlaying ? (
                <Pause size={28} className="text-black fill-black" />
              ) : (
                <Play size={28} className="text-black fill-black ml-1" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <SkipForward size={28} className="fill-current" />
            </button>
            <button
              onClick={toggleLoop}
              className={cn(
                "p-2 rounded-full transition-colors",
                loop !== 'off' ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              {loopIcon}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
