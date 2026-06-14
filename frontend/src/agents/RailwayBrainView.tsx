import React from 'react'
import { useAgentGraphStore, NodeStatus } from '../stores/useAgentGraphStore'

const LAYERS = [
  { id: 'observation',    label: 'Observation',    color: '#0284c7', description: 'Event Detection & Sensing' },
  { id: 'understanding',  label: 'Understanding',  color: '#6366f1', description: 'Classification & Context' },
  { id: 'risk',           label: 'Risk Analysis',  color: '#d97706', description: 'Severity & Threat Assessment' },
  { id: 'impact',         label: 'Impact',         color: '#7c3aed', description: 'Consequence Modeling' },
  { id: 'decision',       label: 'Decision',       color: '#059669', description: 'Action Recommendation' },
  { id: 'coordination',   label: 'Coordination',   color: '#0891b2', description: 'Resource Deployment' },
  { id: 'communication',  label: 'Communication',  color: '#6366f1', description: 'Stakeholder Notification' },
]

function getStatusStyle(status: NodeStatus | undefined) {
  switch (status) {
    case 'thinking':   return { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', pulse: true, glow: 'rgba(245,158,11,0.3)' }
    case 'reasoning':  return { bg: 'rgba(59,130,246,0.15)',  border: '#3b82f6', pulse: true, glow: 'rgba(59,130,246,0.3)' }
    case 'responding': return { bg: 'rgba(99,102,241,0.15)',  border: '#6366f1', pulse: false, glow: 'rgba(99,102,241,0.3)' }
    case 'completed':  return { bg: 'rgba(16,185,129,0.12)',  border: '#10b981', pulse: false, glow: 'rgba(16,185,129,0.2)' }
    case 'error':      return { bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', pulse: false, glow: 'rgba(239,68,68,0.2)' }
    default:           return { bg: 'transparent',             border: '#e2e8f0', pulse: false, glow: 'none' }
  }
}

export default function RailwayBrainView() {
  const { nodeStates, nodeTokens } = useAgentGraphStore()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      padding: '8px 0', height: '100%', overflow: 'auto',
    }}>
      <div style={{
        fontSize: '0.6rem', fontWeight: 800, color: '#334155',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '0 12px 8px', borderBottom: '1px solid #e2e8f0',
      }}>
        🧠 Railway Brain Layers
      </div>

      {LAYERS.map((layer, idx) => {
        // Find matching nodeState
        const stateKey = Object.keys(nodeStates).find(k => k.toLowerCase().includes(layer.id))
        const status = stateKey ? nodeStates[stateKey] : undefined
        const tokens = stateKey ? nodeTokens[stateKey] : ''
        const style = getStatusStyle(status)
        const isActive = status === 'thinking' || status === 'reasoning' || status === 'responding'

        return (
          <div key={layer.id}>
            {/* Layer band */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: style.bg,
              borderLeft: `3px solid ${style.border}`,
              transition: 'all 0.4s ease',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Scanning animation for active layers */}
              {isActive && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${style.glow} 50%, transparent 100%)`,
                  animation: 'brainScan 2s ease-in-out infinite',
                }} />
              )}

              {/* Index indicator */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: status === 'completed' ? '#10b981' : (isActive ? layer.color : '#e2e8f0'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, position: 'relative', zIndex: 1,
                animation: style.pulse ? 'pulse 2s infinite' : 'none',
                boxShadow: isActive ? `0 0 10px ${layer.color}50` : 'none',
                transition: 'all 0.3s',
              }}>
                <span style={{
                  fontSize: '0.55rem', fontWeight: 800,
                  color: (status === 'completed' || isActive) ? '#fff' : '#94a3b8',
                }}>
                  {status === 'completed' ? '✓' : idx + 1}
                </span>
              </div>

              {/* Text content */}
              <div style={{ flex: 1, position: 'relative', zIndex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, color: '#0f172a',
                  }}>
                    {layer.label}
                  </span>
                  {status && status !== 'idle' && (
                    <span style={{
                      fontSize: '0.5rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: status === 'completed' ? '#059669' : (status === 'error' ? '#dc2626' : layer.color),
                      background: status === 'completed' ? '#ecfdf5' : (status === 'error' ? '#fef2f2' : `${layer.color}10`),
                      padding: '1px 5px', borderRadius: 3,
                      border: `1px solid ${status === 'completed' ? '#bbf7d0' : `${layer.color}30`}`,
                    }}>
                      {status}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.5rem', color: '#64748b', marginTop: 1,
                }}>
                  {layer.description}
                </div>

                {/* Live token stream preview */}
                {isActive && tokens && (
                  <div style={{
                    marginTop: 4, fontSize: '0.5rem', color: '#475569',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#f8fafc', padding: '3px 6px', borderRadius: 3,
                    maxHeight: 28, overflow: 'hidden', wordBreak: 'break-all',
                    border: '1px solid #e2e8f0',
                  }}>
                    {tokens.length > 80 ? '...' + tokens.slice(-80) : tokens}
                  </div>
                )}
              </div>
            </div>

            {/* Connector line between layers */}
            {idx < LAYERS.length - 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center',
                height: 4,
              }}>
                <div style={{
                  width: 2, height: '100%',
                  background: status === 'completed' ? '#10b981' : '#e2e8f0',
                  transition: 'background 0.5s',
                }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
