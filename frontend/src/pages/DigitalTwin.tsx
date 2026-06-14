import React, { useEffect, useState, useCallback } from 'react'
import { Cpu, Play, RefreshCw, Zap, CheckCircle, Clock, Box as BoxIcon, ArrowRight } from 'lucide-react'
import { api } from '../config/api'
import { useEventStore } from '../stores/useEventStore'
import BlueprintSimulator from '../visualization/BlueprintSimulator'

interface Simulation {
  id: number
  name: string
  simulation_type: string
  scenario: string
  status: string
  results?: any
  created_at: string
}

interface SimCreateForm {
  name: string
  simulation_type: string
  scenario: string
}

const SCENARIOS = [
  { value: 'track_failure_cascade', label: 'Track Failure Cascade' },
  { value: 'signal_blackout_zone', label: 'Signal Blackout Zone' },
  { value: 'flood_route_closure', label: 'Flood Route Closure' },
  { value: 'peak_hour_surge', label: 'Peak Hour Passenger Surge' },
  { value: 'emergency_incident', label: 'Emergency Incident Response' },
  { value: 'multi_train_delay', label: 'Multi-Train Delay Cascade' },
]

const SIM_TYPES = ['impact', 'risk', 'capacity', 'operations']

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle size={14} color="var(--color-success)" />
  if (status === 'running') return (
    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
  )
  if (status === 'failed') return <Zap size={14} color="var(--color-danger)" />
  return <Clock size={14} color="var(--color-text-muted)" />
}

