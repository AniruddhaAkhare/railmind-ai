import React, { useRef, useEffect } from 'react'
import { useAgentGraphStore } from '../stores/useAgentGraphStore'
import { BrainCircuit } from 'lucide-react'

const PHASE_LABELS: Record<string, string> = {
  'agent_started': 'Thinking...',
  'agent_stream_chunk': 'Reasoning...',
  'agent_message_sent': 'Output Generated',
  'agent_completed': 'Completed',
  'agent_failed': 'Failed',
  'workflow_completed': 'Pipeline Complete',
  'emergency_trigger': 'Emergency Triggered',
}

const AGENT_COLORS: Record<string, string> = {
  'observation': '#0284c7',
  'understanding': '#6366f1',
  'prediction': '#0891b2',
  'risk': '#d97706',
  'impact': '#7c3aed',
  'simulation': '#0ea5e9',
  'decision': '#059669',
  'coordination': '#0891b2',
  'communication': '#6366f1',
  'knowledge': '#7c3aed',
  'safety': '#dc2626',
  'maintenance': '#d97706',
  'operations': '#059669',
  'passenger': '#0284c7',
  'emergency': '#dc2626',
}

function getAgentColor(name: string): string {
  if (!name) return '#64748b'
  const key = Object.keys(AGENT_COLORS).find(k => name.toLowerCase().includes(k))
  return key ? AGENT_COLORS[key] : '#64748b'
}

export default function ThoughtCorridor() {
  const { executionTrace, nodeStates, nodeTokens } = useAgentGraphStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the right as new thoughts arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [executionTrace, nodeTokens])

  // Only show meaningful events (not stream chunks)
  const thoughts = executionTrace.filter(e =>
    ['agent_started', 'agent_message_sent', 'agent_completed', 'workflow_completed', 'emergency_trigger'].includes(e.event_type)
  )

  if (thoughts.length === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600,
      }}>
        <BrainCircuit size={16} />
        <span>AI Thought Corridor — Waiting for LangGraph execution...</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        <BrainCircuit size={14} color="#6366f1" />
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AI Thought Corridor
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.55rem', fontWeight: 700,
          color: '#059669', background: '#ecfdf5', border: '1px solid #bbf7d0',
          padding: '1px 6px', borderRadius: 4,
        }}>
          {thoughts.length} STEPS
        </span>
      </div>

      {/* Scrolling corridor */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 0,
          overflowX: 'auto', overflowY: 'hidden', padding: '8px 12px',
          scrollBehavior: 'smooth',
        }}
      >
        {thoughts.map((thought, idx) => {
          const color = getAgentColor(thought.from_agent)
          const isLast = idx === thoughts.length - 1
          const phase = PHASE_LABELS[thought.event_type] || thought.event_type
          let summary = thought.message?.summary?.slice(0, 60) || phase

          // Live tokens overriding static phase
          if (thought.event_type === 'agent_started' && nodeTokens[thought.from_agent]) {
            const tokens = nodeTokens[thought.from_agent]
            summary = tokens.length > 60 ? '...' + tokens.slice(-60) : tokens
          }

          return (
            <React.Fragment key={thought.id || idx}>
              {/* Thought Node */}
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 100, flexShrink: 0, position: 'relative',
                  animation: 'fadeInUp 0.4s ease-out',
                }}
              >
                {/* Pulse ring for active */}
                {isLast && thought.event_type === 'agent_started' && (
                  <div style={{
                    position: 'absolute', top: -2, width: 32, height: 32,
                    borderRadius: '50%', border: `2px solid ${color}`,
                    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                    opacity: 0.4,
                  }} />
                )}

                {/* Node circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isLast ? `0 0 12px ${color}60` : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s',
                  border: `2px solid ${isLast ? '#fff' : 'transparent'}`,
                }}>
                  <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#fff' }}>
                    {idx + 1}
                  </span>
                </div>

                {/* Agent name */}
                <div style={{
                  fontSize: '0.55rem', fontWeight: 700, color: '#334155',
                  marginTop: 4, textAlign: 'center', maxWidth: 90,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {thought.from_agent ? thought.from_agent.replace(' Agent', '') : 'System'}
                </div>

                {/* Summary */}
                <div style={{
                  fontSize: '0.48rem', color: '#64748b', marginTop: 2,
                  textAlign: 'center', maxWidth: 90, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {summary}
                </div>
              </div>

              {/* Connector arrow */}
              {idx < thoughts.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  width: 32, justifyContent: 'center',
                }}>
                  <div style={{
                    width: 24, height: 2, background: `linear-gradient(90deg, ${color}, ${getAgentColor(thoughts[idx + 1].from_agent)})`,
                    borderRadius: 1, position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', right: -3, top: -3,
                      width: 0, height: 0,
                      borderLeft: `6px solid ${getAgentColor(thoughts[idx + 1].from_agent)}`,
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent',
                    }} />
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
