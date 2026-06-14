import { create } from 'zustand'

export type EmergencyType = 'none' | 'flood' | 'accident' | 'fire' | 'signal_failure' | 'network_disruption'

interface CommandState {
  emergencyMode: EmergencyType
  setEmergencyMode: (mode: EmergencyType) => void

  selectedAssetId: string | null
  setSelectedAssetId: (id: string | null) => void

  replayMode: boolean
  setReplayMode: (val: boolean) => void
  replayTime: number
  setReplayTime: (val: number) => void

  mapViewport: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
  }
  setMapViewport: (viewport: any) => void
}

export const useCommandStore = create<CommandState>((set) => ({
  emergencyMode: 'none',
  setEmergencyMode: (mode) => set({ emergencyMode: mode }),

  selectedAssetId: null,
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),

  replayMode: false,
  setReplayMode: (val) => set({ replayMode: val }),
  replayTime: Date.now(),
  setReplayTime: (val) => set({ replayTime: val }),

  mapViewport: {
    longitude: 78.9629, // India center
    latitude: 20.5937,
    zoom: 4,
    pitch: 0,
    bearing: 0,
  },
  setMapViewport: (viewport) => set((state) => ({ mapViewport: { ...state.mapViewport, ...viewport } })),
}))
