import { create } from 'zustand'

export type AgentEventType = 
  | 'event_created'
  | 'agent_started' 
  | 'agent_reasoning' 
  | 'agent_stream_chunk' 
  | 'agent_message_sent' 
  | 'agent_message_received' 
  | 'agent_completed' 
  | 'agent_failed' 
  | 'workflow_completed' 
  | 'state_updated'
  | 'emergency_trigger'

export interface AgentGraphEvent {
  id: string
  event_type: AgentEventType
  timestamp: string
  from_agent: string
  to_agent: string
  state_snapshot?: any
  message?: {
    chunk?: string
    reasoning?: string
    summary?: string
    confidence?: number
    recommendations?: string[]
    action_plan?: string[]
    stakeholder_impact?: string
    future_predictions?: string
    error?: string
  }
}

export type NodeStatus = 'idle' | 'thinking' | 'reasoning' | 'responding' | 'completed' | 'error'

interface AgentGraphState {
  events: AgentGraphEvent[]
  nodeStates: Record<string, NodeStatus>
  nodeTokens: Record<string, string>
  nodeData: Record<string, any>
  selectedNodeId: string | null
  executionTrace: AgentGraphEvent[]
  
  addEvent: (event: AgentGraphEvent) => void
  setSelectedNode: (nodeId: string | null) => void
  clearEvents: () => void
}

export const useAgentGraphStore = create<AgentGraphState>((set) => ({
  events: [],
  nodeStates: {},
  nodeTokens: {},
  nodeData: {},
  selectedNodeId: null,
  executionTrace: [],

  addEvent: (event) => set((state) => {
    const newEvents = [event, ...state.events].slice(0, 1000)
    let newNodeStates = { ...state.nodeStates }
    let newNodeTokens = { ...state.nodeTokens }
    let newNodeData = { ...state.nodeData }
    let newTrace = [...state.executionTrace]

    const agent = event.from_agent

    switch (event.event_type) {
      case 'agent_started':
        newNodeStates[agent] = 'thinking'
        newNodeTokens[agent] = ''
        newTrace.push(event)
        break
      case 'agent_stream_chunk':
        newNodeStates[agent] = 'reasoning'
        newNodeTokens[agent] = (newNodeTokens[agent] || '') + (event.message?.chunk || '')
        break
      case 'agent_message_sent':
        newNodeStates[agent] = 'responding'
        if (event.message) {
          newNodeData[agent] = { ...newNodeData[agent], ...event.message }
        }
        newTrace.push(event)
        break
      case 'agent_completed':
      case 'state_updated':
        newNodeStates[agent] = 'completed'
        break
      case 'agent_failed':
        newNodeStates[agent] = 'error'
        if (event.message) {
          newNodeData[agent] = { ...newNodeData[agent], error: event.message.error }
        }
        newTrace.push(event)
        break
      case 'workflow_completed':
        // Optional: mark all as completed or leave as is
        newTrace.push(event)
        break
    }

    return {
      events: newEvents,
      nodeStates: newNodeStates,
      nodeTokens: newNodeTokens,
      nodeData: newNodeData,
      executionTrace: newTrace
    }
  }),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  
  clearEvents: () => set({ 
    events: [], 
    nodeStates: {}, 
    nodeTokens: {}, 
    nodeData: {},
    executionTrace: [] 
  })
}))
