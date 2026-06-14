import React, { useEffect, useState } from 'react'
import { useAgentGraphStore } from '../stores/useAgentGraphStore'
import { api } from '../config/api'
import { X, Brain, TrendingUp, MessageSquare, Target, Clock } from 'lucide-react'

interface MemoryEntry {
  id: number
  content: string
  reasoning?: string
  confidence: number
  message_type: string
  created_at: string
}

export default function AgentMemoryPanel() {
  const { selectedNodeId, setSelectedNode, nodeData, nodeStates } = useAgentGraphStore()
  const [messages, setMessages] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'confidence'>('live')

  // Fetch message history from backend when an agent is selected
  useEffect(() => {
    if (!selectedNodeId) return

    const fetchMemory = async () => {
      setLoading(true)
      try {
        // Find the agent's db ID from the agents API
        const agentsRes = await api.get('/agents') as any
        const agents = agentsRes.agents || []
        const agent = agents.find((a: any) =>
          a.agent_type?.toLowerCase() === selectedNodeId.toLowerCase() ||
          a.name?.toLowerCase().includes(selectedNodeId.toLowerCase())
        )
        if (agent) {
          const msgsRes = await api.get(`/agents/${agent.id}/messages?limit=15`) as any
          setMessages(msgsRes.messages || [])
        }
      } catch (err) {
        console.error('Failed to fetch agent memory:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [selectedNodeId])

  if (!selectedNodeId) return null

  const agentKey = Object.keys(nodeStates).find(k => k.toLowerCase().includes(selectedNodeId.toLowerCase())) || selectedNodeId
  const status = nodeStates[agentKey] || 'idle'
  const data = nodeData[agentKey] || {}

  const tabs = [
    { key: 'live' as const, label: 'Live State', icon: Target },
    { key: 'history' as const, label: 'Memory', icon: MessageSquare },
    { key: 'confidence' as const, label: 'Confidence', icon: TrendingUp },
  ]

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 320, background: '#fff', borderLeft: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
      animation: 'slideInRight 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        background: '#0f172a', color: '#fff', padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Brain size={16} color="#38bdf8" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {selectedNodeId} Agent
          </div>
          <div style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: 1 }}>
            Memory Explorer
          </div>
        </div>
        <div style={{
          fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
          color: status === 'completed' ? '#34d399' : (status === 'thinking' ? '#fbbf24' : '#94a3b8'),
          background: status === 'completed' ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)',
          padding: '2px 6px', borderRadius: 3,
        }}>
          {status}
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 0', background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #0284c7' : '2px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
              color: activeTab === tab.key ? '#0284c7' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

        {/* Live State Tab */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.confidence !== undefined && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  Confidence Level
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width 0.5s',
                      width: `${(data.confidence || 0) * 100}%`,
                      background: data.confidence > 0.7 ? '#10b981' : data.confidence > 0.4 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>
                    {Math.round((data.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {data.summary && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  Executive Summary
                </div>
                <p style={{ fontSize: '0.7rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                  {data.summary}
                </p>
              </div>
            )}

            {data.recommendations && data.recommendations.length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                  Recommendations
                </div>
                {data.recommendations.map((rec: string, i: number) => (
                  <div key={i} style={{
                    fontSize: '0.65rem', color: '#475569', display: 'flex', gap: 6,
                    alignItems: 'flex-start', marginBottom: 4,
                  }}>
                    <span style={{ color: '#0284c7', fontWeight: 700 }}>•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}

            {!data.summary && !data.confidence && (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: '0.7rem' }}>
                No live data yet. Trigger an event to see this agent's reasoning.
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: '0.7rem' }}>
                Loading agent memory...
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: '0.7rem' }}>
                No stored memories yet.
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id || idx} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: '0.55rem', fontWeight: 700, color: '#0284c7',
                      textTransform: 'uppercase',
                    }}>
                      {msg.message_type}
                    </span>
                    <span style={{ fontSize: '0.5rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.65rem', color: '#475569', lineHeight: 1.4, margin: 0,
                    maxHeight: 48, overflow: 'hidden',
                  }}>
                    {msg.content?.slice(0, 200)}
                  </p>
                  {msg.confidence > 0 && (
                    <div style={{
                      marginTop: 4, fontSize: '0.5rem', color: '#64748b',
                    }}>
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Confidence Evolution Tab */}
        {activeTab === 'confidence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: '0.6rem', fontWeight: 700, color: '#64748b',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              Confidence Over Time
            </div>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: '0.7rem' }}>
                No confidence data available yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Simple sparkline using div bars */}
                <div style={{
                  display: 'flex', alignItems: 'flex-end', gap: 2, height: 80,
                  padding: '0 4px', borderBottom: '1px solid #e2e8f0',
                }}>
                  {messages.slice().reverse().map((msg, idx) => {
                    const h = Math.max(4, (msg.confidence || 0) * 80)
                    const c = msg.confidence > 0.7 ? '#10b981' : msg.confidence > 0.4 ? '#f59e0b' : '#ef4444'
                    return (
                      <div key={idx} style={{
                        flex: 1, height: h, background: c, borderRadius: '2px 2px 0 0',
                        transition: 'height 0.3s', minWidth: 4, maxWidth: 20,
                        opacity: 0.8,
                      }}
                        title={`${Math.round((msg.confidence || 0) * 100)}%`}
                      />
                    )
                  })}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.45rem', color: '#94a3b8',
                }}>
                  <span>Oldest</span>
                  <span>Latest</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
