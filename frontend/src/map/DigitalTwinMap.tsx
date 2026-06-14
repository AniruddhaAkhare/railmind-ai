import React, { useMemo, useEffect, useState } from 'react'
import Map, { NavigationControl } from 'react-map-gl'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, ArcLayer, PathLayer } from '@deck.gl/layers'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { useCommandStore } from '../stores/useCommandStore'
import { useAgentGraphStore, AgentGraphEvent } from '../stores/useAgentGraphStore'
import { api } from '../config/api'
import { io } from 'socket.io-client'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

// ─── Data ────────────────────────────────────────────────────────────────────
const STATIONS = [
  { id: 1,  name: 'New Delhi',       lat: 28.6448, lng: 77.2167 },
  { id: 2,  name: 'Mumbai Central',  lat: 18.9691, lng: 72.8194 },
  { id: 3,  name: 'Chennai Central', lat: 13.0827, lng: 80.2707 },
  { id: 4,  name: 'Kolkata',         lat: 22.5726, lng: 88.3639 },
  { id: 5,  name: 'Bengaluru City',  lat: 12.9769, lng: 77.5714 },
  { id: 6,  name: 'Hyderabad',       lat: 17.3850, lng: 78.4867 },
  { id: 7,  name: 'Ahmedabad',       lat: 23.0225, lng: 72.5714 },
  { id: 8,  name: 'Pune Junction',   lat: 18.5204, lng: 73.8567 },
  { id: 9,  name: 'Jaipur',          lat: 26.9124, lng: 75.7873 },
  { id: 10, name: 'Lucknow',         lat: 26.8467, lng: 80.9462 },
  { id: 11, name: 'Bhopal',          lat: 23.2599, lng: 77.4126 },
  { id: 12, name: 'Nagpur',          lat: 21.1458, lng: 79.0882 },
  { id: 13, name: 'Patna',           lat: 25.5941, lng: 85.1376 },
  { id: 14, name: 'Bhubaneswar',     lat: 20.2961, lng: 85.8195 },
  { id: 15, name: 'Kochi',           lat:  9.9312, lng: 76.2673 },
]

const ROUTES = [
  [1, 10], [10, 13], [13, 4],           
  [1, 9],  [9, 7],  [7, 8],  [8, 2],   
  [1, 11], [11, 12],[12, 6], [6, 3],    
  [4, 14], [14, 3],                     
  [3, 5],  [5, 15],                     
  [6, 5],  [8, 6],                      
  [12, 14],[10, 13],                    
]

interface Train {
  id: string
  lat: number
  lng: number
  speed: number
  status: string
}

interface ImpactArc {
  source: [number, number];
  target: [number, number];
  value: number;
}

interface StationHealth {
  station_id: number;
  station_name: string;
  track: number;
  signal: number;
  ohe: number;
  crowd: number;
  overall: number;
  status: 'good' | 'warning' | 'critical';
}

interface Shockwave {
  id: string;
  lng: number;
  lat: number;
  radius: number;
  maxRadius: number;
  timestamp: number;
}

