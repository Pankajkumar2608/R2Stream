import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "../types";

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  loop: "off" | "all" | "one";
  shuffle: boolean;

  progress: number;
  duration: number;
  buffered: number;

  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  setQueue: (queue: Track[]) => void;
  clearQueue: () => void;

  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      volume: 1,
      loop: "off",
      shuffle: false,

      progress: 0,
      duration: 0,
      buffered: 0,

      playTrack: (track, newQueue) =>
        set((state) => {
          let queue = newQueue || state.queue;

          if (queue.length === 0) {
            queue = [track];
          }

          const index = queue.findIndex((t) => t.id === track.id);

          return {
            queue,
            currentIndex: index !== -1 ? index : 0,
            isPlaying: true,
            progress: 0,
          };
        }),

      togglePlay: () =>
        set((state) => ({
          isPlaying: state.currentIndex !== -1 ? !state.isPlaying : false,
        })),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      nextTrack: () =>
        set((state) => {
          if (state.queue.length === 0) return state;

          let nextIndex = state.currentIndex + 1;

          if (nextIndex >= state.queue.length) {
            if (state.loop === "all") {
              nextIndex = 0;
            } else {
              return {
                ...state,
                isPlaying: false,
                currentIndex: state.queue.length - 1,
              };
            }
          }

          return {
            currentIndex: nextIndex,
            isPlaying: true,
            progress: 0,
          };
        }),

      prevTrack: () =>
        set((state) => {
          if (state.queue.length === 0) return state;

          let prevIndex = state.currentIndex - 1;

          if (prevIndex < 0) {
            if (state.loop === "all") {
              prevIndex = state.queue.length - 1;
            } else {
              prevIndex = 0;
            }
          }

          return {
            currentIndex: prevIndex,
            isPlaying: true,
            progress: 0,
          };
        }),

      setVolume: (volume) => set({ volume }),

      toggleLoop: () =>
        set((state) => {
          const nextMode = {
            off: "all",
            all: "one",
            one: "off",
          } as const;

          return {
            loop: nextMode[state.loop],
          };
        }),

      toggleShuffle: () =>
        set((state) => ({
          shuffle: !state.shuffle,
        })),

      setQueue: (queue) => set({ queue }),

      clearQueue: () =>
        set({
          queue: [],
          currentIndex: -1,
          isPlaying: false,
          progress: 0,
          duration: 0,
          buffered: 0,
        }),

      setProgress: (progress) => set({ progress }),

      setDuration: (duration) => set({ duration }),

      setBuffered: (buffered) => set({ buffered }),
    }),
    {
      name: "musync-player-storage",
      partialize: (state) => ({
        volume: state.volume,
        loop: state.loop,
        shuffle: state.shuffle,
      }),
    },
  ),
);
