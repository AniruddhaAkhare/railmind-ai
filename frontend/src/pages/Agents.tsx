import React, { useEffect, useCallback } from 'react'
import { Bot, RefreshCw, MessageSquare, TrendingUp } from 'lucide-react'
import { api } from '../config/api'
import { agentsSocket } from '../config/socket'
import { useAgentStore, RailAgent, AgentMessage } from '../stores/useAgentStore'

const AGENT_TYPE_ICONS: Record<string, string> = {
  observation: '👁️',
  understanding: '🧠',
  prediction: '🔮',
  risk: '⚠️',
  impact: '💥',
  simulation: '🧪',
  decision: '⚡',
  coordination: '🔗',
  communication: '📡',
  knowledge: '📚',
  safety: '🛡️',
  maintenance: '🔧',
  operations: '🚂',
  passenger: '👥',
  emergency: '🚨',
}

function AgentStatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

function AgentCard({ agent }: { agent: RailAgent }) {
  const icon = AGENT_TYPE_ICONS[agent.agent_type] || '🤖'
  const successPct = Math.round((agent.success_rate || 0) * 100)
  const confPct = Math.round((agent.avg_confidence || 0) * 100)

  return (
    <div className="agent-card animate-fade-in">
      <div className="agent-card-header">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>
          <div>
            <div className="agent-name">{agent.name}</div>
            <div className="agent-type-label">{agent.agent_type}</div>
          </div>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      <div className="agent-metrics">
        <div className="agent-metric">
          <div className="agent-metric-label">Decisions</div>
          <div className="agent-metric-value">{agent.total_decisions}</div>
        </div>
        <div className="agent-metric">
          <div className="agent-metric-label">Confidence</div>
          <div className="agent-metric-value">{confPct}%</div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
        }}>
          <span>Success Rate</span>
          <span>{successPct}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${successPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function MessageFeed({ messages }: { messages: AgentMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px' }}>
        <div className="empty-state-icon">📡</div>
        <div className="empty-state-text">Waiting for agent messages...</div>
      </div>
    )
  }

  return (
    <div className="message-feed">
      {messages.slice(0, 30).map((msg, index) => (
        <div key={msg.id || index} className="message-item">
          <div className="message-meta">
            <span className="message-agent">
              {AGENT_TYPE_ICONS[msg.message_type] || '🤖'} Agent #{msg.agent_id}
            </span>
            <span className="message-time">
              {new Date(msg.created_at).toLocaleTimeString('en-IN')}
            </span>
          </div>
          <div style={{ lineHeight: 1.5 }}>{msg.content}</div>
          {msg.confidence > 0 && (
            <div style={{
              fontSize: '0.65rem',
              color: 'var(--color-text-muted)',
              marginTop: 4,
            }}>
              Confidence: {Math.round(msg.confidence * 100)}%
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Agents() {
  const { agents, messages, loading, error, setAgents, addMessage, setLoading, setError } =
    useAgentStore()

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/agents') as any
      setAgents(res.agents || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()

    agentsSocket.on('agent_message', (msg: AgentMessage) => addMessage(msg))
    agentsSocket.on('agent_decision', (msg: any) => addMessage(msg))
    agentsSocket.on('agent_status', (data: {id: number, status: string}) => updateAgentStatus(data.id, data.status as any))

    return () => {
      agentsSocket.off('agent_message')
      agentsSocket.off('agent_decision')
      agentsSocket.off('agent_status')
    }
  }, [])

  const activeCount = agents.filter((a) => a.status === 'active' || a.status === 'processing').length
  const idleCount = agents.filter((a) => a.status === 'idle').length

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">AI Agent Network</h1>
            <p className="page-subtitle">
              {agents.length} agents deployed • {activeCount} active • {idleCount} idle
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={fetchAgents}
            disabled={loading}
            style={{ fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Agent Grid */}
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-muted)',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Bot size={14} />
              Agent Roster
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="spinner" />
                <span>Loading agents...</span>
              </div>
            ) : agents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🤖</div>
                <div className="empty-state-title">No agents registered</div>
                <div className="empty-state-text">
                  Agents will appear once the backend initialises and seeds the database.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}>
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>

          {/* Live Message Feed */}
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-muted)',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <MessageSquare size={14} />
              Live Agent Feed
              {messages.length > 0 && (
                <span style={{
                  marginLeft: 4,
                  background: 'rgba(59,130,246,0.15)',
                  color: '#93c5fd',
                  padding: '1px 6px',
                  borderRadius: 100,
                  fontSize: '0.65rem',
                }}>
                  {messages.length}
                </span>
              )}
            </div>
            <div className="card" style={{ padding: 12 }}>
              <MessageFeed messages={messages} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}