export default function DigitalTwin() {
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<SimCreateForm>({
    name: '',
    simulation_type: 'impact',
    scenario: 'track_failure_cascade',
  })
  const [showForm, setShowForm] = useState(false)
  const [selectedSim, setSelectedSim] = useState<Simulation | null>(null)
  const [activeTab, setActiveTab] = useState<'simulations' | 'blueprint'>('simulations')
  const { events: railEvents } = useEventStore()

  // Find latest critical event for blueprint
  const latestCriticalEvent = railEvents.find(e => 
    e.severity === 'critical' || e.severity === 'high'
  )

  const blueprintProps = {
    type: selectedSim?.scenario || latestCriticalEvent?.event_type || 'track_defect',
    stationName: latestCriticalEvent?.station_id ? `Station ${latestCriticalEvent.station_id}` : 'Simulation Environment',
    severity: latestCriticalEvent?.severity || 'critical'
  }

  const fetchSimulations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/simulations?limit=20') as any
      setSimulations(res.simulations || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load simulations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSimulations()
  }, [])

  const createSimulation = async () => {
    if (!form.name.trim()) return
    try {
      const res = await api.post('/simulations', form) as any
      setSimulations((prev) => [res, ...prev])
      setShowForm(false)
      setForm({ name: '', simulation_type: 'impact', scenario: 'track_failure_cascade' })
    } catch (err: any) {
      setError(err?.message || 'Failed to create simulation')
    }
  }

  const runSimulation = async (sim: Simulation) => {
    setRunning(sim.id)
    try {
      const res = await api.post(`/simulations/${sim.id}/run`, {}) as any
      setSimulations((prev) =>
        prev.map((s) => (s.id === sim.id ? res : s))
      )
      setSelectedSim(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to run simulation')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Digital Twin Laboratory</h1>
            <p className="page-subtitle">
              Run what-if simulations on the virtual Indian Railway network
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ background: 'var(--color-bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '4px', marginRight: '16px' }}>
              <button 
                onClick={() => setActiveTab('simulations')}
                style={{
                  background: activeTab === 'simulations' ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === 'simulations' ? '#fff' : 'var(--color-text-muted)',
                  border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Cpu size={14} /> Simulations
              </button>
              <button 
                onClick={() => setActiveTab('blueprint')}
                style={{
                  background: activeTab === 'blueprint' ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === 'blueprint' ? '#fff' : 'var(--color-text-muted)',
                  border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <BoxIcon size={14} /> Blueprint Lab
              </button>
            </div>
            <button className="btn btn-ghost" onClick={fetchSimulations} style={{ fontSize: '0.8rem' }}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(!showForm)}
              style={{ fontSize: '0.8rem' }}
            >
              <Play size={14} />
              New Simulation
            </button>
          </div>
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

        {/* Create Form */}
        {showForm && (
          <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Configure Simulation</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Simulation Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monsoon Impact Analysis"
                  style={{
                    width: '100%',
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Type
                </label>
                <select
                  value={form.simulation_type}
                  onChange={(e) => setForm({ ...form, simulation_type: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                >
                  {SIM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Scenario
                </label>
                <select
                  value={form.scenario}
                  onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={createSimulation}
                  disabled={!form.name.trim()}
                  style={{ fontSize: '0.8rem' }}
                >
                  Create
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                  style={{ fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'blueprint' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, height: '600px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <BlueprintSimulator {...blueprintProps} />
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <span className="card-title">Future State Comparator</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
                  Comparing current system state with AI-projected 2-hour future state based on {blueprintProps.type.replace(/_/g, ' ')}.
                </p>
                
                {[
                  { metric: 'Network Delay', current: '12 min avg', future: '45 min avg', worse: true },
                  { metric: 'Stranded Passengers', current: '0', future: '4,500', worse: true },
                  { metric: 'Revenue Impact', current: '0 INR', future: '2.5M INR', worse: true },
                  { metric: 'Alternative Route Cap', current: '65%', future: '98%', worse: true },
                ].map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 12, padding: 12, background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>{item.metric}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{item.current}</span>
                      <ArrowRight size={14} color="var(--color-text-muted)" />
                      <span style={{ fontSize: '0.9rem', color: item.worse ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 'bold' }}>{item.future}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          {/* Simulations List */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Simulations
                <span style={{
                  marginLeft: 8,
                  background: 'rgba(59,130,246,0.15)',
                  color: '#93c5fd',
                  padding: '1px 6px',
                  borderRadius: 100,
                  fontSize: '0.65rem',
                }}>
                  {simulations.length}
                </span>
              </span>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="spinner" />
                <span>Loading simulations...</span>
              </div>
            ) : simulations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧪</div>
                <div className="empty-state-title">No simulations yet</div>
                <div className="empty-state-text">
                  Click "New Simulation" to create your first digital twin simulation.
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Scenario</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulations.map((sim) => (
                      <tr
                        key={sim.id}
                        onClick={() => setSelectedSim(sim)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusIcon status={sim.status} />
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-muted)',
                            }}>
                              {sim.status}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {sim.name}
                        </td>
                        <td>
                          <span className="badge badge-medium">{sim.simulation_type}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {sim.scenario.replace(/_/g, ' ')}
                        </td>
                        <td style={{
                          fontSize: '0.75rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--color-text-muted)',
                        }}>
                          {new Date(sim.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          {sim.status === 'pending' && (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                              disabled={running === sim.id}
                              onClick={(e) => { e.stopPropagation(); runSimulation(sim) }}
                            >
                              {running === sim.id ? '...' : 'Run'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Cpu size={14} style={{ marginRight: 6, display: 'inline' }} />
                Simulation Results
              </span>
            </div>

            {!selectedSim ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">
                  Select a simulation to view results
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    marginBottom: 4,
                  }}>
                    {selectedSim.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {selectedSim.simulation_type} • {selectedSim.scenario.replace(/_/g, ' ')}
                  </div>
                </div>

                {selectedSim.results ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(selectedSim.results)
                      .filter(([k]) => k !== 'computed_at' && k !== 'scenario' && k !== 'simulation_type')
                      .map(([key, value]) => (
                        <div
                          key={key}
                          style={{
                            background: 'var(--color-bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            textTransform: 'capitalize',
                          }}>
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {typeof value === 'number'
                              ? Number.isInteger(value)
                                ? value.toLocaleString()
                                : (value as number).toFixed(3)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : selectedSim.status === 'pending' ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-state-text">Click "Run" to execute this simulation</div>
                  </div>
                ) : (
                  <div className="loading-container">
                    <div className="spinner" />
                    <span>Running simulation...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}