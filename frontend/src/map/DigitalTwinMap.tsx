import React, { useMemo, useEffect, useState, useRef } from 'react'
import Map, { NavigationControl } from 'react-map-gl'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, ArcLayer, PathLayer, TextLayer } from '@deck.gl/layers'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { useCommandStore } from '../stores/useCommandStore'
import { useAgentGraphStore, AgentGraphEvent } from '../stores/useAgentGraphStore'
import { api } from '../config/api'
import { io } from 'socket.io-client'

import STATIC_STATIONS_DATA from '../data/indian_railway_stations.json'
import STATIC_CORRIDORS_DATA from '../data/indian_railway_corridors.json'

const PathLayerAny = PathLayer as any
const ScatterplotLayerAny = ScatterplotLayer as any
const HexagonLayerAny = HexagonLayer as any
const ArcLayerAny = ArcLayer as any
const TextLayerAny = TextLayer as any

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

// ─── Default Fallback Station & Route Dataset ─────────────────────────────
const DEFAULT_STATIONS = [
  { id: 1,  name: 'New Delhi',       code: 'NDLS', lat: 28.6448, lng: 77.2167, zone: 'NR' },
  { id: 2,  name: 'Mumbai Central',  code: 'MMCT', lat: 18.9691, lng: 72.8194, zone: 'WR' },
  { id: 3,  name: 'Chennai Central', code: 'MAS',  lat: 13.0827, lng: 80.2707, zone: 'SR' },
  { id: 4,  name: 'Kolkata',         code: 'HWH',  lat: 22.5726, lng: 88.3639, zone: 'ER' },
  { id: 5,  name: 'Bengaluru City',  code: 'SBC',  lat: 12.9769, lng: 77.5714, zone: 'SWR' },
  { id: 6,  name: 'Hyderabad',       code: 'HYB',  lat: 17.3850, lng: 78.4867, zone: 'SCR' },
  { id: 7,  name: 'Ahmedabad',       code: 'ADI',  lat: 23.0225, lng: 72.5714, zone: 'WR' },
  { id: 8,  name: 'Pune Junction',   code: 'PUNE', lat: 18.5204, lng: 73.8567, zone: 'CR' },
  { id: 9,  name: 'Jaipur',          code: 'JP',   lat: 26.9124, lng: 75.7873, zone: 'NWR' },
  { id: 10, name: 'Lucknow',         code: 'LKO',  lat: 26.8467, lng: 80.9462, zone: 'NR' },
  { id: 11, name: 'Bhopal',          code: 'BPL',  lat: 23.2599, lng: 77.4126, zone: 'WCR' },
  { id: 12, name: 'Nagpur',          code: 'NGP',  lat: 21.1458, lng: 79.0882, zone: 'CR' },
  { id: 13, name: 'Patna',           code: 'PNBE', lat: 25.5941, lng: 85.1376, zone: 'ECR' },
  { id: 14, name: 'Bhubaneswar',     code: 'BBS',  lat: 20.2961, lng: 85.8195, zone: 'ECoR' },
  { id: 15, name: 'Kochi',           code: 'ERS',  lat:  9.9312, lng: 76.2673, zone: 'SR' },
]

const DEFAULT_ROUTES = [
  [1, 10], [10, 13], [13, 4],           
  [1, 9],  [9, 7],  [7, 8],  [8, 2],   
  [1, 11], [11, 12],[12, 6], [6, 3],    
  [4, 14], [14, 3],                     
  [3, 5],  [5, 15],                     
  [6, 5],  [8, 6],                      
  [12, 14],[10, 13],                    
]

interface StationData {
  id: number
  name: string
  code?: string
  lat: number
  lng: number
  zone?: string
}

interface Train {
  id: string
  lat: number
  lng: number
  speed: number
  status: string
  type?: string
  source?: string
}

