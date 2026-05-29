"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1 } from "lucide-react"
import { usePlayerStore } from "@/store/usePlayerStore"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface BottomPlayerProps {
  onExpand: () => void
}

export function BottomPlayer({ onExpand }: BottomPlayerProps) {
  const {
    queue, currentIndex, isPlaying, volume, loop, shuffle,
    togglePlay, nextTrack, prevTrack, setVolume, toggleLoop, toggleShuffle, setIsPlaying
  } = usePlayerStore()

  const currentTrack = queue[currentIndex]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isLoadingRef = useRef(false)

  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = "auto"
    }

    const audio = audioRef.current

    const onTimeUpdate = () => {
      // Don't update progress from audio if user is dragging the slider
      if (!isDragging) {
        setProgress(audio.currentTime)
      }
    }
    const onDurationChange = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration)
    }
    const onEnded = () => {
      const store = usePlayerStore.getState()
      if (store.loop !== 'one') store.nextTrack()
    }
    const onProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1))
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('progress', onProgress)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('progress', onProgress)
    }
  }, [isDragging])

  // Handle track changes — prevent AbortError by awaiting properly
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (audio.src !== currentTrack.streamUrl) {
      isLoadingRef.current = true
      audio.pause()
      audio.src = currentTrack.streamUrl
      audio.load()
      setProgress(0)
      setDuration(0)
      setBuffered(0)

      if (isPlaying) {
        const playWhenReady = () => {
          audio.play()
            .then(() => { isLoadingRef.current = false })
            .catch(() => { isLoadingRef.current = false })
          audio.removeEventListener('canplay', playWhenReady)
        }
        audio.addEventListener('canplay', playWhenReady)
      }
    }
  }, [currentTrack?.streamUrl])

  // Handle play/pause state changes without re-triggering load
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack || isLoadingRef.current) return

    if (isPlaying && audio.paused) {
      audio.play().catch(() => {})
    } else if (!isPlaying && !audio.paused) {
      audio.pause()
    }
  }, [isPlaying])

  // Sync volume and loop
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.loop = loop === 'one'
    }
  }, [volume, loop])

  if (!currentTrack) {
    return (
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center z-40 text-white/30 text-sm">
        No track selected — pick a song from your library
      </div>
    )
  }

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
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setProgress(value[0])
    }
    setIsDragging(false)
  }, [])

  const loopIcon = loop === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 select-none">
      {/* Thin progress bar on top (mobile-friendly visual cue) */}
      <div className="h-[3px] bg-white/5 w-full">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="h-20 bg-black/90 backdrop-blur-2xl border-t border-white/5 flex items-center px-4 gap-4">
        {/* Track Info — click to expand */}
        <div
          className="flex items-center gap-3 w-[30%] min-w-[180px] cursor-pointer group"
          onClick={onExpand}
        >
          <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden shrink-0 shadow-lg group-hover:shadow-primary/20 transition-shadow">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                <Play size={16} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate text-white group-hover:text-primary transition-colors">
              {currentTrack.title}
            </div>
            <div className="text-xs text-white/40 truncate">{currentTrack.artist}</div>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex-1 max-w-[600px] flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleShuffle}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                shuffle ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={prevTrack}
              className="p-1.5 text-white/60 hover:text-white transition-colors"
            >
              <SkipBack size={20} className="fill-current" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay() }}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              {isPlaying ? (
                <Pause size={18} className="text-black fill-black" />
              ) : (
                <Play size={18} className="text-black fill-black ml-0.5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="p-1.5 text-white/60 hover:text-white transition-colors"
            >
              <SkipForward size={20} className="fill-current" />
            </button>
            <button
              onClick={toggleLoop}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                loop !== 'off' ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
            >
              {loopIcon}
            </button>
          </div>

          {/* Desktop seek bar */}
          <div className="w-full hidden sm:flex items-center gap-2 text-[11px] text-white/40 font-mono">
            <span className="w-10 text-right tabular-nums">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
            />
            <span className="w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume — desktop only */}
        <div className="w-[30%] min-w-[120px] hidden md:flex items-center justify-end gap-2 pr-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="w-24">
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={(val) => setVolume(val[0] / 100)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
