"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { cn } from "@/lib/utils";
import { Slider } from "@radix-ui/react-slider";

interface FullPlayerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FullPlayerOverlay({ isOpen, onClose }: FullPlayerOverlayProps) {
  const {
    queue,
    currentIndex,
    isPlaying,
    loop,
    shuffle,
    progress,
    duration,
    buffered,
    volume,
    setProgress,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleLoop,
    toggleShuffle,
    setVolume,
  } = usePlayerStore();

  const currentTrack = queue[currentIndex];
  const [isDragging, setIsDragging] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  // Swipe-to-close
  const touchStartY = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragOffset(delta);
  };
  const handleTouchEnd = () => {
    if (dragOffset > 120) onClose();
    setDragOffset(0);
    touchStartY.current = null;
  };

  // Keyboard close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const loopIcon =
    loop === "one" ? <Repeat1 size={22} /> : <Repeat size={22} />;
  const panelTransform =
    dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined;
  const panelOpacity =
    dragOffset > 0 ? Math.max(0.4, 1 - dragOffset / 300) : undefined;

  return (
    <>
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes float-cover {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-6px) scale(1.01); }
        }
        .vinyl-spin { animation: spin-slow 12s linear infinite; }
        .vinyl-paused { animation-play-state: paused; }
        .cover-float { animation: float-cover 6s ease-in-out infinite; }
        .cover-still { animation: none; }
      `}</style>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed inset-0 z-50 flex flex-col overflow-hidden",
          "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none",
        )}
        style={{
          transform:
            dragOffset > 0
              ? panelTransform
              : isOpen
                ? "translateY(0)"
                : "translateY(100%)",
          opacity: dragOffset > 0 ? panelOpacity : undefined,
          willChange: "transform, opacity",
        }}
      >
        {/* === Background layers === */}
        <div className="absolute inset-0 bg-[#0a0a0a]">
          {currentTrack?.coverUrl && (
            <>
              {/* Blurred cover as backdrop */}
              <div
                className="absolute inset-0 opacity-30 scale-110"
                style={{
                  backgroundImage: `url(${currentTrack.coverUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(80px) saturate(180%)",
                }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/50 to-black/80" />
              {/* Noise texture */}
              <div
                className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  backgroundSize: "200px",
                }}
              />
            </>
          )}
        </div>
         
        <div className="relative z-10 flex flex-col h-full w-full max-w-lg mx-auto px-6 sm:px-10 overflow-hidden">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between py-3 shrink-0">
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronDown size={22} />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30">
                Now Playing
              </p>
              {queue.length > 1 && (
                <p className="text-[10px] text-white/20 mt-0.5">
                  {currentIndex + 1} / {queue.length}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowVolume((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* Volume panel (collapsible) */}
          <div
            className={cn(
              "shrink-0 overflow-hidden transition-all duration-300",
              showVolume ? "max-h-12 opacity-100 mb-2" : "max-h-0 opacity-0",
            )}
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <VolumeX size={14} className="text-white/30 shrink-0" />
              <Slider
                value={[Math.round(volume * 100)]}
                max={100}
                step={1}
                onValueChange={(val) => setVolume(val[0] / 100)}
                className="flex-1"
              />
              <Volume2 size={14} className="text-white/30 shrink-0" />
            </div>
          </div>

          {/* === Cover Art  === */}
          <div className="shrink-0 flex items-center justify-center py-4">
            <div
              className="relative rounded-2xl overflow-hidden ring-1 ring-white/8 shadow-[0_24px_60px_-8px_rgba(0,0,0,0.7)]"
              style={{
                width: "min(100%, 60vh)",
                height: "min(100%, 60vh)",
                transform: isPlaying ? "scale(1)" : "scale(0.93)",
                transition: "transform 0.7s ease-out",
              }}
            >
              {/* Glow */}
              {currentTrack?.coverUrl && (
                <div
                  className="absolute -inset-3 opacity-50 pointer-events-none"
                  style={{
                    backgroundImage: `url(${currentTrack.coverUrl})`,
                    backgroundSize: "cover",
                    filter: "blur(20px)",
                    zIndex: -1,
                  }}
                />
              )}
              {currentTrack?.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack?.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Music2 size={48} className="text-white/10" />
                </div>
              )}
              {/* Gloss */}
              <div className="absolute inset-0 bg-linear-to-b from-white/6 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* === Track Info === */}
          <div className="shrink-0 mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate leading-tight">
                {currentTrack?.title || "No Track"}
              </h2>
              <p className="text-sm text-white/40 truncate mt-0.5 font-medium">
                {currentTrack?.artist || "Unknown Artist"}
              </p>
            </div>
            <button className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* === Seek Bar === */}
          <div className="shrink-0 mb-4">
            <style>{`
              .musync-seek {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 4px;
                border-radius: 9999px;
                outline: none;
                cursor: pointer;
                background: transparent;
                position: relative;
              }
              .musync-seek::-webkit-slider-runnable-track {
                height: 4px;
                border-radius: 9999px;
                background: rgba(255,255,255,0.12);
              }
              .musync-seek::-moz-range-track {
                height: 4px;
                border-radius: 9999px;
                background: rgba(255,255,255,0.12);
              }
              .musync-seek::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #ffffff;
                margin-top: -5px;
                box-shadow: 0 1px 6px rgba(0,0,0,0.5);
                cursor: pointer;
                transition: transform 0.15s;
              }
              .musync-seek::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #ffffff;
                border: none;
                box-shadow: 0 1px 6px rgba(0,0,0,0.5);
                cursor: pointer;
              }
              .musync-seek:active::-webkit-slider-thumb {
                transform: scale(1.3);
              }
              .musync-seek:active::-moz-range-thumb {
                transform: scale(1.3);
              }
            `}</style>
            {/* Track + progress fill as background gradient */}
            <div className="relative w-full mb-2.5">
              <input
                type="range"
                className="musync-seek"
                min={0}
                max={duration || 1}
                step={0.5}
                value={Math.min(progress, duration || 0)}
                style={{
                  background: `linear-gradient(to right,
                    rgba(255,255,255,0.18) 0%,
                    rgba(255,255,255,0.18) ${duration ? (buffered / duration) * 100 : 0}%,
                    rgba(255,255,255,0.0) ${duration ? (buffered / duration) * 100 : 0}%,
                    rgba(255,255,255,0.0) 100%
                  ), linear-gradient(to right,
                    #ffffff 0%,
                    #ffffff ${duration ? (progress / duration) * 100 : 0}%,
                    rgba(255,255,255,0.12) ${duration ? (progress / duration) * 100 : 0}%,
                    rgba(255,255,255,0.12) 100%
                  )`,
                }}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setIsDragging(true);
                  setProgress(val);
                }}
                onMouseUp={(e) => {
                  const val = Number((e.target as HTMLInputElement).value);
                  const audio = (window as any).__musyncAudio as
                    | HTMLAudioElement
                    | undefined;
                  if (audio) audio.currentTime = val;
                  setProgress(val);
                  setIsDragging(false);
                }}
                onTouchEnd={(e) => {
                  const val = Number((e.target as HTMLInputElement).value);
                  const audio = (window as any).__musyncAudio as
                    | HTMLAudioElement
                    | undefined;
                  if (audio) audio.currentTime = val;
                  setProgress(val);
                  setIsDragging(false);
                }}
              />
            </div>
            {/* Times */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/35 font-mono tabular-nums">
                {formatTime(progress)}
              </span>
              <span className="text-[11px] text-white/35 font-mono tabular-nums">
                -{formatTime(Math.max(0, duration - progress))}
              </span>
            </div>
          </div>

          {/* === Controls === */}
          <div className="shrink-0 flex items-center justify-between mb-6 gap-2">
            <button
              onClick={toggleShuffle}
              className={cn(
                "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200",
                shuffle
                  ? "text-primary bg-primary/10"
                  : "text-white/30 hover:text-white/60 hover:bg-white/5",
              )}
            >
              <Shuffle size={20} />
            </button>

            <button
              onClick={prevTrack}
              className="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white transition-all hover:bg-white/5 rounded-full active:scale-90"
            >
              <SkipBack size={28} className="fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/20"
            >
              {isPlaying ? (
                <Pause size={26} className="text-black fill-black" />
              ) : (
                <Play size={26} className="text-black fill-black ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white transition-all hover:bg-white/5 rounded-full active:scale-90"
            >
              <SkipForward size={28} className="fill-current" />
            </button>

            <button
              onClick={toggleLoop}
              className={cn(
                "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200",
                loop !== "off"
                  ? "text-primary bg-primary/10"
                  : "text-white/30 hover:text-white/60 hover:bg-white/5",
              )}
            >
              {loopIcon}
            </button>
          </div>

          {/* Safe area bottom spacer */}
          <div className="shrink-0 h-4" />
        </div>
      </div>
    </>
  );
}