interface LiveTrain {
  id: string
  train_number: string
  train_name: string
  latitude: number
  longitude: number
  current_speed: number
  delay_minutes: number
  status: string
  source: string
  stale: boolean
  current_station?: any
  next_station?: any
  bearing?: number
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

// Bounding box helper for DeckGL camera viewport focus
function computeFocusBounds(points: [number, number][]) {
  if (!points || !points.length) return null
  let minLng = points[0][0]
  let maxLng = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]

  for (const [lng, lat] of points) {
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) continue
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const centerLng = (minLng + maxLng) / 2
  const centerLat = (minLat + maxLat) / 2

  const latDelta = Math.abs(maxLat - minLat)
  const lngDelta = Math.abs(maxLng - minLng)
  const maxDelta = Math.max(latDelta, lngDelta)

  let zoom = 10
  if (maxDelta > 10) zoom = 4.8
  else if (maxDelta > 5) zoom = 5.8
  else if (maxDelta > 2) zoom = 6.8
  else if (maxDelta > 1) zoom = 7.8
  else if (maxDelta > 0.5) zoom = 8.8

  return { longitude: centerLng, latitude: centerLat, zoom }
}

export default function DigitalTwinMap() {
  const { mapViewport, setMapViewport, emergencyMode } = useCommandStore()
  const { events } = useAgentGraphStore()
  
  const [stations, setStations] = useState<StationData[]>(DEFAULT_STATIONS)
  const [dbRoutes, setDbRoutes] = useState<any[]>([])
  const [trains, setTrains] = useState<Train[]>([])
  const [liveTrains, setLiveTrains] = useState<LiveTrain[]>([])
  const [liveMode, setLiveMode] = useState<string>('simulation_only')
  const [selectedTrainRoute, setSelectedTrainRoute] = useState<any[] | null>(null)
  const [showLiveRoutes, setShowLiveRoutes] = useState<boolean>(true)
  const [showNetworkRoutes, setShowNetworkRoutes] = useState<boolean>(true)
  const [impactArcs, setImpactArcs] = useState<ImpactArc[]>([])
  const [incidentPoints, setIncidentPoints] = useState<[number, number][]>([])
  const [stationHealth, setStationHealth] = useState<StationHealth[]>([])
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([])
  const [hoverInfo, setHoverInfo] = useState<any>(null)
  
  const lastProcessedEventIdRef = useRef<string | null>(null)

  // ── 1. Ingestion: Fetch API Telemetry & Subscribe to WebSockets ────────────
  useEffect(() => {
    // Fetch Stations from backend DB (config/api unwraps response.data directly)
    const fetchStations = async () => {
      try {
        const res: any = await api.get('/stations?limit=200')
        const fetchedList = res?.stations || res?.data?.stations
        if (Array.isArray(fetchedList) && fetchedList.length > 0) {
          const formatted = fetchedList.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            lat: s.latitude || s.lat,
            lng: s.longitude || s.lng,
            zone: s.zone,
          }))
          setStations(formatted)
        }
      } catch (err) {
        console.warn('Backend stations fetch failed, using default stations dataset:', err)
      }
    }
    fetchStations()

    // Fetch Routes from backend DB
    const fetchRoutes = async () => {
      try {
        const res: any = await api.get('/routes?limit=200')
        const fetchedRoutes = res?.routes || res?.data?.routes
        if (Array.isArray(fetchedRoutes) && fetchedRoutes.length > 0) {
          setDbRoutes(fetchedRoutes)
        }
      } catch (err) {
        console.warn('Backend routes fetch failed:', err)
      }
    }
    fetchRoutes()

    // Fetch Initial Simulated Trains
    const fetchTrains = async () => {
      try {
        const res: any = await api.get('/trains')
        const trainList = res?.trains || res?.data?.trains
        if (Array.isArray(trainList)) {
          setTrains(trainList.map((t: any) => ({
            id: String(t.train_number || t.train_no || t.id),
            lat: Number(t.latitude || t.lat),
            lng: Number(t.longitude || t.lng),
            speed: Number(t.current_speed || t.speed_kmh || 0),
            status: (t.delay_minutes || t.delay_min || 0) > 10 ? 'delayed' : 'on_time',
            type: t.train_type,
            source: t.source || 'simulation',
          })).filter(t => !isNaN(t.lat) && !isNaN(t.lng)))
        }
      } catch (err) {
        console.warn('Simulated trains fetch error:', err)
      }
    }
    fetchTrains()

    // Fetch Live Trains from RailRadar hybrid layer
    const fetchLiveTrains = async () => {
      try {
        const res: any = await api.get('/trains/live')
        const liveList = res?.trains || res?.data?.trains
        if (Array.isArray(liveList)) {
          setLiveTrains(liveList)
          setLiveMode(res?.mode || res?.data?.mode || 'hybrid')
        }
      } catch (err) {
        console.warn('Live train fetch error:', err)
      }
    }
    fetchLiveTrains()
    const liveInterval = setInterval(fetchLiveTrains, 15000)

    // Fetch station health telemetry
    const fetchHealth = async () => {
      try {
        const res: any = await api.get('/sensors/station-health')
        const healthList = res?.health || res?.data?.health
        if (Array.isArray(healthList)) {
          setStationHealth(healthList)
        }
      } catch (err) {
        console.warn('Station health fetch error:', err)
      }
    }
    fetchHealth()
    const healthInterval = setInterval(fetchHealth, 5000)

    // Connect Socket.IO for real-time sensor & live train streams
    const socketBase = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(`${socketBase}/pulse_stream`, { transports: ['websocket', 'polling'] })
    
    socket.on('train_position', (data: any) => {
      if (!data || !data.train_no) return
      const lat = Number(data.lat)
      const lng = Number(data.lng)
      if (isNaN(lat) || isNaN(lng)) return

      setTrains(prev => {
        const trainId = String(data.train_no)
        const idx = prev.findIndex(t => t.id === trainId)
        const newTrain: Train = {
          id: trainId,
          lat,
          lng,
          speed: Number(data.speed_kmh || 0),
          status: (data.delay_min || 0) > 10 ? 'delayed' : 'on_time',
          type: data.train_type,
          source: 'simulation'
        }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = newTrain
          return next
        }
        return [...prev.slice(0, 49), newTrain]
      })
    })

    socket.on('live_train_update', (data: any) => {
      if (data && Array.isArray(data.trains)) {
        setLiveTrains(data.trains)
        if (data.mode) setLiveMode(data.mode)
      }
    })

    socket.on('sensor_update', (data: any) => {
      if (data && data.readings && data.readings.length > 0 && data.readings[0].severity === 'critical') {
        const s = stations.find(st => st.id === data.readings[0].station_id) || stations[Math.floor(Math.random() * stations.length)]
        if (s) setIncidentPoints(prev => [...prev.slice(-9), [s.lng, s.lat]])
      }
    })

    return () => {
      clearInterval(healthInterval)
      clearInterval(liveInterval)
      socket.disconnect()
    }
  }, [])

  // ── 2. Event-Driven Auto-Zoom Invariant ──────────────────────────────────
  // Auto-zoom MUST only trigger when a new event or emergency is created,
  // NOT repeatedly during normal train position polling.
  useEffect(() => {
    if (events.length > 0) {
      const recentEvent = events[0]
      if (!recentEvent || recentEvent.id === lastProcessedEventIdRef.current) return

      lastProcessedEventIdRef.current = recentEvent.id

      // Extract spatial enrichment from snapshot or message
      const snapshot = recentEvent.state_snapshot
      const meta = snapshot?.event_metadata || (recentEvent.message as any)?.event_metadata || {}
      
      if (meta?.affected_trains?.length || meta?.event_lat || recentEvent.event_type === 'emergency_trigger') {
        const points: [number, number][] = []
        
        if (typeof meta.event_lon === 'number' && typeof meta.event_lat === 'number') {
          points.push([meta.event_lon, meta.event_lat])
        }
        if (Array.isArray(meta.affected_trains)) {
          for (const tr of meta.affected_trains) {
            if (typeof tr.longitude === 'number' && typeof tr.latitude === 'number') {
              points.push([tr.longitude, tr.latitude])
            }
          }
        }
        if (meta.nearest_station?.longitude && meta.nearest_station?.latitude) {
          points.push([meta.nearest_station.longitude, meta.nearest_station.latitude])
        }

        if (points.length > 0) {
          const bounds = computeFocusBounds(points)
          if (bounds) {
            setMapViewport(bounds)
          }
        }
      }

      // Cascading impact animation trigger
      if (recentEvent.event_type === 'agent_message_sent' && recentEvent.message?.action_plan) {
        const stationMatch = stations.find(s => (recentEvent.message as any)?.content?.includes(s.name))
        const start = stationMatch || stations[0]
        
        if (start) {
          const newWave: Shockwave = {
            id: `wave-${Date.now()}`,
            lng: start.lng,
            lat: start.lat,
            radius: 1000,
            maxRadius: 300000,
            timestamp: Date.now()
          }
          setShockwaves(prev => [...prev, newWave])

          const targets = stations.filter(s => s.id !== start.id).sort(() => 0.5 - Math.random()).slice(0, 3)
          const newArcs = targets.map(t => ({
            source: [start.lng, start.lat] as [number, number],
            target: [t.lng, t.lat] as [number, number],
            value: Math.random() * 10
          }))
          setImpactArcs(newArcs)
          setIncidentPoints(prev => [...prev.slice(-4), [start.lng, start.lat]])
          
          setTimeout(() => setImpactArcs([]), 5000)
        }
      }
    }
  }, [events, stations, setMapViewport])

  // Shockwave animation loop
  useEffect(() => {
    let animationFrame: number
    const animate = () => {
      setShockwaves(prev => {
        const now = Date.now()
        return prev.filter(w => now - w.timestamp < 4000 && w.radius < w.maxRadius)
                   .map(w => ({ ...w, radius: w.radius + 3000 }))
      })
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  // ── 3. Train Selection & Live Route Overlay Ingestion ──────────────────────
  const handleLiveTrainClick = async (trainNumber: string, lat: number, lng: number) => {
    if (!isNaN(lat) && !isNaN(lng)) {
      setMapViewport({ longitude: lng, latitude: lat, zoom: 9 })
    }
    try {
      const res: any = await api.get(`/trains/${trainNumber}/live?route=true`)
      const data = res?.route_geometry || res?.data?.route_geometry || res
      if (data?.features) {
        setSelectedTrainRoute(data.features)
      } else if (data?.route) {
        const coords = data.route
          .filter((st: any) => typeof st.lat === 'number' && typeof st.lng === 'number')
          .map((st: any) => [st.lng, st.lat])
        if (coords.length > 1) {
          setSelectedTrainRoute([{ geometry: { type: 'LineString', coordinates: coords } }])
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live train route geometry:', err)
    }
  }

  // ── 4. DeckGL Layer Data Calculations ──────────────────────────────────────
  
  // Base Railway Network Routes — combines API DB routes + default network
  const networkPathData = useMemo(() => {
    if (!showNetworkRoutes) return []
    const paths: any[] = []

    if (dbRoutes.length > 0) {
      for (const r of dbRoutes) {
        const src = stations.find(s => s.id === r.source_station_id)
        const dst = stations.find(s => s.id === r.destination_station_id)
        if (src && dst && !isNaN(src.lng) && !isNaN(src.lat) && !isNaN(dst.lng) && !isNaN(dst.lat)) {
          paths.push({ path: [[src.lng, src.lat], [dst.lng, dst.lat]] })
        }
      }
    }
    
    // Always append default corridor network routes
    for (const [fromId, toId] of DEFAULT_ROUTES) {
      const from = stations.find(s => s.id === fromId)
      const to = stations.find(s => s.id === toId)
      if (from && to && !isNaN(from.lng) && !isNaN(from.lat) && !isNaN(to.lng) && !isNaN(to.lat)) {
        paths.push({ path: [[from.lng, from.lat], [to.lng, to.lat]] })
      }
    }
    return paths
  }, [dbRoutes, stations, showNetworkRoutes])

  // Zoom-Dependent Station Label Density Control
  const visibleStaticStations = useMemo(() => {
    const currentZoom = mapViewport?.zoom || 5
    if (currentZoom < 6) {
      // At national view: show major junctions only
      return STATIC_STATIONS_DATA.filter((s: any) => s.type === 'major_junction')
    }
    // As user zooms in: show all stations
    return STATIC_STATIONS_DATA
  }, [mapViewport?.zoom])

  // Selected Live Route Path Data
  const selectedRoutePathData = useMemo(() => {
    if (!selectedTrainRoute || !showLiveRoutes) return []
    const paths: any[] = []
    for (const feat of selectedTrainRoute) {
      if (feat.geometry?.type === 'LineString') {
        paths.push({ path: feat.geometry.coordinates })
      }
    }
    return paths
  }, [selectedTrainRoute, showLiveRoutes])

  // ── 5. Layer Composition (Multi-Layer Infrastructure Architecture) ───────
  const layers: any[] = [
    // ── Static Background Layer 1: Indian Railway Corridor Lines (GeoJSON LineStrings) ──
    new PathLayerAny({
      id: 'static-railway-corridors',
      data: STATIC_CORRIDORS_DATA,
      getPath: (d: any) => d.geometry,
      getColor: (d: any) => d.type === 'major_corridor' ? [56, 189, 248, 150] : [148, 163, 184, 100],
      getWidth: (d: any) => d.type === 'major_corridor' ? 2.5 : 1.5,
      widthMinPixels: 1.2,
      visible: showNetworkRoutes,
      pickable: false,
    }),

    // ── Static Background Layer 2: Indian Railway Network Station Nodes ──
    new ScatterplotLayerAny({
      id: 'static-railway-stations',
      data: STATIC_STATIONS_DATA,
      getPosition: (d: any) => [d.longitude, d.latitude],
      getFillColor: (d: any) => d.type === 'major_junction' ? [56, 189, 248, 220] : [148, 163, 184, 160],
      getLineColor: [15, 23, 42],
      lineWidthMinPixels: 1,
      getRadius: (d: any) => d.type === 'major_junction' ? 12000 : 7000,
      radiusMinPixels: (d: any) => d.type === 'major_junction' ? 3.5 : 2,
      stroked: true,
      pickable: false,
    }),

    // ── Static Background Layer 3: Zoom-Dependent Station Labels (TextLayer) ──
    new TextLayerAny({
      id: 'static-station-labels',
      data: visibleStaticStations,
      getPosition: (d: any) => [d.longitude, d.latitude],
      getText: (d: any) => `${d.name} (${d.code})`,
      getSize: (d: any) => d.type === 'major_junction' ? 12 : 10,
      getColor: [241, 245, 249, 220],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      getPixelOffset: [8, 0],
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '600',
      pickable: false,
    }),

    // Layer 4: Base Network Routes from API DB (PathLayer)
    new PathLayerAny({
      id: 'network-routes',
      data: networkPathData,
      getPath: (d: any) => d.path,
      getColor: [56, 189, 248, 140], // Sky blue track network
      getWidth: 2.5,
      widthMinPixels: 1.5,
      visible: showNetworkRoutes,
    }),

    // Layer 5: Selected Live Train Route Overlay (PathLayer)
    new PathLayerAny({
      id: 'live-route-overlay',
      data: selectedRoutePathData,
      getPath: (d: any) => d.path,
      getColor: [34, 211, 238, 240], // Vibrant cyan overlay
      getWidth: 5,
      widthMinPixels: 3,
      visible: showLiveRoutes,
    }),

    // Layer 6: Dynamic Station Health Nodes (ScatterplotLayer)
    new ScatterplotLayerAny({
      id: 'stations',
      data: stations,
      getPosition: (d: any) => [d.lng, d.lat],
      getFillColor: (d: any) => {
        const health = stationHealth.find(h => h.station_id === d.id)
        if (!health) return [15, 23, 42]
        if (health.status === 'critical') return [239, 68, 68]
        if (health.status === 'warning') return [245, 158, 11]
        return [34, 197, 94]
      },
      getLineColor: [56, 189, 248],
      lineWidthMinPixels: 2,
      getRadius: 14000,
      radiusMinPixels: 4,
      stroked: true,
      pickable: true,
      onHover: (info: any) => setHoverInfo(info.object ? { ...info.object, x: info.x, y: info.y } : null)
    }),

    // Layer 4: Network Shockwaves (ScatterplotLayer)
    new ScatterplotLayerAny({
      id: 'network-shockwaves',
      data: shockwaves,
      getPosition: (d: any) => [d.lng, d.lat],
      getFillColor: [239, 68, 68, 0],
      getLineColor: (d: any) => [239, 68, 68, Math.max(0, 255 * (1 - d.radius / d.maxRadius))],
      getLineWidth: 4,
      getRadius: (d: any) => d.radius,
      stroked: true,
      filled: false,
      updateTriggers: {
        getRadius: shockwaves.map(s => s.radius),
        getLineColor: shockwaves.map(s => s.radius)
      }
    }),

    // Layer 5: Active Simulated / Sensor Stream Trains (ScatterplotLayer)
    new ScatterplotLayerAny({
      id: 'train-locations',
      data: trains,
      getPosition: (d: any) => [d.lng, d.lat],
      getFillColor: (d: any) => {
        if (d.status === 'delayed') return [239, 68, 68]
        if (d.type === 'Rajdhani' || d.type === 'Duronto') return [250, 204, 21]
        if (d.type === 'Shatabdi' || d.type === 'Gatimaan') return [56, 189, 248]
        return [148, 163, 184]
      },
      getRadius: 8000,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      pickable: true,
      opacity: 0.8,
      onHover: (info: any) => setHoverInfo(info.object ? { ...info.object, x: info.x, y: info.y, isSimulated: true } : null)
    }),

    // Layer 6: Live RailRadar Real Trains (ScatterplotLayer)
    new ScatterplotLayerAny({
      id: 'live-train-locations',
      data: liveTrains.filter(t => typeof t.longitude === 'number' && typeof t.latitude === 'number' && !isNaN(t.longitude) && !isNaN(t.latitude)),
      getPosition: (d: any) => [d.longitude, d.latitude],
      getFillColor: (d: any) => {
        if (d.delay_minutes > 15) return [239, 68, 68] // Red for heavy delay
        return [34, 211, 238] // Cyan accent for RailRadar live trains
      },
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1.5,
      getRadius: 11000,
      radiusMinPixels: 5,
      radiusMaxPixels: 12,
      stroked: true,
      pickable: true,
      opacity: (d: any) => (d.stale ? 0.45 : 0.95), // Dim stale data
      onClick: (info: any) => {
        if (info.object) {
          const t = info.object as LiveTrain
          handleLiveTrainClick(t.train_number, t.latitude, t.longitude)
        }
      },
      onHover: (info: any) => setHoverInfo(info.object ? { ...info.object, x: info.x, y: info.y, isLive: true } : null)
    }),

    // Layer 7: Incident Heatmap (HexagonLayer)
    new HexagonLayerAny({
      id: 'incident-heatmap',
      data: incidentPoints,
      getPosition: (d: any) => d,
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

    // Layer 8: Cascading Impact Arcs (ArcLayer)
    new ArcLayerAny({
      id: 'cascading-impacts',
      data: impactArcs,
      getSourcePosition: (d: any) => d.source,
      getTargetPosition: (d: any) => d.target,
      getSourceColor: [239, 68, 68, 255],
      getTargetColor: [245, 158, 11, 200],
      getWidth: (d: any) => Math.max(2, d.value),
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
        onViewStateChange={({ viewState }: any) => setMapViewport(viewState)}
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

      {/* Map UI Panel & Control Readout */}
      <div className="absolute top-4 left-4 z-10 glass-panel p-4 w-80 shadow-xl border border-slate-700/50 bg-slate-900/85 backdrop-blur-md text-xs">
        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            Digital Twin 3D
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            {liveMode.toUpperCase()}
          </span>
        </h3>
        
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center font-semibold">
            <span className="text-slate-400">Live RailRadar Trains:</span>
            <span className="text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60 font-mono">
              {liveTrains.length}
            </span>
          </div>

          <div className="flex justify-between items-center font-semibold">
            <span className="text-slate-400">Simulated Network Trains:</span>
            <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono">
              {trains.length}
            </span>
          </div>

          <div className="flex justify-between items-center font-semibold">
            <span className="text-slate-400">Railway Stations:</span>
            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 font-mono">
              {stations.length}
            </span>
          </div>

          <div className="flex justify-between items-center font-semibold">
            <span className="text-slate-400">Cascading Impacts:</span>
            <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-mono">
              {impactArcs.length} active
            </span>
          </div>

          <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-700/60">
            <span className="text-slate-400 font-medium">Network Corridor Tracks:</span>
            <button
              onClick={() => setShowNetworkRoutes(!showNetworkRoutes)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                showNetworkRoutes
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showNetworkRoutes ? 'VISIBLE' : 'HIDDEN'}
            </button>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-medium">Selected Live Route:</span>
            <button
              onClick={() => setShowLiveRoutes(!showLiveRoutes)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                showLiveRoutes
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {showLiveRoutes ? 'VISIBLE' : 'HIDDEN'}
            </button>
          </div>

          <div className="flex justify-between items-center font-semibold mt-1 pt-2 border-t border-slate-700/60">
            <span className="text-slate-400">System Status:</span>
            {emergencyMode === 'none' ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NOMINAL
              </span>
            ) : (
              <span className="text-red-500 flex items-center gap-1.5 uppercase font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                {emergencyMode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover Info Tooltip */}
      {hoverInfo && (() => {
        if (hoverInfo.isLive) {
          const t = hoverInfo as LiveTrain & { x: number; y: number }
          return (
            <div style={{
              position: 'absolute',
              zIndex: 1000,
              pointerEvents: 'none',
              left: t.x + 10,
              top: t.y + 10,
              backgroundColor: 'rgba(8, 47, 73, 0.95)',
              border: '1px solid rgba(14, 116, 144, 0.8)',
              backdropFilter: 'blur(4px)',
              color: 'white',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
              minWidth: '180px'
            }}>
              <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                {t.train_name || `Train #${t.train_number}`} {t.stale && '(Stale)'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div><span style={{ color: '#94a3b8' }}>Number:</span> #{t.train_number}</div>
                <div><span style={{ color: '#94a3b8' }}>Source:</span> <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>RAILRADAR (Live)</span></div>
                <div><span style={{ color: '#94a3b8' }}>Speed:</span> {t.current_speed || 0} km/h</div>
                <div><span style={{ color: '#94a3b8' }}>Delay:</span> <span style={{ color: t.delay_minutes > 15 ? '#ef4444' : '#34d399' }}>{t.delay_minutes || 0} min</span></div>
                {t.current_station?.code && (
                  <div><span style={{ color: '#94a3b8' }}>Current Stn:</span> {t.current_station.code}</div>
                )}
              </div>
            </div>
          )
        }

        if (hoverInfo.isSimulated) {
          const t = hoverInfo as Train & { x: number; y: number }
          return (
            <div style={{
              position: 'absolute',
              zIndex: 1000,
              pointerEvents: 'none',
              left: t.x + 10,
              top: t.y + 10,
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
              <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                Train #{t.id} ({t.type || 'Simulated'})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div><span style={{ color: '#94a3b8' }}>Source:</span> SIMULATION</div>
                <div><span style={{ color: '#94a3b8' }}>Speed:</span> {t.speed} km/h</div>
                <div><span style={{ color: '#94a3b8' }}>Status:</span> {t.status}</div>
              </div>
            </div>
          )
        }

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
              {hoverInfo.name} ({hoverInfo.code || 'STN'})
            </div>
            {h ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Overall Health:</span>
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
              <span style={{ color: '#94a3b8' }}>Station Telemetry Active</span>
            )}
          </div>
        );
      })()}
    </div>
  )
}
