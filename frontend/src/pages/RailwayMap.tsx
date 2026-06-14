import React, { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Circle, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { pulseSocket, eventsSocket } from '../config/socket'
import { AlertTriangle, Train, Radio, Zap, Wind, Droplets, Thermometer } from 'lucide-react'

// Fix Leaflet default icons in Vite/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ─── Data ────────────────────────────────────────────────────────────────────
const STATIONS = [
  { id: 1,  name: 'New Delhi',         lat: 28.6448, lng: 77.2167, zone: 'NR',   state: 'Delhi'       },
  { id: 2,  name: 'Mumbai Central',    lat: 18.9691, lng: 72.8194, zone: 'WR',   state: 'Maharashtra' },
  { id: 3,  name: 'Chennai Central',   lat: 13.0827, lng: 80.2707, zone: 'SR',   state: 'Tamil Nadu'  },
  { id: 4,  name: 'Kolkata',           lat: 22.5726, lng: 88.3639, zone: 'ER',   state: 'West Bengal' },
  { id: 5,  name: 'Bengaluru City',    lat: 12.9769, lng: 77.5714, zone: 'SWR',  state: 'Karnataka'   },
  { id: 6,  name: 'Hyderabad',         lat: 17.3850, lng: 78.4867, zone: 'SCR',  state: 'Telangana'   },
  { id: 7,  name: 'Ahmedabad',         lat: 23.0225, lng: 72.5714, zone: 'WR',   state: 'Gujarat'     },
  { id: 8,  name: 'Pune Junction',     lat: 18.5204, lng: 73.8567, zone: 'CR',   state: 'Maharashtra' },
  { id: 9,  name: 'Jaipur Junction',   lat: 26.9124, lng: 75.7873, zone: 'NWR',  state: 'Rajasthan'   },
  { id: 10, name: 'Lucknow',           lat: 26.8467, lng: 80.9462, zone: 'NER',  state: 'UP'          },
  { id: 11, name: 'Bhopal Junction',   lat: 23.2599, lng: 77.4126, zone: 'WCR',  state: 'MP'          },
  { id: 12, name: 'Nagpur',            lat: 21.1458, lng: 79.0882, zone: 'CR',   state: 'Maharashtra' },
  { id: 13, name: 'Patna Junction',    lat: 25.5941, lng: 85.1376, zone: 'ECR',  state: 'Bihar'       },
  { id: 14, name: 'Bhubaneswar',       lat: 20.2961, lng: 85.8195, zone: 'ECoR', state: 'Odisha'      },
  { id: 15, name: 'Kochi',             lat:  9.9312, lng: 76.2673, zone: 'SR',   state: 'Kerala'      },
  { id: 16, name: 'Surat',             lat: 21.1702, lng: 72.8311, zone: 'WR',   state: 'Gujarat'     },
  { id: 17, name: 'Varanasi',          lat: 25.3176, lng: 82.9739, zone: 'NER',  state: 'UP'          },
  { id: 18, name: 'Agra Cantonment',   lat: 27.1767, lng: 78.0081, zone: 'NCR',  state: 'UP'          },
  { id: 19, name: 'Vijayawada',        lat: 16.5062, lng: 80.6480, zone: 'SCR',  state: 'Andhra Pradesh'},
  { id: 20, name: 'Guwahati',          lat: 26.1445, lng: 91.7362, zone: 'NFR',  state: 'Assam'       },
  { id: 21, name: 'Kanpur Central',    lat: 26.4499, lng: 80.3319, zone: 'NCR',  state: 'UP'          },
  { id: 22, name: 'Prayagraj',         lat: 25.4358, lng: 81.8463, zone: 'NCR',  state: 'UP'          },
  { id: 23, name: 'Itarsi Junction',   lat: 22.6105, lng: 77.7601, zone: 'WCR',  state: 'MP'          },
  { id: 24, name: 'Gwalior',           lat: 26.2124, lng: 78.1772, zone: 'NCR',  state: 'MP'          },
  { id: 25, name: 'Visakhapatnam',     lat: 17.6868, lng: 83.2185, zone: 'ECoR', state: 'Andhra Pradesh'},
  { id: 26, name: 'Indore',            lat: 22.7196, lng: 75.8577, zone: 'WR',   state: 'MP'          },
  { id: 27, name: 'Thiruvananthapuram',lat:  8.5241, lng: 76.9366, zone: 'SR',   state: 'Kerala'      },
  { id: 28, name: 'Ranchi',            lat: 23.3441, lng: 85.3096, zone: 'SER',  state: 'Jharkhand'   },
  { id: 29, name: 'Raipur',            lat: 21.2514, lng: 81.6296, zone: 'SECR', state: 'Chhattisgarh'},
  { id: 30, name: 'Vadodara',          lat: 22.3072, lng: 73.1812, zone: 'WR',   state: 'Gujarat'     },
]

const ZONE_COLORS: Record<string, string> = {
  NR: '#3b82f6', WR: '#f59e0b', SR: '#10b981', ER: '#8b5cf6',
  SWR: '#06b6d4', SCR: '#f97316', NWR: '#ec4899', NER: '#84cc16',
  WCR: '#a78bfa', CR: '#fb923c', ECR: '#34d399', ECoR: '#60a5fa',
  NCR: '#38bdf8', NFR: '#facc15', SER: '#f43f5e', SECR: '#c084fc',
}

// Congested network routes
const ROUTES: [number, number][] = [
  // Delhi corridors
  [1, 18], [18, 24], [24, 11], [11, 23], [23, 12], [12, 6], [6, 3], // Delhi-Agra-Gwalior-Bhopal-Itarsi-Nagpur-Hyd-Chennai
  [1, 21], [21, 22], [22, 17], [17, 13], [13, 4], // Delhi-Kanpur-Prayagraj-Varanasi-Patna-Kolkata
  [1, 9], [9, 7], [7, 30], [30, 16], [16, 2], // Delhi-Jaipur-Ahmedabad-Vadodara-Surat-Mumbai
  
  // Coast / East-West / South
  [4, 14], [14, 25], [25, 19], [19, 3], // Kolkata-Bhubaneswar-Vizag-Vijayawada-Chennai
  [3, 5], [5, 15], [15, 27], // Chennai-Bengaluru-Kochi-Trivandrum
  [2, 8], [8, 6], [6, 19], // Mumbai-Pune-Hyd-Vijayawada
  [2, 26], [26, 11], // Mumbai-Indore-Bhopal
  [12, 29], [29, 28], [28, 4], // Nagpur-Raipur-Ranchi-Kolkata
  [4, 20], // Kolkata-Guwahati
  
  // Cross-links for congestion
  [23, 2], [10, 21], [18, 9], [24, 21], [23, 12], [8, 5]
]

const SEVERITY_CONFIG: Record<string, { color: string; glow: string; radius: number; label: string }> = {
  critical: { color: '#ef4444', glow: '#ff000088', radius: 80000, label: 'CRITICAL' },
  high:     { color: '#f97316', glow: '#f9731688', radius: 60000, label: 'HIGH RISK' },
  medium:   { color: '#f59e0b', glow: '#f59e0b88', radius: 40000, label: 'MODERATE' },
  low:      { color: '#eab308', glow: '#eab30888', radius: 25000, label: 'ADVISORY' },
}

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️', partly_cloudy: '⛅',
}

