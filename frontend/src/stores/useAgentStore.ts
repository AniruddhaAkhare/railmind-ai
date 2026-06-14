import { create } from 'zustand'

export interface RailAgent {
  id: number
  name: string
  agent_type: string
  status: 'idle' | 'active' | 'processing' | 'error' | 'offline'
  total_decisions: number
  success_rate: number
  avg_confidence: number
}

export interface AgentMessage {
  id: number
  agent_id: number
  event_id: number | null
  message_type: string
  content: string
  reasoning: string | null
  confidence: number
  created_at: string
}

interface AgentStore {
  agents: RailAgent[]
  messages: AgentMessage[]
  loading: boolean
  error: string | null
  setAgents: (agents: RailAgent[]) => void
  addMessage: (msg: AgentMessage) => void
  updateAgentStatus: (id: number, status: RailAgent['status']) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  messages: [],
  loading: false,
  error: null,

  setAgents: (agents) => set({ agents }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [msg, ...state.messages].slice(0, 200), // keep last 200
    })),

  updateAgentStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}))
