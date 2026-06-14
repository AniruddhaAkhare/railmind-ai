import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  RefreshCw, FastForward, Rewind,
} from 'lucide-react'
import { api } from '../config/api'
import { useEventStore, RailEvent } from '../stores/useEventStore'

interface ReplaySession {
  eventId: number
  event: RailEvent | null
  messages: any[]
  decisions: any[]
  currentIndex: number
  isPlaying: boolean
  speed: number
}

const REPLAY_SPEEDS = [0.5, 1, 2, 4]

function TimelineEvent({ event, isActive }: { event: any; isActive: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '10px 0',
      borderLeft: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
      paddingLeft: 12,
      marginLeft: 8,
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isActive ? 'var(--color-primary)' : 'var(--color-border)',
        marginTop: 4,
        marginLeft: -17,
        flexShrink: 0,
        transition: 'background 0.3s',
        boxShadow: isActive ? '0 0 8px var(--color-primary)' : 'none',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Agent #{event.agent_id} — {event.message_type}
          </span>
          <span style={{
            fontSize: '0.65rem',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--color-text-muted)',
          }}>
            {new Date(event.created_at).toLocaleTimeString('en-IN')}
          </span>
        </div>
        <p style={{
          fontSize: '0.8rem',
          color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}>
          {event.content}
        </p>
        {event.confidence > 0 && (
          <div style={{ marginTop: 6 }}>
            <div className="progress-bar" style={{ height: 3 }}>
              <div
                className="progress-fill"
                style={{ width: `${Math.round(event.confidence * 100)}%` }}
              />
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
              Confidence: {Math.round(event.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Replay() {
  const { events } = useEventStore()
  const [session, setSession] = useState<ReplaySession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadEventMessages = useCallback(async (eventId: number) => {
    try {
      setLoading(true)
      setError(null)

      // Load events if not yet loaded
      let event: RailEvent | null = events.find((e) => e.id === eventId) || null

      // Fetch messages from all agents for this event
      const agentsRes = await api.get('/agents') as any
      const allMessages: any[] = []
      const allDecisions: any[] = []

      for (const agent of (agentsRes.agents || []).slice(0, 5)) {
        try {
          const msgsRes = await api.get(`/agents/${agent.id}/messages?limit=10`) as any
          const eventMsgs = (msgsRes.messages || []).filter(
            (m: any) => m.event_id === eventId
          )
          allMessages.push(...eventMsgs)

          const decsRes = await api.get(`/agents/${agent.id}/decisions?limit=10`) as any
          const eventDecs = (decsRes.decisions || []).filter(
            (d: any) => d.event_id === eventId
          )
          allDecisions.push(...eventDecs)
        } catch {}
      }

      // Sort by created_at
      allMessages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      setSession({
        eventId,
        event,
        messages: allMessages,
        decisions: allDecisions,
        currentIndex: 0,
        isPlaying: false,
        speed: 1,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to load replay data')
    } finally {
      setLoading(false)
    }
  }, [events])

  useEffect(() => {
    if (!session?.isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const delay = 1500 / session.speed
    intervalRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev) return null
        if (prev.currentIndex >= prev.messages.length - 1) {
          return { ...prev, isPlaying: false }
        }
        return { ...prev, currentIndex: prev.currentIndex + 1 }
      })
    }, delay)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.isPlaying, session?.speed])

  const togglePlay = () => {
    setSession((prev) => prev ? { ...prev, isPlaying: !prev.isPlaying } : null)
  }

  const seek = (direction: 'back' | 'forward') => {
    setSession((prev) => {
      if (!prev) return null
      const next = direction === 'back'
        ? Math.max(0, prev.currentIndex - 1)
        : Math.min(prev.messages.length - 1, prev.currentIndex + 1)
      return { ...prev, currentIndex: next, isPlaying: false }
    })
  }

  const reset = () => {
    setSession((prev) => prev ? { ...prev, currentIndex: 0, isPlaying: false } : null)
  }

  const cycleSpeed = () => {
    setSession((prev) => {
      if (!prev) return null
      const idx = REPLAY_SPEEDS.indexOf(prev.speed)
      const next = REPLAY_SPEEDS[(idx + 1) % REPLAY_SPEEDS.length]
      return { ...prev, speed: next }
    })
  }

  const progress = session && session.messages.length > 0
    ? (session.currentIndex / (session.messages.length - 1)) * 100
    : 0

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Incident Replay Center</h1>
          <p className="page-subtitle">
            Replay any incident from first detection to resolution — step by step
          </p>
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

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Event Selector */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Select Incident</span>
            </div>

            {events.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">🛤️</div>
                <div className="empty-state-text">
                  No events available. Load events from the Command Center first.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
                {events.slice(0, 20).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEventId(event.id)
                      loadEventMessages(event.id)
                    }}
                    style={{
                      background: selectedEventId === event.id
                        ? 'rgba(59,130,246,0.12)'
                        : 'var(--color-bg-elevated)',
                      border: `1px solid ${selectedEventId === event.id
                        ? 'rgba(59,130,246,0.3)'
                        : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: selectedEventId === event.id
                        ? 'var(--color-primary)'
                        : 'var(--color-text-primary)',
                      marginBottom: 4,
                    }}>
                      {event.event_type?.replace(/_/g, ' ')}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}>
                      <span className={`badge badge-${event.severity}`} style={{ fontSize: '0.6rem' }}>
                        {event.severity}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                        #{event.id}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Replay Panel */}
          <div>
            {!session ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '60px 24px' }}>
                  <div className="empty-state-icon">▶️</div>
                  <div className="empty-state-title">Select an incident to replay</div>
                  <div className="empty-state-text">
                    Choose an incident from the left panel to begin the replay session
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="card">
                <div className="loading-container" style={{ padding: '60px' }}>
                  <div className="spinner" />
                  <span>Loading replay data...</span>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                {/* Playback Controls */}
                <div className="card" style={{ marginBottom: 16 }}>
                  {session.event && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: 4,
                      }}>
                        {session.event.event_type?.replace(/_/g, ' ')} — Incident #{session.event.id}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {session.messages.length} agent messages recorded
                      </div>
                    </div>
                  )}

                  {/* Timeline bar */}
                  <div className="timeline-container">
                    <div className="timeline-track">
                      <div
                        className="timeline-progress"
                        style={{ width: `${progress}%` }}
                      />
                      {progress > 0 && progress < 100 && (
                        <div
                          className="timeline-thumb"
                          style={{ left: `${progress}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="timeline-controls">
                    <button className="timeline-btn" onClick={reset} title="Reset">
                      <SkipBack size={14} />
                    </button>
                    <button className="timeline-btn" onClick={() => seek('back')} title="Previous">
                      <Rewind size={14} />
                    </button>
                    <button
                      className="timeline-btn"
                      onClick={togglePlay}
                      title={session.isPlaying ? 'Pause' : 'Play'}
                      style={{ background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                    >
                      {session.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="timeline-btn" onClick={() => seek('forward')} title="Next">
                      <FastForward size={14} />
                    </button>
                    <button
                      className="timeline-btn"
                      onClick={cycleSpeed}
                      title="Speed"
                      style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}
                    >
                      {session.speed}x
                    </button>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--color-text-muted)',
                    }}>
                      {session.currentIndex + 1} / {session.messages.length || 1}
                    </span>
                  </div>
                </div>

                {/* Timeline Events */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Agent Response Timeline</span>
                  </div>

                  {session.messages.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                      <div className="empty-state-icon">📭</div>
                      <div className="empty-state-text">
                        No agent messages found for this event.
                        Create events and trigger agents via the API.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div style={{ maxHeight: 420, overflowY: 'auto', paddingTop: 8, paddingRight: 8, borderRight: '1px solid var(--color-border)' }}>
                        {session.messages.map((msg, idx) => (
                          <TimelineEvent
                            key={msg.id || idx}
                            event={msg}
                            isActive={idx === session.currentIndex}
                          />
                        ))}
                      </div>
                      
                      {/* Detailed Agent Reasoning Panel */}
                      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 overflow-y-auto" style={{ maxHeight: 420 }}>
                        {session.messages[session.currentIndex] && (
                          <div className="animate-fade-in">
                            <div className="text-xs font-bold uppercase text-slate-400 mb-2">Live Agent Context</div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                A{session.messages[session.currentIndex].agent_id}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800">
                                  {session.messages[session.currentIndex].message_type}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Confidence: {Math.round(session.messages[session.currentIndex].confidence * 100)}%
                                </div>
                              </div>
                            </div>

                            <div className="text-sm font-semibold text-slate-700 mb-1">Reasoning Engine Output</div>
                            <div className="bg-white border border-slate-200 rounded p-3 text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed shadow-inner">
                              {session.messages[session.currentIndex].content}
                            </div>
                            
                            {session.messages[session.currentIndex].metadata && Object.keys(session.messages[session.currentIndex].metadata).length > 0 && (
                              <>
                                <div className="text-sm font-semibold text-slate-700 mt-4 mb-1">Extracted Logic</div>
                                <pre className="bg-slate-800 text-green-400 rounded p-3 text-[10px] overflow-x-auto">
                                  {JSON.stringify(session.messages[session.currentIndex].metadata, null, 2)}
                                </pre>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}