interface TrainPosition {
  train_no: string; train_name: string; train_type: string
  lat: number; lng: number; speed_kmh: number; delay_min: number
  from_station: string; to_station: string; occupancy_pct: number
}
interface WeatherData {
  station_id: number; station_name: string
  temperature_c: number; condition: string
  humidity_pct: number; wind_kmh: number; rainfall_mm: number
}
interface AlertEvent {
  id: string; lat: number; lng: number
  station: string; type: string; severity: string
  description: string; timestamp: string; riskPct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeTrainIcon(delay: number, type: string) {
  const color = delay > 30 ? '#ef4444' : delay > 10 ? '#f59e0b' : '#10b981'
  const emoji = type?.toLowerCase().includes('express') ? '🚄' : '🚂'
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px;
      ">
        <div style="
          position: absolute; inset: 0; border-radius: 50%;
          background: ${color}33;
          animation: trainPulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; box-shadow: 0 0 10px ${color}88;
          position: relative; z-index: 1;
        ">${emoji}</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function makeStationIcon(zone: string, selected: boolean) {
  const color = ZONE_COLORS[zone] || '#64748b'
  const size = selected ? 20 : 14
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: ${size}px; height: ${size}px; border-radius: 50%;
        background: ${color}; border: 2px solid white;
        box-shadow: 0 0 ${selected ? 16 : 8}px ${color}${selected ? 'cc' : '66'};
        transition: all 0.3s;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// ─── Map Controller — handles flyTo and initial view ─────────────────────────
function MapController({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { animate: true, duration: 1.8 })
    }
  }, [target, map])
  return null
}

