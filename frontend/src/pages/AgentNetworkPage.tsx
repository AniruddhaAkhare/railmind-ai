import React, { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { agentGraphSocket } from '../config/socket'
import { useAgentGraphStore, AgentGraphEvent } from '../stores/useAgentGraphStore'
import { useCommandStore } from '../stores/useCommandStore'
import CustomEdge from '../agents/CustomEdge'
import ExecutionTrace from '../agents/ExecutionTrace'
import AgentMemoryPanel from '../agents/AgentMemoryPanel'
import ThoughtCorridor from '../agents/ThoughtCorridor'
import RailwayBrainView from '../agents/RailwayBrainView'
import {
  Eye, BrainCircuit, Activity, AlertTriangle, Network, Cpu, Workflow,
  ShieldAlert, Navigation, Wrench, Users, Zap, BookOpen, Radio,
  FlameIcon, Loader
} from 'lucide-react'

// ─── Agent icons map ──────────────────────────────────────────────────────────
const AGENT_META: Record<string, { icon: React.FC<any>, color: string, group: 'core'|'domain' }> = {
  'observation':        { icon: Eye,          color: '#0284c7', group: 'core'   },
  'understanding':      { icon: BrainCircuit, color: '#6366f1', group: 'core'   },
  'prediction':         { icon: Activity,     color: '#0891b2', group: 'core'   },
  'risk':               { icon: AlertTriangle,color: '#d97706', group: 'core'   },
  'impact':             { icon: Network,      color: '#7c3aed', group: 'core'   },
  'simulation':         { icon: Zap,          color: '#0284c7', group: 'core'   },
  'decision':           { icon: Cpu,          color: '#059669', group: 'core'   },
  'coordination':       { icon: Workflow,     color: '#0891b2', group: 'core'   },
  'communication':      { icon: Radio,        color: '#6366f1', group: 'core'   },
  'knowledge':          { icon: BookOpen,     color: '#7c3aed', group: 'core'   },
  'safety':             { icon: ShieldAlert,  color: '#dc2626', group: 'domain' },
  'operations':         { icon: Navigation,   color: '#059669', group: 'domain' },
  'maintenance':        { icon: Wrench,       color: '#d97706', group: 'domain' },
  'passenger':          { icon: Users,        color: '#0284c7', group: 'domain' },
  'emergency':          { icon: FlameIcon,    color: '#dc2626', group: 'domain' },
}

const STATUS_LABELS: Record<string, string> = {
  'idle': 'Standby',
  'thinking': 'Thinking...',
  'reasoning': 'Reasoning...',
  'responding': 'Generating Output...',
  'completed': 'Completed',
  'error': 'Error',
}

// ─── Custom AgentNode ─────────────────────────────────────────────────────────
function AgentNode({ data, isConnectable }: any) {
  const meta = AGENT_META[data.id] || { icon: Cpu, color: '#0284c7', group: 'core' }
  const Icon = meta.icon
  
  const status = data.status || 'idle'
  const isThinking = status === 'thinking'
  const isReasoning = status === 'reasoning'
  const isResponding = status === 'responding'
  const isCompleted = status === 'completed'
  const isError = status === 'error'
  const isEmergency = data.isEmergency

  let borderColor = isEmergency ? '#dc2626' : '#e2e8f0'
  let bgColor = '#ffffff'
  let pulse = false

  if (isThinking) {
    borderColor = '#f59e0b'
    bgColor = '#fffbeb'
    pulse = true
  } else if (isReasoning) {
    borderColor = '#3b82f6'
    bgColor = '#eff6ff'
  } else if (isResponding) {
    borderColor = '#6366f1'
    bgColor = '#eef2ff'
  } else if (isCompleted) {
    borderColor = '#10b981'
  } else if (isError) {
    borderColor = '#ef4444'
  }

  const isActive = isThinking || isReasoning || isResponding

  return (
    <div 
      onClick={() => data.onClick && data.onClick(data.id)}
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 140,
        textAlign: 'center',
        boxShadow: isActive ? `0 0 14px ${borderColor}60` : '0 1px 4px rgba(15,23,42,0.07)',
        transition: 'all 0.3s ease',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
        cursor: 'pointer',
        position: 'relative'
      }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: meta.color }} />
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isActive ? meta.color : `${meta.color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 6px',
        transition: 'all 0.3s ease',
      }}>
        {isThinking ? <Loader size={16} color="#fff" className="animate-spin" /> : <Icon size={16} color={isActive ? '#fff' : meta.color} />}
      </div>
      
      {isReasoning && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 44, height: 44, borderRadius: '50%', borderTop: '2px solid #3b82f6',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
        {data.label}
      </div>
      
      {/* Status label with descriptive text */}
      <div style={{
        fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: isActive ? meta.color : (isCompleted ? '#059669' : '#94a3b8'),
        marginTop: 3,
      }}>
        {STATUS_LABELS[status] || status}
      </div>
      
      {/* Live token stream preview */}
      {(isReasoning || isResponding) && data.tokens && (
        <div style={{
          marginTop: 6, fontSize: '0.5rem', color: '#475569', background: '#f8fafc', 
          padding: 4, borderRadius: 4, height: 32, overflow: 'hidden', textAlign: 'left',
          wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace',
          border: '1px solid #e2e8f0',
        }}>
          {data.tokens.length > 50 ? '...' + data.tokens.slice(-50) : data.tokens}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: meta.color }} />
    </div>
  )
}

const nodeTypes = { agentNode: AgentNode }
const edgeTypes = { custom: CustomEdge }

// ─── Initial layout ───────────────────────────────────────────────────────────
const INITIAL_NODES = [
  { id: 'observation',   pos: { x: 200, y: 20  }, label: 'Observation' },
  { id: 'understanding', pos: { x: 200, y: 160 }, label: 'Understanding' },
  { id: 'prediction',    pos: { x: -40, y: 300 }, label: 'Prediction' },
  { id: 'risk',          pos: { x: 200, y: 300 }, label: 'Risk Assessment' },
  { id: 'impact',        pos: { x: 440, y: 300 }, label: 'Impact Analysis' },
  { id: 'simulation',    pos: { x: -40, y: 440 }, label: 'Simulation' },
  { id: 'decision',      pos: { x: 200, y: 440 }, label: 'Decision' },
  { id: 'coordination',  pos: { x: 200, y: 580 }, label: 'Coordination' },
  { id: 'communication', pos: { x: 440, y: 440 }, label: 'Communication' },
  { id: 'knowledge',     pos: { x: 440, y: 580 }, label: 'Knowledge' },
  { id: 'safety',        pos: { x: -80, y: 740 }, label: 'Safety' },
  { id: 'operations',    pos: { x: 80,  y: 740 }, label: 'Operations' },
  { id: 'maintenance',   pos: { x: 240, y: 740 }, label: 'Maintenance' },
  { id: 'passenger',     pos: { x: 400, y: 740 }, label: 'Passenger Services' },
  { id: 'emergency',     pos: { x: 560, y: 740 }, label: 'Emergency Response' },
].map(({ id, pos, label }) => ({
  id,
  type: 'agentNode',
  position: pos,
  data: { id, label, status: 'idle', isEmergency: false },
}))

const INITIAL_EDGES = [
  { from: 'observation',   to: 'understanding' },
  { from: 'understanding', to: 'prediction' },
  { from: 'understanding', to: 'risk' },
  { from: 'understanding', to: 'impact' },
  { from: 'prediction',    to: 'simulation' },
  { from: 'risk',          to: 'decision' },
  { from: 'impact',        to: 'decision' },
  { from: 'decision',      to: 'coordination' },
  { from: 'decision',      to: 'communication' },
  { from: 'coordination',  to: 'safety' },
  { from: 'coordination',  to: 'operations' },
  { from: 'coordination',  to: 'maintenance' },
  { from: 'coordination',  to: 'passenger' },
  { from: 'coordination',  to: 'emergency' },
  { from: 'communication', to: 'knowledge' },
].map(({ from, to }, i) => ({
  id: `e${i}`,
  source: from,
  target: to,
  type: 'custom',
  data: { isAnimating: false }
}))

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AgentNetworkPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(JSON.parse(JSON.stringify(INITIAL_NODES)))
  const [edges, setEdges, onEdgesChange] = useEdgesState(JSON.parse(JSON.stringify(INITIAL_EDGES)))
  const { nodeStates, nodeTokens, addEvent, setSelectedNode, selectedNodeId } = useAgentGraphStore()
  const { emergencyMode } = useCommandStore()
  const [rightTab, setRightTab] = useState<'brain' | 'trace'>('brain')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // WebSocket connection
  useEffect(() => {
    // We already have the shared socket connected
    const socket = agentGraphSocket
    
    socket.on('graph_event', (event: AgentGraphEvent) => {
      addEvent(event)
      
      if (event.event_type === 'agent_message_sent' && event.from_agent) {
        // Animate the outgoing edge from this agent
        setEdges(eds => eds.map(e => {
          if (e.source.toLowerCase() === event.from_agent.toLowerCase() ||
              event.from_agent.toLowerCase().includes(e.source.toLowerCase())) {
            return { ...e, data: { ...e.data, isAnimating: true } }
          }
          return e
        }))
        
        setTimeout(() => {
          setEdges(eds => eds.map(e => ({
            ...e, data: { ...e.data, isAnimating: false }
          })))
        }, 2000)
      }
    })
    return () => { 
      socket.off('graph_event')
    }
  }, [addEvent, setEdges])

  // Sync active states → React Flow
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const dbAgentName = n.id
      const agentKey = Object.keys(nodeStates).find(k => k.toLowerCase().includes(dbAgentName))
      const status = agentKey ? nodeStates[agentKey] : 'idle'
      const tokens = agentKey ? nodeTokens[agentKey] : ''
      
      return {
        ...n,
        data: { 
          ...n.data, 
          status,
          tokens,
          isEmergency: emergencyMode !== 'none',
          onClick: setSelectedNode
        },
      }
    }))
  }, [nodeStates, nodeTokens, emergencyMode, setNodes, setSelectedNode])

  const rightTabs = [
    { key: 'brain' as const, label: '🧠 Brain' },
    { key: 'trace' as const, label: '📋 Trace' },
  ]

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Agent Network Control Room</h1>
        <p className="page-subtitle">
          Live visualization of LangGraph multi-agent execution, OpenRouter streaming, and cascading insights
        </p>
      </div>

      {/* Body: main area + right sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        
        {/* LEFT — React Flow Graph */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          
          {/* Graph area */}
          <div style={{ flex: 1, position: 'relative', background: '#f8fafc', minHeight: 400 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {isMounted && (
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    onInit={(instance) => {
                      setTimeout(() => {
                        window.requestAnimationFrame(() => {
                          instance.fitView({ padding: 0.15, duration: 500 })
                        })
                      }, 100)
                    }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Background color="#e2e8f0" gap={20} size={1} />
                    <Controls style={{ bottom: 12, right: 12, top: 'auto' }} />
                    <MiniMap style={{ bottom: 12, right: 60, top: 'auto' }} maskColor="rgba(241,245,249,0.7)" />
                  </ReactFlow>
                </ReactFlowProvider>
              )}
            </div>
            
            {/* Agent Memory Panel (overlays on top of graph) */}
            <AgentMemoryPanel />
          </div>

          {/* BOTTOM — AI Thought Corridor */}
          <div style={{
            height: 100, flexShrink: 0,
            borderTop: '1px solid #e2e8f0',
            background: '#fff',
            minWidth: 0,
          }}>
            <ThoughtCorridor />
          </div>
        </div>

        {/* RIGHT — Brain View / Execution Trace */}
        <div style={{
          width: 280, flexShrink: 0,
          borderLeft: '1px solid #e2e8f0',
          background: '#fff',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
          }}>
            {rightTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                style={{
                  flex: 1, padding: '8px 0', background: 'none', border: 'none',
                  borderBottom: rightTab === tab.key ? '2px solid #0284c7' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                  color: rightTab === tab.key ? '#0284c7' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {rightTab === 'brain' ? <RailwayBrainView /> : <ExecutionTrace />}
          </div>
        </div>
      </div>
    </div>
  )
}