export default function DigitalTwinMap() {
  const { mapViewport, setMapViewport, emergencyMode } = useCommandStore()
  const { events } = useAgentGraphStore()
  const [trains, setTrains] = useState<Train[]>([])
  const [impactArcs, setImpactArcs] = useState<ImpactArc[]>([])
  const [incidentPoints, setIncidentPoints] = useState<[number, number][]>([])
  const [stationHealth, setStationHealth] = useState<StationHealth[]>([])
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([])
  const [hoverInfo, setHoverInfo] = useState<any>(null)

  useEffect(() => {
    // Initial static fetch
    const fetchTrains = async () => {
      try {
        const response = await api.get('/trains')
        setTrains(response.data.trains.map((t: any) => ({
          id: t.train_no,
          lat: t.lat,
          lng: t.lng,
          speed: t.speed_kmh,
          status: t.delay_min > 10 ? 'delayed' : 'on_time',
          type: t.train_type
        })))
      } catch (err) {
        console.error(err)
      }
    }
    fetchTrains()

    const fetchHealth = async () => {
      try {
        const response = await api.get('/sensors/station-health')
        setStationHealth(response.data.health)
      } catch (err) {
        console.error(err)
      }
    }
    fetchHealth()
    const healthInterval = setInterval(fetchHealth, 5000)

    // Listen to pulse_stream for real-time locations and anomalies
    const socket = io('http://localhost:5000/pulse_stream', { transports: ['websocket', 'polling'] })
    
    socket.on('train_position', (data: any) => {
      setTrains(prev => {
        const idx = prev.findIndex(t => t.id === data.train_no)
        const newTrain = { id: data.train_no, lat: data.lat, lng: data.lng, speed: data.speed_kmh, status: data.delay_min > 10 ? 'delayed' : 'on_time', type: data.train_type }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = newTrain
          return next
        }
        return [...prev.slice(0, 49), newTrain]
      })
    })

    socket.on('sensor_update', (data: any) => {
      // Simulate incident point from sensor anomalies
      if (data.readings && data.readings.length > 0 && data.readings[0].severity === 'critical') {
        const s = STATIONS.find(st => st.id === data.readings[0].station_id) || STATIONS[Math.floor(Math.random() * STATIONS.length)]
        setIncidentPoints(prev => [...prev.slice(-9), [s.lng, s.lat]])
      }
    })

    return () => {
      clearInterval(healthInterval)
      socket.disconnect()
    }
  }, [])

  // Derive cascading impacts from Agent Events
  useEffect(() => {
    if (events.length > 0) {
      const recentEvent = events[0]
      if (recentEvent.event_type === 'agent_message_sent' && recentEvent.message?.action_plan) {
        // Find if this relates to a station
        const stationMatch = STATIONS.find(s => (recentEvent.message as any)?.content?.includes(s.name))
        const start = stationMatch || STATIONS[11] // Nagpur (center) default
        
        // Create shockwave
        const newWave: Shockwave = {
          id: `wave-${Date.now()}`,
          lng: start.lng,
          lat: start.lat,
          radius: 1000,
          maxRadius: 300000,
          timestamp: Date.now()
        }
        setShockwaves(prev => [...prev, newWave])

        const targets = STATIONS.filter(s => s.id !== start.id).sort(() => 0.5 - Math.random()).slice(0, 3)
        const newArcs = targets.map(t => ({
          source: [start.lng, start.lat] as [number, number],
          target: [t.lng, t.lat] as [number, number],
          value: Math.random() * 10
        }))
        setImpactArcs(newArcs)
        setIncidentPoints(prev => [...prev.slice(-4), [start.lng, start.lat]])
        
        // Decay arcs after 5 seconds
        setTimeout(() => {
          setImpactArcs([])
        }, 5000)
      }
    }
  }, [events])

  // Shockwave animation loop
  useEffect(() => {
    let animationFrame: number
    const animate = () => {
      setShockwaves(prev => {
        const now = Date.now()
        // Expand radius by 3km per frame, remove if older than 4 seconds or radius maxed
        return prev.filter(w => now - w.timestamp < 4000 && w.radius < w.maxRadius)
                   .map(w => ({ ...w, radius: w.radius + 3000 }))
      })
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  // --- DeckGL Layers ---
  
  const pathData = useMemo(() => {
    return ROUTES.map(([fromId, toId]) => {
      const from = STATIONS.find(s => s.id === fromId)
      const to = STATIONS.find(s => s.id === toId)
      if (!from || !to) return null
      return { path: [[from.lng, from.lat], [to.lng, to.lat]] }
    }).filter(Boolean)
  }, [])

  const layers = [
    // Base Network Routes
    new PathLayer({
      id: 'network-routes',
      data: pathData,
      getPath: d => d.path,
      getColor: [148, 163, 184, 150], // Slate-400 with opacity
      getWidth: 2,
      widthMinPixels: 1,
    }),

    // Base Stations
    new ScatterplotLayer({
      id: 'stations',
      data: STATIONS,
      getPosition: d => [d.lng, d.lat],
      getFillColor: d => {
        const health = stationHealth.find(h => h.station_id === d.id)
        if (!health) return [15, 23, 42]
        if (health.status === 'critical') return [239, 68, 68]
        if (health.status === 'warning') return [245, 158, 11]
        return [34, 197, 94]
      },
      getLineColor: [56, 189, 248],
      lineWidthMinPixels: 2,
      getRadius: 15000,
      radiusMinPixels: 4,
      stroked: true,
      pickable: true,
      onHover: info => setHoverInfo(info.object ? { ...info.object, x: info.x, y: info.y } : null)
    }),

    // Network Shockwaves
    new ScatterplotLayer({
      id: 'network-shockwaves',
      data: shockwaves,
      getPosition: d => [d.lng, d.lat],
      getFillColor: [239, 68, 68, 0], // Transparent fill
      getLineColor: d => [239, 68, 68, Math.max(0, 255 * (1 - d.radius / d.maxRadius))], // Fade out
      getLineWidth: 4,
      getRadius: d => d.radius,
      stroked: true,
      filled: false,
      updateTriggers: {
        getRadius: shockwaves.map(s => s.radius),
        getLineColor: shockwaves.map(s => s.radius)
      }
    }),

    // Active Trains
    new ScatterplotLayer({
      id: 'train-locations',
      data: trains,
      getPosition: d => [d.lng, d.lat],
      getFillColor: d => {
        if (d.status === 'delayed') return [239, 68, 68] // Red
        // Color by category
        if (d.type === 'Rajdhani' || d.type === 'Duronto') return [250, 204, 21] // Gold
        if (d.type === 'Shatabdi' || d.type === 'Gatimaan') return [56, 189, 248] // Sky
        return [148, 163, 184] // Slate
      },
      getRadius: 8000,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      pickable: true,
      opacity: 0.8,
    }),

    // Incident Heatmap
    new HexagonLayer({
      id: 'incident-heatmap',
      data: incidentPoints,
      getPosition: d => d,
      radius: 40000,
      elevationScale: 1000,
      extruded: true,
      pickable: true,
      colorRange: [
        [254, 240, 138],
        [253, 224, 71],
        [250, 204, 21],
        [234, 179, 8],
        [249, 115, 22],
        [239, 68, 68]
      ],
      opacity: 0.4,
    }),

    // Cascading Impact Arcs
    new ArcLayer({
      id: 'cascading-impacts',
      data: impactArcs,
      getSourcePosition: d => d.source,
      getTargetPosition: d => d.target,
      getSourceColor: [239, 68, 68, 255], // Red
      getTargetColor: [245, 158, 11, 200], // Amber
      getWidth: d => Math.max(2, d.value),
      widthScale: 1.5,
      opacity: 0.8,
      greatCircle: true,
      tilt: 15
    })
  ]

  return (
    <div className="w-full h-full relative bg-slate-900">
      <DeckGL
        viewState={mapViewport}
        onViewStateChange={({ viewState }) => setMapViewport(viewState)}
        controller={{ dragRotate: true }}
        layers={layers}
      >
        <Map
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <NavigationControl position="top-right" />
        </Map>
      </DeckGL>

      {/* Map UI Overlay */}
      <div className="absolute top-4 left-4 z-10 glass-panel p-4 w-72 shadow-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-md">
        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Digital Twin 3D
        </h3>
        
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-slate-400">Active Trains:</span>
            <span className="text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{trains.length}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-slate-400">Cascading Impacts:</span>
            <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">{impactArcs.length} active</span>
          </div>
          <div className="flex justify-between items-center text-xs font-semibold mt-2 pt-2 border-t border-slate-700">
            <span className="text-slate-400">System Status:</span>
            {emergencyMode === 'none' ? (
              <span className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> NOMINAL</span>
            ) : (
              <span className="text-red-500 flex items-center gap-1 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div> {emergencyMode}</span>
            )}
          </div>
        </div>
      </div>

      {hoverInfo && (() => {
        const h = stationHealth.find(st => st.station_id === hoverInfo.id);
        return (
          <div style={{
            position: 'absolute',
            zIndex: 1000,
            pointerEvents: 'none',
            left: hoverInfo.x + 10,
            top: hoverInfo.y + 10,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            backdropFilter: 'blur(4px)',
            color: 'white',
            padding: '10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            minWidth: '160px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              {hoverInfo.name}
            </div>
            {h ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Overall:</span>
                  <span style={{ color: h.status === 'critical' ? '#ef4444' : h.status === 'warning' ? '#f59e0b' : '#34d399', fontWeight: 'bold' }}>{h.overall}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Track Health:</span>
                  <span>{h.track}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Signal Status:</span>
                  <span>{h.signal}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Crowd Level:</span>
                  <span>{h.crowd}%</span>
                </div>
              </div>
            ) : (
              <span style={{ color: '#94a3b8' }}>Loading telemetry...</span>
            )}
          </div>
        );
      })()}
    </div>
  )
}
