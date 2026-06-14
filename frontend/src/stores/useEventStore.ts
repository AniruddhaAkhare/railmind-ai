import { create } from 'zustand'

export interface RailEvent {
  id: number
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  priority: number
  status: string
  description: string | null
  station_id: number | null
  track_id: number | null
  train_id: number | null
  affected_passengers: number
  estimated_delay_minutes: number
  created_at: string
  updated_at: string | null
  resolved_at: string | null
}

export interface EventStats {
  total: number
  critical: number
  high: number
  open: number
  resolved: number
}

interface EventStore {
  events: RailEvent[]
  stats: EventStats
  loading: boolean
  error: string | null
  setEvents: (events: RailEvent[]) => void
  setStats: (stats: EventStats) => void
  addEvent: (event: RailEvent) => void
  updateEvent: (id: number, updates: Partial<RailEvent>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  stats: { total: 0, critical: 0, high: 0, open: 0, resolved: 0 },
  loading: false,
  error: null,

  setEvents: (events) => set({ events }),

  setStats: (stats) => set({ stats }),

  addEvent: (event) =>
    set((state) => ({ events: [event, ...state.events] })),

  updateEvent: (id, updates) =>
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}))