// ─── Pulsing Alert Ring ───────────────────────────────────────────────────────
function PulsingAlert({ alert }: { alert: AlertEvent }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium

  return (
    <>
      {/* Outer pulsing ring */}
      <Circle
        center={[alert.lat, alert.lng]}
        radius={cfg.radius}
        pathOptions={{
          color: cfg.color, fillColor: cfg.glow,
          fillOpacity: 0.15, weight: 2, dashArray: '8 4',
        }}
      />
      {/* Inner ring */}
      <Circle
        center={[alert.lat, alert.lng]}
        radius={cfg.radius * 0.4}
        pathOptions={{
          color: cfg.color, fillColor: cfg.color,
          fillOpacity: 0.25, weight: 3,
        }}
      >
        <Popup>
          <div style={{ minWidth: 200, fontFamily: 'system-ui' }}>
            <div style={{ fontWeight: 700, color: cfg.color, fontSize: 13, marginBottom: 4 }}>
              ⚠️ {cfg.label}: {alert.type.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#334155' }}><b>Station:</b> {alert.station}</div>
            <div style={{ fontSize: 12, color: '#334155' }}><b>Risk:</b> {alert.riskPct}%</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{alert.description}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{alert.timestamp}</div>
          </div>
        </Popup>
      </Circle>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RailwayMap() {
  const [trains, setTrains] = useState<TrainPosition[]>([])
  const [weather, setWeather] = useState<Record<number, WeatherData>>({})
  const [selectedStation, setSelectedStation] = useState<typeof STATIONS[0] | null>(null)
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const [sensorFeed, setSensorFeed] = useState<string[]>([])
  const [activeEvent, setActiveEvent] = useState<AlertEvent | null>(null)
  const alertTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Severity helper from event_type
  const getSeverity = useCallback((eventType: string, sev: string): string => {
    const critical = ['derailment', 'collision', 'fire', 'flood', 'emergency']
    const high = ['track_defect', 'signal_failure', 'ohe_failure', 'bridge_damage']
    const medium = ['train_delay', 'platform_overcrowding', 'power_failure']
    const t = eventType?.toLowerCase() || ''
    if (critical.some(k => t.includes(k))) return 'critical'
    if (high.some(k => t.includes(k))) return 'high'
    if (medium.some(k => t.includes(k))) return 'medium'
    return sev === 'high' ? 'high' : sev === 'critical' ? 'critical' : 'low'
  }, [])

  const stationLatLng = useCallback((name: string): [number, number] | null => {
    const s = STATIONS.find(st => name?.toLowerCase().includes(st.name.toLowerCase().split(' ')[0]))
    return s ? [s.lat, s.lng] : null
  }, [])

  useEffect(() => {
    // Live train positions
    pulseSocket.on('train_position', (data: TrainPosition) => {
      setTrains(prev => {
        const idx = prev.findIndex(t => t.train_no === data.train_no)
        const next = [...prev]
        if (idx >= 0) next[idx] = data
        else next.push(data)
        return next.slice(0, 80)
      })
    })

    // Weather updates
    pulseSocket.on('weather_update', (data: WeatherData) => {
      if (data.station_id) {
        setWeather(prev => ({ ...prev, [data.station_id]: data }))
      }
    })

    // Sensor updates for alerts
    pulseSocket.on('sensor_update', (data: any) => {
      const r = data.readings?.[0]
      if (!r) return
      setSensorFeed(prev => [
        `[${new Date().toLocaleTimeString('en-IN')}] ${(r.type || '').replace(/_/g, ' ')} @ ${r.station_name || 'unknown'}`,
        ...prev.slice(0, 29),
      ])

      // If high risk reading, create an alert
      if (r.value > 70 || r.type?.toLowerCase().includes('defect') || r.type?.toLowerCase().includes('failure')) {
        const coords = stationLatLng(r.station_name || '')
        if (coords) {
          const alertId = `${r.station_name}-${Date.now()}`
          const newAlert: AlertEvent = {
            id: alertId,
            lat: coords[0], lng: coords[1],
            station: r.station_name,
            type: r.type || 'sensor_alert',
            severity: getSeverity(r.type, r.value > 85 ? 'high' : 'medium'),
            description: `${r.type?.replace(/_/g, ' ')} reading of ${Math.round(r.value || 0)} detected.`,
            timestamp: new Date().toLocaleString('en-IN'),
            riskPct: Math.min(100, Math.round(r.value || 75)),
          }
          setAlerts(prev => [newAlert, ...prev].slice(0, 10))
          setActiveEvent(newAlert)
          setMapTarget({ lat: coords[0], lng: coords[1], zoom: 10 })
          // Auto-remove alert after 30s
          const t = setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== alertId))
          }, 30000)
          alertTimers.current.set(alertId, t)
        }
      }
    })

    // Event engine events
    eventsSocket.on('event_created', (data: any) => {
      let coords: [number, number] | null = null
      let stationName = data.station_name || data.location || ''
      if (data.station_id) {
        const s = STATIONS.find(st => st.id === data.station_id)
        if (s) {
          coords = [s.lat, s.lng]
          stationName = s.name
        }
      }
      if (!coords) {
        coords = stationLatLng(stationName)
      }

      if (coords) {
        const alertId = `event-${data.id || Date.now()}`
        const sev = getSeverity(data.event_type, data.severity)
        const newAlert: AlertEvent = {
          id: alertId,
          lat: coords[0], lng: coords[1],
          station: stationName,
          type: data.event_type || 'system_event',
          severity: sev,
          description: data.description || `${data.event_type} detected at ${stationName}`,
          timestamp: new Date().toLocaleString('en-IN'),
          riskPct: sev === 'critical' ? 95 : sev === 'high' ? 75 : sev === 'medium' ? 50 : 25,
        }
        setAlerts(prev => [newAlert, ...prev].slice(0, 10))
        setActiveEvent(newAlert)
        setMapTarget({ lat: coords[0], lng: coords[1], zoom: 11 })
        setSensorFeed(prev => [
          `⚠️ EVENT: ${(data.event_type || '').replace(/_/g, ' ')} @ ${stationName}`,
          ...prev.slice(0, 29),
        ])
        const t = setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alertId))
        }, 45000)
        alertTimers.current.set(alertId, t)
      }
    })

    return () => {
      pulseSocket.off('train_position')
      pulseSocket.off('weather_update')
      pulseSocket.off('sensor_update')
      eventsSocket.off('event_created')
      alertTimers.current.forEach(t => clearTimeout(t))
    }
  }, [getSeverity, stationLatLng])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <style>{`
        @keyframes trainPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.4); }
        }
        @keyframes alertGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .leaflet-container { background: #0f172a; }
        .leaflet-popup-content-wrapper {
          border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
      `}</style>

      {/* Header */}
      <div className="page-header" style={{ paddingBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Indian Railway Network</h1>
            <p className="page-subtitle">
              Live Terrain Map · {trains.length} trains active · {alerts.length > 0 ? `${alerts.length} ACTIVE ALERTS` : 'Network Nominal'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {alerts.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 20, padding: '4px 12px',
                animation: 'alertGlow 1.5s ease-in-out infinite',
              }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>
                  {alerts.length} ALERT{alerts.length > 1 ? 'S' : ''} ACTIVE
                </span>
              </div>
            )}
            {['NR','WR','SR','ER','SCR','SWR'].map(zone => (
              <span key={zone} style={{
                padding: '2px 8px', borderRadius: 100, fontSize: '0.6rem', fontWeight: 700,
                background: `${ZONE_COLORS[zone]}22`, color: ZONE_COLORS[zone],
                border: `1px solid ${ZONE_COLORS[zone]}55`,
              }}>{zone}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Map + Panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, minHeight: 0, paddingBottom: 14 }}>

        {/* MAP */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          <MapContainer
            center={[22.5, 82.0]}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            {/* Google Maps Terrain — clean, non-heatmap physical terrain map */}
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
              attribution="&copy; Google Maps"
              maxZoom={17}
            />

            {/* Map controller for auto-zoom */}
            <MapController target={mapTarget} />

            {/* Railway routes */}
            {ROUTES.map(([fromId, toId], idx) => {
              const from = STATIONS.find(s => s.id === fromId)
              const to = STATIONS.find(s => s.id === toId)
              if (!from || !to) return null
              return (
                <Polyline
                  key={idx}
                  positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                  pathOptions={{ color: '#60a5fa', weight: 2, opacity: 0.7, dashArray: '8 4' }}
                />
              )
            })}

            {/* Station markers */}
            {STATIONS.map(station => (
              <Marker
                key={station.id}
                position={[station.lat, station.lng]}
                icon={makeStationIcon(station.zone, selectedStation?.id === station.id)}
                eventHandlers={{ click: () => setSelectedStation(station) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'system-ui', minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: ZONE_COLORS[station.zone], marginBottom: 4 }}>
                      {station.name}
                    </div>
                    <div style={{ fontSize: 12 }}>Zone: {station.zone} · {station.state}</div>
                    {weather[station.id] && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        {WEATHER_ICON[weather[station.id].condition]} {weather[station.id].temperature_c}°C ·
                        {weather[station.id].wind_kmh} km/h wind
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Live train markers */}
            {trains.map(train => (
              <Marker
                key={train.train_no}
                position={[train.lat, train.lng]}
                icon={makeTrainIcon(train.delay_min, train.train_type)}
              >
                <Popup>
                  <div style={{ fontFamily: 'system-ui', minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🚂 {train.train_name}</div>
                    <div style={{ fontSize: 12 }}>{train.from_station} → {train.to_station}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Speed: <b>{train.speed_kmh} km/h</b> · Occupancy: <b>{train.occupancy_pct}%</b>
                    </div>
                    <div style={{
                      marginTop: 6, fontWeight: 700, fontSize: 12,
                      color: train.delay_min > 30 ? '#ef4444' : train.delay_min > 10 ? '#f59e0b' : '#10b981',
                    }}>
                      {train.delay_min > 0 ? `⏰ +${train.delay_min} min delay` : '✅ On time'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Alert / Hazard rings */}
            {alerts.map(alert => (
              <PulsingAlert key={alert.id} alert={alert} />
            ))}
          </MapContainer>

          {/* Legend overlay */}
          <div style={{
            position: 'absolute', bottom: 24, left: 12, zIndex: 1000,
            background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(10px)',
            border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              STATUS
            </div>
            {[
              { color: '#10b981', label: 'On time' },
              { color: '#f59e0b', label: 'Minor delay' },
              { color: '#ef4444', label: 'Major delay / Alert' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                <span style={{ fontSize: '0.68rem', color: '#e2e8f0', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Active alert banner */}
          {activeEvent && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000,
              background: activeEvent.severity === 'critical' ? 'rgba(127,29,29,0.9)' : 'rgba(120,53,15,0.9)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${SEVERITY_CONFIG[activeEvent.severity]?.color || '#f97316'}`,
              borderRadius: 10, padding: '8px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: `0 0 24px ${SEVERITY_CONFIG[activeEvent.severity]?.glow || '#f9731688'}`,
              animation: 'alertGlow 1.5s ease-in-out infinite',
              maxWidth: '70%',
            }}>
              <AlertTriangle size={16} color={SEVERITY_CONFIG[activeEvent.severity]?.color || '#f97316'} />
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fef2f2', textTransform: 'uppercase' }}>
                  {SEVERITY_CONFIG[activeEvent.severity]?.label} — {activeEvent.type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#fca5a5' }}>
                  {activeEvent.station} · Risk: {activeEvent.riskPct}% · Auto-zoomed
                </div>
              </div>
              <button
                onClick={() => setActiveEvent(null)}
                style={{
                  background: 'transparent', border: 'none', color: '#fca5a5',
                  cursor: 'pointer', fontSize: 16, marginLeft: 8, padding: 0,
                }}
              >✕</button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          
          {/* Active Alerts */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🚨 Active Alerts</span>
              <span style={{
                fontSize: '0.6rem', background: alerts.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                color: alerts.length > 0 ? '#ef4444' : '#10b981',
                padding: '2px 8px', borderRadius: 100, fontWeight: 700,
              }}>{alerts.length > 0 ? `${alerts.length} ACTIVE` : 'NOMINAL'}</span>
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <p style={{ fontSize: '0.72rem', color: '#475569', padding: '4px 0' }}>✅ All systems nominal</p>
              ) : (
                alerts.map(a => {
                  const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.low
                  return (
                    <div
                      key={a.id}
                      onClick={() => { setMapTarget({ lat: a.lat, lng: a.lng, zoom: 11 }); setActiveEvent(a) }}
                      style={{
                        padding: '7px 8px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                        background: `${cfg.color}15`, border: `1px solid ${cfg.color}44`,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                        <span style={{ fontSize: '0.58rem', color: '#64748b' }}>{a.riskPct}%</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 2 }}>
                        {a.type.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{a.station}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Station Info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📍 Station Info</span>
            </div>
            {selectedStation ? (
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: ZONE_COLORS[selectedStation.zone] }}>
                  {selectedStation.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Zone {selectedStation.zone} · {selectedStation.state}
                </div>
                {weather[selectedStation.id] ? (
                  <div style={{
                    background: 'var(--color-bg-elevated)', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid var(--color-border)',
                  }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>
                      {WEATHER_ICON[weather[selectedStation.id].condition] || '🌤️'}
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginLeft: 8 }}>
                        {weather[selectedStation.id].temperature_c}°C
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        ['Humidity', `${weather[selectedStation.id].humidity_pct}%`, <Droplets size={10} />],
                        ['Wind', `${weather[selectedStation.id].wind_kmh} km/h`, <Wind size={10} />],
                        ['Rainfall', `${weather[selectedStation.id].rainfall_mm} mm`, <Droplets size={10} />],
                        ['Condition', weather[selectedStation.id].condition, <Thermometer size={10} />],
                      ].map(([label, val, icon]) => (
                        <div key={String(label)}>
                          <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {icon as React.ReactNode} {label as string}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{val as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.68rem', color: '#475569' }}>Waiting for weather data...</p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.72rem', color: '#475569', padding: '4px 0' }}>
                Click a station marker on the map
              </p>
            )}
          </div>

          {/* Live Trains */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Train size={12} style={{ display: 'inline', marginRight: 4 }} />Live Trains</span>
              <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>● {trains.length} active</span>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {trains.length === 0 ? (
                <p style={{ fontSize: '0.72rem', color: '#475569' }}>Waiting for sensor stream...</p>
              ) : (
                trains.slice(0, 15).map(train => (
                  <div key={train.train_no} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                  }}
                    onClick={() => setMapTarget({ lat: train.lat, lng: train.lng, zoom: 12 })}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {train.train_name}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
                        {train.speed_kmh} km/h · {train.occupancy_pct}% full
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      color: train.delay_min > 30 ? '#ef4444' : train.delay_min > 10 ? '#f59e0b' : '#10b981',
                    }}>
                      {train.delay_min > 0 ? `+${train.delay_min}m` : '✓'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sensor Feed */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title"><Radio size={12} style={{ display: 'inline', marginRight: 4 }} />Sensor Feed</span>
              <span style={{ fontSize: '0.6rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 100, fontWeight: 700 }}>LIVE</span>
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {sensorFeed.length === 0 ? (
                <p style={{ fontSize: '0.68rem', color: '#475569' }}>Waiting for sensor data...</p>
              ) : (
                sensorFeed.map((ev, i) => (
                  <div key={i} style={{
                    fontSize: '0.62rem',
                    color: i === 0 ? (ev.startsWith('⚠️') ? '#ef4444' : 'var(--color-text-primary)') : 'var(--color-text-muted)',
                    padding: '3px 0', borderBottom: '1px solid var(--color-border-subtle)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: i === 0 ? 600 : 400,
                  }}>
                    {ev}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
