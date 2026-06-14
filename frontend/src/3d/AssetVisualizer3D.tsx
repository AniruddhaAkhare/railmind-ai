import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Box, Cylinder, Sphere, Line, Html } from '@react-three/drei'
import { useCommandStore } from '../stores/useCommandStore'
import { api } from '../config/api'
import * as THREE from 'three'

interface BlueprintGeometry {
  type: string;
  nodes: any[];
  edges: any[];
}

function GeometryModel({ geometry, isEmergency }: { geometry: BlueprintGeometry, isEmergency: boolean }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1
    }
  })

  const nodeColor = isEmergency ? '#ef4444' : '#38bdf8'
  const edgeColor = isEmergency ? '#fca5a5' : '#7dd3fc'

  return (
    <group ref={groupRef}>
      {geometry.nodes.map((n, idx) => (
        <Sphere key={idx} args={[0.5, 16, 16]} position={[n.x || (idx * 2 - 5), n.y || 0, n.z || 0]}>
          <meshStandardMaterial color={nodeColor} emissive={nodeColor} emissiveIntensity={0.5} wireframe={geometry.type !== 'train'} />
          <Html distanceFactor={10}>
            <div style={{ color: '#fff', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>
              {n.id}
            </div>
          </Html>
        </Sphere>
      ))}
      {geometry.edges.map((e, idx) => {
        const sourceNode = geometry.nodes.find(n => n.id === e.source)
        const targetNode = geometry.nodes.find(n => n.id === e.target)
        if (!sourceNode || !targetNode) return null
        
        const start = new THREE.Vector3(sourceNode.x || 0, sourceNode.y || 0, sourceNode.z || 0)
        const end = new THREE.Vector3(targetNode.x || 0, targetNode.y || 0, targetNode.z || 0)

        return (
          <Line
            key={idx}
            points={[start, end]}
            color={edgeColor}
            lineWidth={2}
            dashed={isEmergency}
          />
        )
      })}
    </group>
  )
}

export default function AssetVisualizer3D() {
  const { emergencyMode, selectedAssetId } = useCommandStore()
  const [geometry, setGeometry] = useState<BlueprintGeometry | null>(null)

  useEffect(() => {
    const fetchGeometry = async () => {
      try {
        const type = selectedAssetId?.startsWith('TR') ? 'train' : (selectedAssetId?.startsWith('ST') ? 'station' : 'track')
        const res = await api.get(`/digital-twin/blueprint/geometry?type=${type}`)
        setGeometry(res.data)
      } catch (err) {
        console.error('Failed to fetch blueprint geometry', err)
      }
    }
    fetchGeometry()
  }, [selectedAssetId])

  return (
    <div className="card w-full h-80 mb-4 relative overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl">
      <div className="absolute top-3 left-3 z-10">
        <h3 className="card-title text-white m-0 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          3D Blueprint Laboratory
        </h3>
        <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-wider">
          {selectedAssetId ? `Inspecting Asset: ${selectedAssetId}` : 'Network Topology View'}
        </p>
      </div>
      
      <Canvas camera={{ position: [5, 5, 10], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0ea5e9" />
        
        <OrbitControls enableZoom={true} autoRotate={!selectedAssetId} autoRotateSpeed={1.0} />
        
        {/* Holographic grid base */}
        <gridHelper args={[20, 20, '#0ea5e9', '#1e293b']} position={[0, -2, 0]} />
        
        {geometry ? (
          <GeometryModel geometry={geometry} isEmergency={emergencyMode !== 'none'} />
        ) : (
          <Box args={[1, 1, 1]}>
            <meshStandardMaterial color="#334155" wireframe={true} />
          </Box>
        )}
      </Canvas>
      
      {/* HUD Overlay */}
      <div className="absolute bottom-3 right-3 text-right">
        <div className="text-[9px] font-mono text-cyan-400">DIGITAL TWIN RENDER_ENGINE v2.0</div>
        <div className="text-[9px] font-mono text-slate-500">LIVE GEOMETRY SYNC: OK</div>
      </div>
    </div>
  )
}
