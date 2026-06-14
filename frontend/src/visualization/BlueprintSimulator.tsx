import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Line, Box, Sphere, Text } from '@react-three/drei'
import * as THREE from 'three'

interface BlueprintProps {
  type: string
  stationName: string
  severity: string
}

function TrackDefectModel({ severity }: { severity: string }) {
  const color = severity === 'critical' ? '#ef4444' : '#f59e0b';
  return (
    <group position={[0, 0, 0]}>
      {/* Rails */}
      <Box args={[10, 0.2, 0.2]} position={[0, 0.1, -1]} material-color="#64748b" />
      <Box args={[10, 0.2, 0.2]} position={[0, 0.1, 1]} material-color="#64748b" />
      
      {/* Sleepers */}
      {Array.from({ length: 11 }).map((_, i) => (
        <Box key={i} args={[0.4, 0.1, 2.8]} position={[-5 + i, 0, 0]} material-color="#475569" />
      ))}
      
      {/* Defect Highlight */}
      <Sphere args={[0.4, 16, 16]} position={[1, 0.2, -1]}>
        <meshBasicMaterial color={color} wireframe />
      </Sphere>
      <Text position={[1, 1, -1]} fontSize={0.3} color={color} anchorX="center" anchorY="bottom">
        FRACTURE DETECTED
      </Text>
    </group>
  )
}

function FireModel({ severity }: { severity: string }) {
  const fireRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (fireRef.current) {
      fireRef.current.children.forEach((mesh, i) => {
        mesh.position.y = 0.5 + Math.sin(clock.elapsedTime * 5 + i) * 0.2
        mesh.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3 + i) * 0.2)
      })
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Coach Box */}
      <Box args={[8, 2, 2.5]} position={[0, 1, 0]} material-color="#1e293b" material-transparent material-opacity={0.7} />
      
      <group ref={fireRef} position={[0, 0.5, 0]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Sphere key={i} args={[0.3, 8, 8]} position={[-1 + i * 0.5, 0, 0]}>
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </Sphere>
        ))}
      </group>
      <Text position={[0, 2.5, 0]} fontSize={0.4} color="#ef4444" anchorX="center" anchorY="bottom">
        THERMAL ANOMALY
      </Text>
    </group>
  )
}

function FloodModel() {
  const waterRef = useRef<THREE.Mesh>(null)
  
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.1 + 0.5
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Track */}
      <Box args={[10, 0.2, 0.2]} position={[0, 0.1, -1]} material-color="#64748b" />
      <Box args={[10, 0.2, 0.2]} position={[0, 0.1, 1]} material-color="#64748b" />
      
      {/* Water Level */}
      <Box ref={waterRef} args={[12, 0.8, 4]} position={[0, 0.4, 0]}>
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} wireframe />
      </Box>
      <Text position={[0, 1.5, 0]} fontSize={0.4} color="#3b82f6" anchorX="center" anchorY="bottom">
        WATER LEVEL WARNING
      </Text>
    </group>
  )
}

function CrowdModel() {
  return (
    <group position={[0, 0, 0]}>
      {/* Platform */}
      <Box args={[8, 0.2, 4]} position={[0, -0.1, 0]} material-color="#334155" />
      
      {/* Crowd density heatmap simulation */}
      {Array.from({ length: 50 }).map((_, i) => (
        <Sphere 
          key={i} 
          args={[0.1, 8, 8]} 
          position={[(Math.random() - 0.5) * 7, 0.1, (Math.random() - 0.5) * 3]}
        >
          <meshBasicMaterial color={Math.random() > 0.7 ? '#ef4444' : '#f59e0b'} />
        </Sphere>
      ))}
      <Text position={[0, 2, 0]} fontSize={0.4} color="#f59e0b" anchorX="center" anchorY="bottom">
        PASSENGER SURGE
      </Text>
    </group>
  )
}

function GenericModel({ type }: { type: string }) {
  return (
    <group position={[0, 0, 0]}>
      <Box args={[4, 2, 2]} position={[0, 1, 0]}>
        <meshBasicMaterial color="#475569" wireframe />
      </Box>
      <Text position={[0, 2.5, 0]} fontSize={0.4} color="#94a3b8" anchorX="center" anchorY="bottom">
        {type.replace(/_/g, ' ').toUpperCase()}
      </Text>
    </group>
  )
}

export default function BlueprintSimulator({ type, stationName, severity }: BlueprintProps) {
  const getModel = () => {
    if (type.includes('track')) return <TrackDefectModel severity={severity} />
    if (type.includes('fire')) return <FireModel severity={severity} />
    if (type.includes('flood') || type.includes('water')) return <FloodModel />
    if (type.includes('crowd') || type.includes('platform')) return <CrowdModel />
    return <GenericModel type={type} />
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a', position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem', fontFamily: 'JetBrains Mono, monospace' }}>BLUEPRINT LAB</h3>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.75rem' }}>{stationName} • {type.replace(/_/g, ' ').toUpperCase()}</p>
      </div>
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Grid 
          infiniteGrid 
          fadeDistance={20} 
          cellColor="#1e293b" 
          sectionColor="#334155" 
          sectionSize={1} 
          cellSize={0.2} 
        />
        {getModel()}
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
