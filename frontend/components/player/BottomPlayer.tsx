"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  ChevronUp,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface BottomPlayerProps {
  onExpand: () => void;
}

export function BottomPlayer({ onExpand }: BottomPlayerProps) {
  const {
    queue,
    currentIndex,
    isPlaying,
    volume,
    loop,
    shuffle,
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    toggleLoop,
    toggleShuffle,
    setProgress: setStoreProgress,
    setDuration: setStoreDuration,
    setBuffered: setStoreBuffered,
  } = usePlayerStore();

  const currentTrack = queue[currentIndex];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoadingRef = useRef(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);

  // Check if title overflows for marquee effect
  useEffect(() => {
    const el = titleRef.current;
    if (el) setTitleOverflows(el.scrollWidth > el.clientWidth);
  }, [currentTrack?.title]);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      // Expose globally so FullPlayerOverlay can seek without prop drilling
      (window as any).__musyncAudio = audioRef.current;
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      if (!isDragging) {
        setProgress(audio.currentTime);
        setStoreProgress(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
        setStoreDuration(audio.duration);
      }
    };
    const onEnded = () => {
      const store = usePlayerStore.getState();
      if (store.loop !== "one") store.nextTrack();
    };
    const onProgress = () => {
      if (audio.buffered.length > 0) {
        const b = audio.buffered.end(audio.buffered.length - 1);
        setBuffered(b);
        setStoreBuffered(b);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("progress", onProgress);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("progress", onProgress);
    };
  }, [isDragging]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.src !== currentTrack.streamUrl) {
      isLoadingRef.current = true;
      audio.pause();
      audio.src = currentTrack.streamUrl;
      audio.load();
      setProgress(0);
      setDuration(0);
      setBuffered(0);
      setStoreProgress(0);
      setStoreDuration(0);
      setStoreBuffered(0);
      if (isPlaying) {
        const playWhenReady = () => {
          audio
            .play()
            .then(() => {
              isLoadingRef.current = false;
            })
            .catch(() => {
              isLoadingRef.current = false;
            });
          audio.removeEventListener("canplay", playWhenReady);
        };
        audio.addEventListener("canplay", playWhenReady);
      }
    }
  }, [currentTrack?.streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || isLoadingRef.current) return;
    if (isPlaying && audio.paused) audio.play().catch(() => {});
    else if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.loop = loop === "one";
    }
  }, [volume, loop]);

  const handleSeekChange = useCallback((value: number[]) => {
    setIsDragging(true);
    setProgress(value[0]);
  }, []);

  const handleSeekCommit = useCallback((value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setProgress(value[0]);
    }
    setIsDragging(false);
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const loopIcon =
    loop === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />;

  if (!currentTrack) {
    return (
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40">
        <div className="h-[72px] bg-black/90 backdrop-blur-2xl border-t border-white/[0.06] flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-white/20">
            <Music2 size={16} />
            <span className="text-sm font-medium tracking-wide">
              No track selected
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(0); }
          85%  { transform: translateX(var(--marquee-distance)); }
          100% { transform: translateX(var(--marquee-distance)); }
        }
        .marquee-track {
          animation: marquee 8s ease-in-out infinite alternate;
        }
        @keyframes pulse-bar {
          0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 select-none">
        {/* === Seek bar — full-width, interactive strip === */}
        <div
          className={cn(
            "relative h-1 bg-white/[0.06] cursor-pointer group/seek transition-all duration-200",
            isHoveringProgress && "h-1.5",
          )}
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
        >
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 bg-white/10 rounded-full transition-all duration-300"
            style={{ width: `${bufferedPct}%` }}
          />
          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progressPct}%` }}
          />
          {/* Invisible Slider overlay */}
          <Slider
            value={[Math.min(progress, duration || 0)]}
            min={0}
            max={duration || 1}
            step={0.5}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekCommit}
            className="absolute inset-0 opacity-0 h-full cursor-pointer"
          />
        </div>

        {/* === Main bar === */}
        <div
          className="relative h-[72px] flex items-center px-3 sm:px-4 gap-3"
          style={{
            background: "rgba(10,10,10,0.92)",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Cover art glow */}
          {currentTrack.coverUrl && (
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: `url(${currentTrack.coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(40px)",
              }}
            />
          )}

          {/* ── Track Info ── */}
          <div
            className="flex items-center gap-3 flex-shrink-0 cursor-pointer group/info"
            style={{ width: "clamp(160px, 28%, 280px)" }}
            onClick={onExpand}
          >
            {/* Cover */}
            <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-lg ring-1 ring-white/10 transition-all duration-300 group-hover/info:ring-primary/40 group-hover/info:scale-105">
              {currentTrack.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Music2 size={14} className="text-white/20" />
                </div>
              )}
              {/* Expand hint */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/info:opacity-100 transition-opacity flex items-center justify-center">
                <ChevronUp size={16} className="text-white" />
              </div>
            </div>

            {/* Title + Artist */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="overflow-hidden">
                <div
                  ref={titleRef}
                  className={cn(
                    "text-[13px] font-semibold text-white whitespace-nowrap",
                    titleOverflows && "marquee-track",
                  )}
                  style={
                    titleOverflows
                      ? ({
                          "--marquee-distance": "-60px",
                        } as React.CSSProperties)
                      : {}
                  }
                >
                  {currentTrack.title}
                </div>
              </div>
              <div className="text-[11px] text-white/40 truncate mt-0.5 font-medium">
                {currentTrack.artist}
              </div>
            </div>
          </div>

          {/* ── Center: Controls + Desktop seek ── */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-w-0">
            {/* Controls row */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Shuffle — hidden on smallest screens */}
              <button
                onClick={toggleShuffle}
                className={cn(
                  "hidden sm:flex w-8 h-8 items-center justify-center rounded-full transition-all duration-200",
                  shuffle
                    ? "text-primary bg-primary/10"
                    : "text-white/30 hover:text-white/60 hover:bg-white/5",
                )}
                title="Shuffle"
              >
                <Shuffle size={14} />
              </button>

              {/* Prev */}
              <button
                onClick={prevTrack}
                className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <SkipBack size={18} className="fill-current" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-white/10 hover:shadow-white/20"
              >
                {isPlaying ? (
                  <Pause size={16} className="text-black fill-black" />
                ) : (
                  <Play size={16} className="text-black fill-black ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={nextTrack}
                className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <SkipForward size={18} className="fill-current" />
              </button>

              {/* Loop — hidden on smallest screens */}
              <button
                onClick={toggleLoop}
                className={cn(
                  "hidden sm:flex w-8 h-8 items-center justify-center rounded-full transition-all duration-200",
                  loop !== "off"
                    ? "text-primary bg-primary/10"
                    : "text-white/30 hover:text-white/60 hover:bg-white/5",
                )}
                title={`Loop: ${loop}`}
              >
                {loopIcon}
              </button>
            </div>

            {/* Desktop seek timestamps */}
            <div className="hidden sm:flex items-center gap-2.5 w-full max-w-sm">
              <span className="text-[10px] text-white/30 font-mono tabular-nums w-8 text-right shrink-0">
                {formatTime(progress)}
              </span>
              <div className="flex-1 relative h-1 bg-white/[0.08] rounded-full overflow-hidden cursor-pointer">
                <div
                  className="absolute inset-y-0 left-0 bg-white/15 rounded-full"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-100"
                  style={{ width: `${progressPct}%` }}
                />
                <Slider
                  value={[Math.min(progress, duration || 0)]}
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  onValueChange={handleSeekChange}
                  onValueCommit={handleSeekCommit}
                  className="absolute inset-0 opacity-0 h-full cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-white/30 font-mono tabular-nums w-8 shrink-0">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* ── Volume (desktop only) ── */}
          <div
            className="hidden md:flex items-center justify-end gap-2 shrink-0"
            style={{ width: "clamp(120px, 20%, 200px)" }}
          >
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
              className="text-white/30 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5 shrink-0"
            >
              <VolumeIcon size={15} />
            </button>
            <div className="w-20 flex-shrink-0">
              <Slider
                value={[Math.round(volume * 100)]}
                max={100}
                step={1}
                onValueChange={(val) => setVolume(val[0] / 100)}
              />
            </div>
            <span className="text-[10px] text-white/20 font-mono tabular-nums w-6 text-right">
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
