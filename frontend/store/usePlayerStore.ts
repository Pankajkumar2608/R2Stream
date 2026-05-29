import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../types'

interface PlayerState {
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  volume: number
  loop: 'off' | 'all' | 'one'
  shuffle: boolean
  
  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void
  togglePlay: () => void
  setIsPlaying: (isPlaying: boolean) => void
  nextTrack: () => void
  prevTrack: () => void
  setVolume: (volume: number) => void
  toggleLoop: () => void
  toggleShuffle: () => void
  setQueue: (queue: Track[]) => void
  clearQueue: () => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      volume: 1,
      loop: 'off',
      shuffle: false,

      playTrack: (track, newQueue) => set((state) => {
        let queue = newQueue || state.queue
        if (queue.length === 0) {
          queue = [track]
        }
        const index = queue.findIndex((t) => t.id === track.id)
        
        return {
          queue,
          currentIndex: index !== -1 ? index : 0,
          isPlaying: true,
        }
      }),

      togglePlay: () => set((state) => ({ 
        isPlaying: state.currentIndex !== -1 ? !state.isPlaying : false 
      })),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      nextTrack: () => set((state) => {
        if (state.queue.length === 0) return state

        let nextIndex = state.currentIndex + 1
        
        if (nextIndex >= state.queue.length) {
          if (state.loop === 'all') {
            nextIndex = 0
          } else {
            return { ...state, isPlaying: false, currentIndex: state.queue.length - 1 }
          }
        }
        
        return { currentIndex: nextIndex, isPlaying: true }
      }),

      prevTrack: () => set((state) => {
        if (state.queue.length === 0) return state

        let prevIndex = state.currentIndex - 1
        
        if (prevIndex < 0) {
          if (state.loop === 'all') {
            prevIndex = state.queue.length - 1
          } else {
            prevIndex = 0
          }
        }
        
        return { currentIndex: prevIndex, isPlaying: true }
      }),

      setVolume: (volume) => set({ volume }),

      toggleLoop: () => set((state) => {
        const nextMode = {
          'off': 'all',
          'all': 'one',
          'one': 'off'
        } as const
        return { loop: nextMode[state.loop] }
      }),

      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })), // Note: Full shuffle implementation would need to reorder the queue while keeping current song at index 0

      setQueue: (queue) => set({ queue }),

      clearQueue: () => set({ queue: [], currentIndex: -1, isPlaying: false })
    }),
    {
      name: 'musync-player-storage',
      partialize: (state) => ({ volume: state.volume, loop: state.loop, shuffle: state.shuffle }), // Only persist these
    }
  )
)
