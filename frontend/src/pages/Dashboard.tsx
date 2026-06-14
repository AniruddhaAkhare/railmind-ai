import React, { useEffect, useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle, Activity, Zap, RefreshCw, Plus, CloudRain, Sun, Cloud, Wind, Crosshair, BarChart2 } from 'lucide-react'
import { api } from '../config/api'
import { eventsSocket, pulseSocket } from '../config/socket'
import { useEventStore, RailEvent } from '../stores/useEventStore'
import RiskConstellation from '../visualization/RiskConstellation'
import CascadingImpactGraph from '../visualization/CascadingImpactGraph'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}

function SeverityBadge({ severity }: { severity: string }) {
  const isCrit = severity === 'critical'
  return (
    <span className={`badge badge-${severity}`} style={{
      boxShadow: isCrit ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
      fontWeight: isCrit ? 800 : 600,
      textTransform: 'uppercase', letterSpacing: '0.05em'
    }}>
      {isCrit ? '⚠️ ' : ''}{severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = status.replace(' ', '_')
  return <span className={`badge badge-${cls}`} style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
}

const WEATHER_ICON: Record<string, React.ReactNode> = {
  sunny: <Sun size={20} color="#fbbf24" />,
  cloudy: <Cloud size={20} color="#94a3b8" />,
  rainy: <CloudRain size={20} color="#60a5fa" />,
  foggy: <Wind size={20} color="#cbd5e1" />,
  partly_cloudy: <Cloud size={20} color="#fbbf24" />,
}

export default function Dashboard() {
  const { events, stats, loading, error, setEvents, setStats, setLoading, setError, addEvent, updateEvent } =
    useEventStore()

  const [sensorFeed, setSensorFeed] = useState<any[]>([])
  const [weatherData, setWeatherData] = useState<any[]>([])

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [eventsRes, statsRes, weatherRes] = await Promise.all([
        api.get('/events?limit=50'),
        api.get('/events/stats'),
        api.get('/sensors/weather')
      ])
      const data = eventsRes as any
      setEvents(data.events || [])
      setStats(statsRes as any)
      
      const wData = weatherRes as any
      if (wData.weather) {
        setWeatherData(wData.weather.slice(0, 5))
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()

    eventsSocket.on('connect_response', () => console.log('Events socket connected'))
    eventsSocket.on('event_created', (data: RailEvent) => { addEvent(data) })
    eventsSocket.on('event_updated', (data: RailEvent) => { updateEvent(data.id, data) })

    pulseSocket.on('sensor_update', (data: any) => {
      if (data.readings && Array.isArray(data.readings)) {
        const newReadings = data.readings.map((r: any) => ({
          ...r,
          _uid: Math.random().toString(36).substr(2, 9)
        }))
        setSensorFeed(prev => [...newReadings, ...prev].slice(0, 15))
      }
    })

    pulseSocket.on('weather_update', (data: any) => {
      if (data.station_id) {
        setWeatherData(prev => {
          const next = [...prev]
          const idx = next.findIndex(w => w.station_id === data.station_id)
          if (idx >= 0) next[idx] = data
          else next.unshift(data)
          return next.slice(0, 5)
        })
      }
    })

    return () => {
      eventsSocket.off('event_created')
      eventsSocket.off('event_updated')
      eventsSocket.off('connect_response')
      pulseSocket.off('sensor_update')
      pulseSocket.off('weather_update')
    }
  }, [])

  const sortedEvents = [...events].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
  )

  const statCards = [
    { label: 'Total Events', value: stats.total, color: '#3b82f6', icon: <Activity size={18} /> },
    { label: 'Critical', value: stats.critical, color: '#dc2626', icon: <AlertTriangle size={18} /> },
    { label: 'High Priority', value: stats.high, color: '#f59e0b', icon: <Zap size={18} /> },
    { label: 'Active Agents', value: 8, color: '#8b5cf6', icon: <Activity size={18} /> },
    { label: 'System Load', value: '42%', color: '#10b981', icon: <BarChart2 size={18} /> },
    { label: 'Resolved', value: stats.resolved, color: '#10b981', icon: <CheckCircle size={18} /> },
  ]

  // Mock data for Recharts (Trend Line)
  const trendData = [
    { time: '08:00', events: 12, critical: 1 },
    { time: '09:00', events: 19, critical: 3 },
    { time: '10:00', events: 15, critical: 2 },
    { time: '11:00', events: 25, critical: 5 },
    { time: '12:00', events: 32, critical: 8 },
    { time: '13:00', events: 28, critical: 4 },
    { time: '14:00', events: Math.max(10, stats.total), critical: stats.critical },
  ]

  // Mock data for Radar (Zone Risk)
  const zoneRadarData = [
    { zone: 'Northern', risk: 85, avg: 50 },
    { zone: 'Western', risk: 65, avg: 50 },
    { zone: 'Southern', risk: 45, avg: 50 },
    { zone: 'Eastern', risk: 90, avg: 50 },
    { zone: 'Central', risk: 70, avg: 50 },
  ]

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-base)' }}>

      {/* Control Panel Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Crosshair size={28} color="#0284c7" style={{ animation: 'spin 10s linear infinite' }} />
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Command Center Alpha</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sys: ONLINE | Link: SECURE | Opts: ACTIVE
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 6, background: '#d1fae5', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', boxShadow: '0 0 8px #059669', animation: 'pulse 2s infinite' }}></span>
            SYSTEM NOMINAL
          </div>
          <button onClick={fetchEvents} disabled={loading} style={{
            background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '6px 14px', borderRadius: 6,
            fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            SYNC
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        
        {/* Error Banner */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 8, color: '#b91c1c', fontSize: '0.8rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} />
            <b>SYSTEM WARNING:</b> {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 20 }}>
          {statCards.map((card) => (
            <div key={card.label} className="stat-card" style={{ '--stat-color': card.color, padding: '16px 20px', borderRadius: 10 } as React.CSSProperties}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{card.label}</div>
                <div style={{ color: card.color }}>{card.icon}</div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 20, marginBottom: 20 }}>
          
          <div className="card" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="var(--color-accent)" /> Incident Trajectory
            </div>
            <div style={{ flex: 1, minHeight: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickMargin={8} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                  <RechartsTooltip 
                    contentStyle={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                  <Line type="monotone" dataKey="events" stroke="var(--color-chart-1)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-bg-surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="critical" stroke="var(--color-chart-2)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-bg-surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
              <Activity size={16} color="var(--color-chart-3)" /> Zone Risk Radar
            </div>
            <div style={{ flex: 1, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={zoneRadarData}>
                  <PolarGrid stroke="var(--color-border-subtle)" />
                  <PolarAngleAxis dataKey="zone" tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} />
                  <Radar name="Current Risk" dataKey="risk" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.3} />
                  <Radar name="Baseline Avg" dataKey="avg" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.1} />
                  <RechartsTooltip contentStyle={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 0', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 16px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={16} color="var(--color-status-ok)" /> Raw Sensor Feed</span>
              <span style={{ fontSize: '0.6rem', background: 'var(--color-status-ok-bg)', color: 'var(--color-status-ok)', padding: '2px 8px', borderRadius: 100, animation: 'pulse 2s infinite', fontWeight: 600 }}>LIVE</span>
            </div>
            <div style={{ flex: 1, overflowY: 'hidden', padding: '0 16px', position: 'relative' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, var(--color-bg-surface))', zIndex: 10 }} />
              
              <AnimatePresence initial={false}>
                {sensorFeed.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Awaiting telemetry...</div>
                ) : (
                  sensorFeed.map((s, i) => (
                    <motion.div
                      key={s._uid || i}
                      initial={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      animate={{ opacity: i < 8 ? 1 : 0.4, x: 0, height: 'auto', marginBottom: 8 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, type: 'spring', bounce: 0.2 }}
                      style={{
                        fontSize: '0.68rem', padding: '8px 10px',
                        borderLeft: `2px solid ${i === 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: i === 0 ? 'var(--color-bg-active)' : 'var(--color-bg-base)',
                        fontFamily: 'JetBrains Mono, monospace',
                        borderRadius: '0 6px 6px 0',
                        color: i === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      }}
                    >
                      <div style={{ color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-muted)', marginBottom: 4, fontWeight: 700, fontSize: '0.6rem' }}>
                        [{new Date().toLocaleTimeString('en-IN')}] {s.type.toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600 }}>{s.station_name}</div>
                      <div style={{ marginTop: 2, color: i === 0 ? 'var(--color-link)' : 'var(--color-text-muted)', fontSize: '0.6rem' }}>
                        {s.type === 'track_health' && `Score: ${s.health_score} | Frac. Risk: ${s.rail_fracture_risk}`}
                        {s.type === 'platform_crowd' && `Occupancy: ${s.occupancy_pct}%`}
                        {s.type === 'ohe_power' && `Voltage: ${s.voltage_kv}kV | Current: ${s.current_a}A`}
                        {s.type === 'signal_health' && `Faults: ${s.faults_detected} | Interlock: ${s.interlocking_ok ? 'OK' : 'ERR'}`}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, minHeight: 400 }}>
          
          <div className="card" style={{ borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Matrix</span>
              <span style={{ background: 'var(--color-bg-active)', color: 'var(--color-accent)', padding: '2px 8px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 700 }}>{events.length} LOGGED</span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-base)', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>ID</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>Vector</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>Severity</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>State</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>Pax Delta</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.slice(0, 30).map((event, i) => (
                    <tr key={event.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>#{event.id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{event.event_type?.replace(/_/g, ' ')}</div>
                        {event.description && <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.description}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}><SeverityBadge severity={event.severity} /></td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={event.status} /></td>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{event.affected_passengers.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {event.created_at ? new Date(event.created_at).toLocaleTimeString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <CascadingImpactGraph />

            <div className="card" style={{ padding: '16px', borderRadius: 12, flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Atmos. Conditions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weatherData.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No data</div>
                ) : (
                  weatherData.map(w => (
                    <div key={w.station_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--color-bg-base)', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {WEATHER_ICON[w.condition] || <Cloud size={16} color="var(--color-text-muted)" />}
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{w.station_name}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{w.condition?.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>{w.temperature_c}°</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}