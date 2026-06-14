import React, { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAgentGraphStore, AgentGraphEvent } from '../stores/useAgentGraphStore'
import { agentGraphSocket } from '../config/socket'
import CustomEdge from './CustomEdge'
import { Activity, ShieldAlert, Cpu, Eye, Network, AlertTriangle, Workflow, BrainCircuit, Users, Navigation, Wrench, Loader } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  'idle': 'Standby',
  'thinking': 'Thinking...',
  'reasoning': 'Reasoning...',
  'responding': 'Generating...',
  'completed': 'Completed',
  'error': 'Error',
}

const AgentNode = ({ data, isConnectable }: any) => {
  const status = data.status || 'idle'
  const isThinking = status === 'thinking'
  const isReasoning = status === 'reasoning'
  const isResponding = status === 'responding'
  const isCompleted = status === 'completed'
  const isError = status === 'error'

  let borderColor = 'border-slate-200'
  let bgColor = 'bg-slate-100 text-slate-500'
  let pulse = false

  if (isThinking) {
    borderColor = 'border-amber-400 shadow-glow-amber'
    bgColor = 'bg-amber-400 text-white'
    pulse = true
  } else if (isReasoning) {
    borderColor = 'border-blue-500 shadow-glow-blue'
    bgColor = 'bg-blue-500 text-white'
  } else if (isResponding) {
    borderColor = 'border-indigo-500 shadow-glow-indigo'
    bgColor = 'bg-indigo-500 text-white'
  } else if (isCompleted) {
    borderColor = 'border-emerald-500'
    bgColor = 'bg-emerald-500 text-white'
  } else if (isError) {
    borderColor = 'border-red-500'
    bgColor = 'bg-red-500 text-white'
  }

  return (
    <div 
      className={`glass-panel p-3 border-2 transition-all duration-300 w-48 ${borderColor} ${(isThinking || isReasoning || isResponding) ? 'scale-105' : ''}`}
      onClick={() => data.onClick && data.onClick(data.id)}
    >
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div className="flex flex-col items-center relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 z-10 ${bgColor} ${pulse ? 'animate-pulse' : ''}`}>
          {isThinking ? <Loader className="animate-spin" size={20} /> : <data.icon size={20} />}
        </div>
        
        {isReasoning && (
          <div className="absolute top-0 w-12 h-12 rounded-full border-t-2 border-blue-400 animate-spin z-0" />
        )}
        
        <span className="text-xs font-bold text-slate-700 text-center uppercase tracking-wider">{data.label}</span>
        <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
          {STATUS_LABELS[status] || status}
        </span>
        
        {(isReasoning || isResponding) && data.tokens && (
          <div className="mt-2 text-[10px] text-slate-600 bg-slate-100 p-1 rounded w-full h-12 overflow-hidden overflow-ellipsis break-words font-mono border border-slate-200">
            {data.tokens.length > 60 ? data.tokens.slice(-60) + '...' : data.tokens}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  )
}

const nodeTypes = {
  agentNode: AgentNode
}

const edgeTypes = {
  custom: CustomEdge
}

const staticNodes: Node[] = [
  { id: 'observation', type: 'agentNode', position: { x: 250, y: 50 }, data: { label: 'Observation', type: 'Core', icon: Eye } },
  { id: 'understanding', type: 'agentNode', position: { x: 250, y: 200 }, data: { label: 'Understanding', type: 'Core', icon: BrainCircuit } },
  { id: 'prediction', type: 'agentNode', position: { x: 50, y: 350 }, data: { label: 'Prediction', type: 'Core', icon: Activity } },
  { id: 'risk', type: 'agentNode', position: { x: 250, y: 350 }, data: { label: 'Risk', type: 'Core', icon: AlertTriangle } },
  { id: 'impact', type: 'agentNode', position: { x: 450, y: 350 }, data: { label: 'Impact', type: 'Core', icon: Network } },
  { id: 'decision', type: 'agentNode', position: { x: 250, y: 500 }, data: { label: 'Decision', type: 'Core', icon: Cpu } },
  { id: 'coordination', type: 'agentNode', position: { x: 250, y: 650 }, data: { label: 'Coordination', type: 'Core', icon: Workflow } },
  { id: 'communication', type: 'agentNode', position: { x: 250, y: 800 }, data: { label: 'Communication', type: 'Core', icon: Network } },
  
  // Domain Agents
  { id: 'safety', type: 'agentNode', position: { x: -50, y: 950 }, data: { label: 'Safety', type: 'Domain', icon: ShieldAlert } },
  { id: 'operations', type: 'agentNode', position: { x: 150, y: 950 }, data: { label: 'Operations', type: 'Domain', icon: Navigation } },
  { id: 'maintenance', type: 'agentNode', position: { x: 350, y: 950 }, data: { label: 'Maintenance', type: 'Domain', icon: Wrench } },
  { id: 'passenger', type: 'agentNode', position: { x: 550, y: 950 }, data: { label: 'Passenger', type: 'Domain', icon: Users } },
]

const staticEdges: Edge[] = [
  { id: 'e1', source: 'observation', target: 'understanding', type: 'custom' },
  { id: 'e2', source: 'understanding', target: 'prediction', type: 'custom' },
  { id: 'e3', source: 'understanding', target: 'risk', type: 'custom' },
  { id: 'e4', source: 'understanding', target: 'impact', type: 'custom' },
  { id: 'e5', source: 'risk', target: 'decision', type: 'custom' },
  { id: 'e6', source: 'impact', target: 'decision', type: 'custom' },
  { id: 'e7', source: 'prediction', target: 'decision', type: 'custom' },
  { id: 'e8', source: 'decision', target: 'coordination', type: 'custom' },
  { id: 'e9', source: 'coordination', target: 'communication', type: 'custom' },
  { id: 'e10', source: 'communication', target: 'safety', type: 'custom' },
  { id: 'e11', source: 'communication', target: 'operations', type: 'custom' },
  { id: 'e12', source: 'communication', target: 'maintenance', type: 'custom' },
  { id: 'e13', source: 'communication', target: 'passenger', type: 'custom' },
]

export default function AgentNetworkGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState(staticNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(staticEdges)
  const { nodeStates, nodeTokens, addEvent, setSelectedNode } = useAgentGraphStore()

  useEffect(() => {
    agentGraphSocket.on('connect', () => console.log('Connected to Agent Graph WS'))
    
    agentGraphSocket.on('graph_event', (event: AgentGraphEvent) => {
      addEvent(event)
      
      // Animate edge when message is sent
      if (event.event_type === 'agent_message_sent' && event.from_agent) {
        setEdges(eds => eds.map(e => {
          if (e.source.toLowerCase().includes(event.from_agent.toLowerCase()) ||
              event.from_agent.toLowerCase().includes(e.source.toLowerCase())) {
            return { ...e, data: { isAnimating: true } }
          }
          return e
        }))
        
        setTimeout(() => {
          setEdges(eds => eds.map(e => ({ ...e, data: { isAnimating: false } })))
        }, 2000)
      }
    })

    return () => {
      agentGraphSocket.off('connect')
      agentGraphSocket.off('graph_event')
    }
  }, [setEdges, addEvent])

  // Sync active state from Zustand to React Flow nodes
  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const agentKey = Object.keys(nodeStates).find(k => k.toLowerCase().includes(node.id.toLowerCase()))
      const status = agentKey ? nodeStates[agentKey] : 'idle'
      const tokens = agentKey ? nodeTokens[agentKey] : ''
      
      return {
        ...node,
        data: {
          ...node.data,
          id: node.id,
          status,
          tokens,
          onClick: setSelectedNode
        }
      }
    }))
  }, [nodeStates, nodeTokens, setNodes, setSelectedNode])

  return (
    <div className="w-full h-full bg-slate-50 border-r border-slate-200 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-slate-50"
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls />
      </ReactFlow>
      
      <div className="absolute top-4 left-4 z-10 glass-panel p-3 pointer-events-none">
        <h3 className="card-title text-slate-800">Agent Network</h3>
        <p className="text-xs text-slate-500 font-medium mt-1">Live execution visualizer</p>
      </div>
    </div>
  )
}
