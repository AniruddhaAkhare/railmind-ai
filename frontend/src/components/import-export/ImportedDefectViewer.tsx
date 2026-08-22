import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Billboard, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { RotateCcw, Eye, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Map, Box } from 'lucide-react'
import * as THREE from 'three'
import { DefectVisualization, SuggestionDecision } from '../../stores/useImportStore'

/* ═══════════════════════════════════════════════ */
/*  CONSTANTS                                     */
/* ═══════════════════════════════════════════════ */

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
}
const SEVERITY_GLOW: Record<string, string> = {
  critical: '#ff6b6b',
  high: '#fbbf24',
  medium: '#60a5fa',
  low: '#9ca3af',
}
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const

/* ═══════════════════════════════════════════════ */
/*  SMOOTH CAMERA TRANSITION                      */
/* ═══════════════════════════════════════════════ */

function CameraController({ target }: { target: [number, number, number] }) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const targetPos = useRef(new THREE.Vector3(target[0] + 4, target[1] + 3, target[2] + 6))
  const lookAtPos = useRef(new THREE.Vector3(...target))

  useEffect(() => {
    targetPos.current.set(target[0] + 4, target[1] + 3, target[2] + 6)
    lookAtPos.current.set(...target)
  }, [target[0], target[1], target[2]])

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.03)
    if (controlsRef.current) {
      const ct = controlsRef.current.target
      ct.lerp(lookAtPos.current, 0.03)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom
      enablePan
      makeDefault
      minDistance={2}
      maxDistance={20}
      maxPolarAngle={Math.PI * 0.85}
    />
  )
}

/* ═══════════════════════════════════════════════ */
/*  FIXED-SIZE BILLBOARD LABEL with leader line   */
/*  Uses sprite mode so text never scales with    */
/*  camera distance — always 1:1 pixel ratio.     */
/* ═══════════════════════════════════════════════ */

function DefectLabel({ from, severity, label, confidence }: {
  from: [number, number, number]
  severity: string
  label: string
  confidence: number
}) {
  const color = SEVERITY_COLOR[severity] || '#888'
  const glow = SEVERITY_GLOW[severity] || '#aaa'
  const labelOffset: [number, number, number] = [from[0] + 0.8, from[1] + 1.4, from[2] + 0.3]

  return (
    <group>
      {/* Leader line: vertical stick → elbow → label */}
      <Line
        points={[from, [from[0], labelOffset[1] - 0.1, from[2]], [labelOffset[0] - 0.3, labelOffset[1] - 0.1, labelOffset[2]]]}
        color={color}
        lineWidth={1.5}
        dashed
        dashSize={0.08}
        gapSize={0.04}
      />
      {/* Elbow dot */}
      <mesh position={[from[0], labelOffset[1] - 0.1, from[2]]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>

      {/* Billboard label — sprite mode = fixed pixel size */}
      <Billboard position={labelOffset} follow={true}>
        {/* 3D card background plane */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.2, 0.7]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.88} side={THREE.DoubleSide} />
        </mesh>
        {/* Left accent bar */}
        <mesh position={[-1.08, 0, 0]}>
          <planeGeometry args={[0.04, 0.7]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} side={THREE.DoubleSide} />
        </mesh>
        {/* Top glow line */}
        <mesh position={[0, 0.34, 0]}>
          <planeGeometry args={[2.2, 0.015]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.5} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* HTML text — rendered in sprite space, fixed pixel size */}
        <Html center sprite style={{ pointerEvents: 'none' }}>
          <div style={{
            color: '#f1f5f9',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
            width: 180,
            transform: 'scale(1)',
            transformOrigin: 'center center',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: 2 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color,
                background: `${color}22`,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${color}44`,
              }}>
                {Math.round(confidence * 100)}%
              </span>
              <span style={{ fontSize: '9px', color: '#64748b' }}>confidence</span>
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  DEFECT MARKER (glow sphere + rings + beam)     */
/* ═══════════════════════════════════════════════ */

function DefectMarker({ position, severity }: {
  position: [number, number, number]
  severity: string
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const ring2Ref = useRef<THREE.Mesh>(null!)
  const beamRef = useRef<THREE.Mesh>(null!)
  const color = SEVERITY_COLOR[severity] || '#888'
  const glow = SEVERITY_GLOW[severity] || '#aaa'

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (meshRef.current) {
      const s = 1 + Math.sin(t * 3) * 0.25
      meshRef.current.scale.set(s, s, s)
      meshRef.current.rotation.y = t * 0.5
    }
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2) * 0.3
      ringRef.current.scale.set(s, s, s)
      ;(ringRef.current.material as THREE.MeshStandardMaterial).opacity = 0.25 + Math.sin(t * 2) * 0.15
    }
    if (ring2Ref.current) {
      const s = 1 + Math.sin(t * 1.5 + 1) * 0.4
      ring2Ref.current.scale.set(s, s, s)
      ;(ring2Ref.current.material as THREE.MeshStandardMaterial).opacity = 0.12 + Math.sin(t * 1.5 + 1) * 0.08
    }
    if (beamRef.current) {
      ;(beamRef.current.material as THREE.MeshStandardMaterial).opacity = 0.2 + Math.sin(t * 4) * 0.1
    }
  })

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.85, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={3} transparent opacity={0.9} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} transparent opacity={0.8} />
      </mesh>
      <mesh ref={beamRef} position={[0, 2, 0]}>
        <cylinderGeometry args={[0.005, 0.04, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  CRACK VISUAL                                  */
/* ═══════════════════════════════════════════════ */

function CrackVisual({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <Line points={[[-0.2, 0.02, -0.12], [-0.08, 0.05, -0.02], [0, 0.01, 0.03], [0.1, 0.04, 0.08], [0.22, 0.01, 0.14]]} color={color} lineWidth={3} />
      <Line points={[[-0.12, 0.01, 0.1], [-0.02, 0.03, 0], [0.08, 0, -0.06], [0.18, 0.02, -0.12]]} color={color} lineWidth={2} />
      <Line points={[[-0.05, 0.015, -0.05], [0.04, 0.025, 0.05]]} color={color} lineWidth={1.5} />
      {[[-0.14, -0.01, 0.03], [0.1, -0.005, -0.06], [-0.04, 0.008, 0.1], [0.15, -0.008, 0.04]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[i * 0.7, i * 1.2, 0]}>
          <boxGeometry args={[0.025, 0.015, 0.02]} />
          <meshStandardMaterial color="#78716c" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  TRACK MODEL                                    */
/* ═══════════════════════════════════════════════ */

function TrackModel({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  const color = SEVERITY_COLOR[viz.defect.severity] || '#888'

  return (
    <group>
      <mesh position={[0, -0.35, 0]}><boxGeometry args={[16, 0.2, 2.4]} /><meshStandardMaterial color="#44403c" transparent opacity={0.5} /></mesh>
      <mesh position={[0, -0.2, 0]}><boxGeometry args={[15, 0.12, 1.8]} /><meshStandardMaterial color="#57534e" transparent opacity={0.65} /></mesh>
      {Array.from({ length: 35 }, (_, i) => (
        <mesh key={i} position={[-7.5 + i * 0.43, -0.09, 0]}><boxGeometry args={[0.22, 0.07, 0.95]} /><meshStandardMaterial color="#a8a29e" roughness={0.8} /></mesh>
      ))}
      {/* Left rail */}
      <mesh position={[0, 0.01, -0.3]}><boxGeometry args={[15, 0.025, 0.1]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} roughness={0.25} /></mesh>
      <mesh position={[0, 0.065, -0.3]}><boxGeometry args={[15, 0.08, 0.03]} /><meshStandardMaterial color="#cfd8dc" metalness={0.75} roughness={0.2} /></mesh>
      <mesh position={[0, 0.12, -0.3]}><boxGeometry args={[15, 0.03, 0.07]} /><meshStandardMaterial color="#eceff1" metalness={0.8} roughness={0.15} /></mesh>
      {/* Right rail */}
      <mesh position={[0, 0.01, 0.3]}><boxGeometry args={[15, 0.025, 0.1]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} roughness={0.25} /></mesh>
      <mesh position={[0, 0.065, 0.3]}><boxGeometry args={[15, 0.08, 0.03]} /><meshStandardMaterial color="#cfd8dc" metalness={0.75} roughness={0.2} /></mesh>
      <mesh position={[0, 0.12, 0.3]}><boxGeometry args={[15, 0.03, 0.07]} /><meshStandardMaterial color="#eceff1" metalness={0.8} roughness={0.15} /></mesh>
      {/* Fishplates */}
      {[-3, 3].map((jx) => (
        <React.Fragment key={jx}>
          {[-0.3, 0.3].map((rz, ri) => (
            <mesh key={ri} position={[jx, 0.065, rz]}><boxGeometry args={[0.12, 0.06, 0.015]} /><meshStandardMaterial color="#78909c" metalness={0.6} /></mesh>
          ))}
        </React.Fragment>
      ))}
      {/* Fasteners */}
      {Array.from({ length: 18 }, (_, i) => (
        <React.Fragment key={i}>
          <mesh position={[-3.5 + i * 0.85, 0.005, -0.3]}><boxGeometry args={[0.06, 0.015, 0.04]} /><meshStandardMaterial color="#546e7a" metalness={0.5} /></mesh>
          <mesh position={[-3.5 + i * 0.85, 0.005, 0.3]}><boxGeometry args={[0.06, 0.015, 0.04]} /><meshStandardMaterial color="#546e7a" metalness={0.5} /></mesh>
        </React.Fragment>
      ))}
      <CrackVisual position={[pos.x, 0.13, pos.z > 0 ? 0.3 : -0.3]} color={color} />
      <DefectMarker position={[pos.x, pos.y + 0.18, pos.z]} severity={viz.defect.severity} />
      <DefectLabel from={[pos.x, pos.y + 0.18, pos.z]} severity={viz.defect.severity} label={viz.defect.label} confidence={viz.defect.confidence} />
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  SIGNAL MODEL                                   */
/* ═══════════════════════════════════════════════ */

function SignalModel({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  const color = SEVERITY_COLOR[viz.defect.severity] || '#888'

  return (
    <group>
      <mesh position={[pos.x, -0.18, pos.z]}><cylinderGeometry args={[0.3, 0.35, 0.12, 12]} /><meshStandardMaterial color="#9e9e9e" roughness={0.9} /></mesh>
      <mesh position={[pos.x, 1.6, pos.z]}><cylinderGeometry args={[0.035, 0.06, 3.5, 8]} /><meshStandardMaterial color="#b0bec5" metalness={0.6} roughness={0.3} /></mesh>
      {[0.5, 1.0, 1.5, 2.0].map((ly, i) => (
        <mesh key={i} position={[pos.x - 0.08, ly, pos.z]}><boxGeometry args={[0.02, 0.02, 0.12]} /><meshStandardMaterial color="#78909c" metalness={0.5} /></mesh>
      ))}
      <mesh position={[pos.x + 0.3, 3.0, pos.z]}><boxGeometry args={[0.6, 0.035, 0.035]} /><meshStandardMaterial color="#607d8b" metalness={0.5} /></mesh>
      <mesh position={[pos.x + 0.55, 3.0, pos.z]}><boxGeometry args={[0.18, 0.7, 0.14]} /><meshStandardMaterial color="#263238" roughness={0.6} /></mesh>
      {[3.2, 3.0, 2.8].map((ly, i) => (
        <mesh key={i} position={[pos.x + 0.55, ly, pos.z + 0.09]}><boxGeometry args={[0.22, 0.04, 0.06]} /><meshStandardMaterial color="#1a1a2e" /></mesh>
      ))}
      <mesh position={[pos.x + 0.55, 3.2, pos.z + 0.08]}><sphereGeometry args={[0.05, 16, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} /></mesh>
      <mesh position={[pos.x + 0.55, 3.0, pos.z + 0.08]}><sphereGeometry args={[0.05, 16, 16]} /><meshStandardMaterial color="#37474f" emissive="#37474f" emissiveIntensity={0.15} /></mesh>
      <mesh position={[pos.x + 0.55, 2.8, pos.z + 0.08]}><sphereGeometry args={[0.05, 16, 16]} /><meshStandardMaterial color="#37474f" emissive="#37474f" emissiveIntensity={0.15} /></mesh>
      <mesh position={[pos.x + 0.05, 1.2, pos.z]}><boxGeometry args={[0.015, 2.4, 0.03]} /><meshStandardMaterial color="#455a64" /></mesh>
      <DefectMarker position={[pos.x + 0.55, 3.7, pos.z]} severity={viz.defect.severity} />
      <DefectLabel from={[pos.x + 0.55, 3.7, pos.z]} severity={viz.defect.severity} label={viz.defect.label} confidence={viz.defect.confidence} />
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  TRAIN MODEL                                    */
/* ═══════════════════════════════════════════════ */

function TrainModel({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  const color = SEVERITY_COLOR[viz.defect.severity] || '#888'
  const defectIdx = 1

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {[-0.3, 0.3].map((tz, i) => (
        <mesh key={i} position={[0, -0.38, tz]}><boxGeometry args={[10, 0.02, 0.06]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} roughness={0.25} /></mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-4.5 + i * 0.6, -0.42, 0]}><boxGeometry args={[0.15, 0.04, 0.7]} /><meshStandardMaterial color="#78716c" /></mesh>
      ))}
      {[-3, 0, 3].map((offset, i) => (
        <group key={i} position={[offset, 0.28, 0]}>
          <mesh><boxGeometry args={[2.4, 0.75, 0.6]} /><meshStandardMaterial color={i === defectIdx ? '#c2410c' : '#1e40af'} metalness={0.2} roughness={0.5} /></mesh>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.42, 0.06, 0.64]} /><meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.4} /></mesh>
          <mesh position={[0, 0.05, 0.305]}><boxGeometry args={[2.4, 0.08, 0.005]} /><meshStandardMaterial color={i === defectIdx ? '#f97316' : '#3b82f6'} /></mesh>
          <mesh position={[0, -0.1, 0.305]}><boxGeometry args={[2.4, 0.04, 0.005]} /><meshStandardMaterial color={i === defectIdx ? '#f97316' : '#3b82f6'} /></mesh>
          {[-0.85, -0.45, -0.05, 0.35, 0.75].map((wx, wi) => (
            <mesh key={wi} position={[wx, 0.12, 0.305]}><boxGeometry args={[0.22, 0.22, 0.01]} /><meshStandardMaterial color="#7dd3fc" emissive="#0ea5e9" emissiveIntensity={0.4} metalness={0.8} roughness={0.1} /></mesh>
          ))}
          <mesh position={[-1.05, 0.0, 0.305]}><boxGeometry args={[0.18, 0.55, 0.01]} /><meshStandardMaterial color="#475569" /></mesh>
          {[-0.8, 0.8].map((bx, bi) => (
            <group key={bi} position={[bx, -0.22, 0]}>
              <mesh><boxGeometry args={[0.4, 0.08, 0.5]} /><meshStandardMaterial color="#37474f" metalness={0.6} /></mesh>
              {[-0.2, 0.2].map((wx, wi) => (
                <mesh key={wi} position={[0, -0.08, 0.28]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.08, 0.08, 0.04, 16]} /><meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} /></mesh>
              ))}
            </group>
          ))}
          {i === defectIdx && (
            <mesh position={[0, 0, 0.31]}><boxGeometry args={[2.42, 0.77, 0.005]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.15} /></mesh>
          )}
        </group>
      ))}
      {[-1.5, 1.5].map((cx, i) => (
        <mesh key={i} position={[cx, -0.12, 0]}><cylinderGeometry args={[0.025, 0.025, 0.35, 8]} /><meshStandardMaterial color="#607d8b" metalness={0.5} /></mesh>
      ))}
      <DefectMarker position={[0, 0.95, 0]} severity={viz.defect.severity} />
      <DefectLabel from={[0, 0.95, 0]} severity={viz.defect.severity} label={viz.defect.label} confidence={viz.defect.confidence} />
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  PLATFORM MODEL                                 */
/* ═══════════════════════════════════════════════ */

function PlatformModel({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  const color = SEVERITY_COLOR[viz.defect.severity] || '#888'

  const crowdPositions = useMemo(() => {
    const pts: { pos: [number, number, number]; inCrowd: boolean }[] = []
    for (let i = 0; i < 18; i++) {
      pts.push({ pos: [Math.sin(i * 2.7) * 2.8, 0.05, Math.cos(i * 1.9) * 0.7], inCrowd: i < 6 })
    }
    return pts
  }, [])

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh position={[0, -0.2, 0]}><boxGeometry args={[8, 0.4, 2.5]} /><meshStandardMaterial color="#d7ccc8" roughness={0.85} /></mesh>
      <mesh position={[0, 0.01, 0]}><boxGeometry args={[8, 0.02, 2.5]} /><meshStandardMaterial color="#efebe9" roughness={0.9} /></mesh>
      <mesh position={[0, 0.025, 1.25]}><boxGeometry args={[8, 0.015, 0.12]} /><meshStandardMaterial color="#fbc02d" emissive="#fbc02d" emissiveIntensity={0.3} /></mesh>
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={i} position={[-3.8 + i * 0.4, 0.02, 0]}><boxGeometry args={[0.005, 0.002, 2.5]} /><meshStandardMaterial color="#bcaaa4" transparent opacity={0.3} /></mesh>
      ))}
      {[-3, -1, 1, 3].map((px, i) => (
        <group key={i} position={[px, 0, -1]}>
          <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.2, 0.03, 0.2]} /><meshStandardMaterial color="#78909c" metalness={0.5} /></mesh>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.04, 0.05, 2.9, 8]} /><meshStandardMaterial color="#90a4ae" metalness={0.5} roughness={0.4} /></mesh>
          <mesh position={[0, 2.95, 0]}><boxGeometry args={[0.18, 0.06, 0.18]} /><meshStandardMaterial color="#78909c" metalness={0.4} /></mesh>
        </group>
      ))}
      <mesh position={[0, 3.05, -1]}><boxGeometry args={[7, 0.06, 2.5]} /><meshStandardMaterial color="#607d8b" transparent opacity={0.45} metalness={0.3} /></mesh>
      {[-2, 2].map((bx, i) => (
        <group key={i} position={[bx, 0.05, 0.3]}>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.5, 0.03, 0.15]} /><meshStandardMaterial color="#5d4037" /></mesh>
          {[-0.2, 0.2].map((lx, li) => (
            <mesh key={li} position={[lx, 0.06, 0]}><boxGeometry args={[0.03, 0.12, 0.12]} /><meshStandardMaterial color="#4e342e" /></mesh>
          ))}
        </group>
      ))}
      <group position={[0, 1.8, -0.95]}>
        <mesh><boxGeometry args={[1.2, 0.3, 0.02]} /><meshStandardMaterial color="#1565c0" /></mesh>
      </group>
      {crowdPositions.map((cp, i) => (
        <group key={i} position={cp.pos}>
          <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.03, 0.05, 0.22, 6]} /><meshStandardMaterial color={cp.inCrowd ? color : '#78909c'} transparent opacity={cp.inCrowd ? 0.85 : 0.35} /></mesh>
          <mesh position={[0, 0.29, 0]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color={cp.inCrowd ? color : '#90a4ae'} transparent opacity={cp.inCrowd ? 0.85 : 0.35} /></mesh>
        </group>
      ))}
      <DefectMarker position={[0, 0.7, 0.5]} severity={viz.defect.severity} />
      <DefectLabel from={[0, 0.7, 0.5]} severity={viz.defect.severity} label={viz.defect.label} confidence={viz.defect.confidence} />
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  GENERIC MODEL                                  */
/* ═══════════════════════════════════════════════ */

function GenericModel({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh position={[0, -0.2, 0]}><boxGeometry args={[2.5, 0.1, 2.5]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh><boxGeometry args={[1.5, 1.5, 1.5]} /><meshStandardMaterial color="#475569" wireframe /></mesh>
      <mesh><boxGeometry args={[1.2, 1.2, 1.2]} /><meshStandardMaterial color="#334155" transparent opacity={0.25} /></mesh>
      <DefectMarker position={[0, 1.2, 0]} severity={viz.defect.severity} />
      <DefectLabel from={[0, 1.2, 0]} severity={viz.defect.severity} label={viz.defect.label} confidence={viz.defect.confidence} />
    </group>
  )
}

/* ═══════════════════════════════════════════════ */
/*  SCENE ROUTER                                   */
/* ═══════════════════════════════════════════════ */

function VizScene({ viz }: { viz: DefectVisualization }) {
  const pos = viz.defect.position
  const target: [number, number, number] = [pos.x, pos.y + 0.5, pos.z]

  return (
    <>
      <CameraController target={target} />
      <fog attach="fog" args={['#0f172a', 12, 25]} />
      {viz.asset_type === 'track' && <TrackModel viz={viz} />}
      {viz.asset_type === 'signal' && <SignalModel viz={viz} />}
      {viz.asset_type === 'train' && <TrainModel viz={viz} />}
      {viz.asset_type === 'platform' && <PlatformModel viz={viz} />}
      {!['track', 'signal', 'train', 'platform'].includes(viz.asset_type) && <GenericModel viz={viz} />}
    </>
  )
}

/* ═══════════════════════════════════════════════ */
/*  3D CANVAS (reusable, fills its container)      */
/* ═══════════════════════════════════════════════ */

function ThreeDCanvas({ viz, resetKey, onReset, style }: {
  viz: DefectVisualization
  resetKey: number
  onReset: () => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--color-border)',
      background: 'linear-gradient(180deg, #0c1929 0%, #0f172a 50%, #1e293b 100%)',
      position: 'relative',
      minHeight: 240,
      ...style,
    }}>
      <Canvas key={`${resetKey}-${viz.viz_id}`} camera={{ position: [5, 4, 8], fov: 45 }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[8, 12, 5]} intensity={1.3} castShadow />
        <pointLight position={[-6, 6, -6]} intensity={0.5} color="#0ea5e9" />
        <pointLight position={[0, 4, 0]} intensity={0.3} color="#fbbf24" />
        <gridHelper args={[24, 24, '#1e3a5f', '#172033']} position={[0, -0.5, 0]} />
        <VizScene viz={viz} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.4} intensity={0.8} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <button onClick={onReset} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, zIndex: 5 }}>
        <RotateCcw size={11} /> Reset Camera
      </button>

      <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: '0.55rem', fontFamily: "'JetBrains Mono', monospace", color: '#475569', display: 'flex', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
        <span>RAILMIND 3D INSPECT</span>
        <span style={{ color: SEVERITY_COLOR[viz.defect.severity] }}>
          {viz.asset_type.toUpperCase()} · {viz.asset_id}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  2D SCHEMATIC (responsive, DPR-aware canvas)    */
/* ═══════════════════════════════════════════════ */

function getSchematicBounds(visualizations: DefectVisualization[], W: number, H: number) {
  const padX = Math.max(46, W * 0.09)
  const padY = Math.max(38, H * 0.13)
  const xs = visualizations.map((v) => v.defect.position.x)
  const zs = visualizations.map((v) => v.defect.position.z)
  const minX = Math.min(...xs) - 1
  const maxX = Math.max(...xs) + 1
  const minZ = Math.min(...zs) - 1
  const maxZ = Math.max(...zs) + 1
  const toPx = (x: number, z: number): [number, number] => [
    padX + ((x - minX) / Math.max(maxX - minX, 1)) * (W - padX * 2),
    padY + ((z - minZ) / Math.max(maxZ - minZ, 1)) * (H - padY * 2),
  ]
  return { toPx }
}

function drawSchematic(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  visualizations: DefectVisualization[],
  selectedVizId: string,
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0c1929')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Grid
  const step = Math.max(24, Math.round(W / 13))
  ctx.strokeStyle = 'rgba(30, 58, 95, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
  for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
  ctx.stroke()

  if (visualizations.length === 0) return

  const { toPx } = getSchematicBounds(visualizations, W, H)
  const baseFont = Math.max(9, Math.round(W / 52))

  // Connector path between assets
  if (visualizations.length > 1) {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    const [sx, sy] = toPx(visualizations[0].defect.position.x, visualizations[0].defect.position.z)
    ctx.moveTo(sx, sy)
    for (let i = 1; i < visualizations.length; i++) {
      const [px, py] = toPx(visualizations[i].defect.position.x, visualizations[i].defect.position.z)
      ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Draw unselected first so the selected marker renders on top
  const ordered = [...visualizations].sort(
    (a, b) => (a.viz_id === selectedVizId ? 1 : 0) - (b.viz_id === selectedVizId ? 1 : 0),
  )
  ordered.forEach((v) => {
    const [cx, cy] = toPx(v.defect.position.x, v.defect.position.z)
    const isSelected = v.viz_id === selectedVizId
    const color = SEVERITY_COLOR[v.defect.severity] || '#888'

    if (isSelected) {
      // Halo + ring + crosshair ticks
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      ctx.fillStyle = `${color}26`
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        ctx.moveTo(cx + dx * 11, cy + dy * 11)
        ctx.lineTo(cx + dx * 19, cy + dy * 19)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Asset dot
    ctx.beginPath()
    ctx.arc(cx, cy, isSelected ? 6.5 : 4.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label
    ctx.font = `${isSelected ? 'bold ' : ''}${baseFont}px Inter, sans-serif`
    ctx.fillStyle = isSelected ? '#f1f5f9' : '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText(v.asset_id, cx, cy - 12)

    // Defect type
    ctx.font = `${Math.max(8, baseFont - 2)}px Inter, sans-serif`
    ctx.fillStyle = '#64748b'
    ctx.fillText(v.defect.type.replace(/_/g, ' '), cx, cy + 18)
  })
}

function SchematicView({ visualizations, selectedVizId, onSelectViz, style }: {
  visualizations: DefectVisualization[]
  selectedVizId: string
  onSelectViz: (id: string) => void
  style?: React.CSSProperties
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Track container size so the canvas stays sharp at any resolution
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Redraw whenever size, data, or selection changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawSchematic(ctx, size.w, size.h, visualizations, selectedVizId)
  }, [size, visualizations, selectedVizId])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || visualizations.length === 0) return
    const rect = canvas.getBoundingClientRect()
    const W = size.w || rect.width
    const H = size.h || rect.height
    const { toPx } = getSchematicBounds(visualizations, W, H)
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let closest = visualizations[0]
    let minDist = Infinity
    visualizations.forEach((v) => {
      const [cx, cy] = toPx(v.defect.position.x, v.defect.position.z)
      const d = Math.hypot(mx - cx, my - cy)
      if (d < minDist) { minDist = d; closest = v }
    })
    if (minDist < Math.max(22, W / 14)) onSelectViz(closest.viz_id)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', ...style }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      />
      {visualizations.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
          No visualizable assets
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  SCHEMATIC PANEL (header + legend + canvas)     */
/* ═══════════════════════════════════════════════ */

function SeverityLegend() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {SEVERITY_ORDER.map((s) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.52rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_COLOR[s], display: 'inline-block', flexShrink: 0 }} />
          {s}
        </span>
      ))}
    </div>
  )
}

function SchematicPanel({ visualizations, selectedVizId, onSelectViz, canvasStyle, title }: {
  visualizations: DefectVisualization[]
  selectedVizId: string
  onSelectViz: (id: string) => void
  canvasStyle?: React.CSSProperties
  title?: string
}) {
  return (
    <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Map size={10} /> {title || 'Schematic'}
          {visualizations.length > 1 && (
            <span style={{ color: '#0284c7', fontWeight: 700, marginLeft: 2 }}>{visualizations.length} assets</span>
          )}
        </div>
        <SeverityLegend />
      </div>
      <SchematicView
        visualizations={visualizations}
        selectedVizId={selectedVizId}
        onSelectViz={onSelectViz}
        style={canvasStyle}
      />
      <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={9} /> Click a marker to inspect it in 3D
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  EVIDENCE PANEL                                 */
/* ═══════════════════════════════════════════════ */

function EvidencePanel({ viz }: { viz: DefectVisualization }) {
  const ev = viz.evidence
  return (
    <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, fontSize: '0.7rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Eye size={14} /> Evidence
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ lineHeight: 1.4 }}><span style={{ color: 'var(--color-text-muted)' }}>Description: </span><span style={{ color: 'var(--color-text-primary)' }}>{ev.description || '—'}</span></div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Source: </span><span style={{ color: '#0284c7', fontWeight: 600 }}>{ev.sensor_source}</span></div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Position: </span>
          <span style={{ color: ev.position_accuracy === 'estimated' ? '#f59e0b' : '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {ev.position_accuracy === 'estimated' && <AlertTriangle size={10} />}
            {ev.position_accuracy}
          </span>
        </div>
        {ev.chainage_m != null && <div><span style={{ color: 'var(--color-text-muted)' }}>Chainage: </span>{ev.chainage_m}m</div>}
        {ev.latitude != null && <div><span style={{ color: 'var(--color-text-muted)' }}>Lat/Lon: </span>{ev.latitude.toFixed(4)}, {ev.longitude?.toFixed(4)}</div>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  ASSET SUMMARY PANEL                            */
/* ═══════════════════════════════════════════════ */

function AssetSummary({ viz }: { viz: DefectVisualization }) {
  return (
    <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>Asset</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: SEVERITY_COLOR[viz.defect.severity], boxShadow: `0 0 8px ${SEVERITY_COLOR[viz.defect.severity]}`, display: 'inline-block', flexShrink: 0 }} />
        {viz.asset_id}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
        {viz.asset_type} · {viz.defect.type.replace(/_/g, ' ')}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Confidence</span>
          <span style={{ fontSize: '0.65rem', color: SEVERITY_COLOR[viz.defect.severity], fontWeight: 700 }}>
            {Math.round(viz.defect.confidence * 100)}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(viz.defect.confidence * 100)}%`, background: `linear-gradient(90deg, ${SEVERITY_COLOR[viz.defect.severity]}, ${SEVERITY_GLOW[viz.defect.severity]})`, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  DECISION PANEL                                 */
/* ═══════════════════════════════════════════════ */

function DecisionPanel({ decision, onApprove, onReject }: {
  decision: SuggestionDecision
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Inspection Decision</div>
      {decision === 'pending' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onApprove} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'transform 0.1s, box-shadow 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}>
            <CheckCircle size={13} /> Approve
          </button>
          <button onClick={onReject} style={{ flex: 1, background: 'transparent', color: '#ef4444', border: '1.5px solid #ef4444', borderRadius: 8, padding: '10px 0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <XCircle size={13} /> Reject
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '0.72rem', fontWeight: 700, color: decision === 'approved' ? '#10b981' : '#ef4444', background: decision === 'approved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
          {decision === 'approved'
            ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><CheckCircle size={15} /> Approved — Inspection selected</span>
            : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><XCircle size={15} /> Rejected — No action taken</span>}
        </div>
      )}
      <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
        Approving focuses the 3D view and records the decision. It does <strong>not</strong> close tracks, dispatch teams, or modify operations.
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/*  MAIN VIEWER                                    */
/* ═══════════════════════════════════════════════ */

interface ImportedDefectViewerProps {
  visualizations: DefectVisualization[]
  selectedVizId: string | null
  onSelectViz: (vizId: string) => void
  inspectionDecisions: Record<string, SuggestionDecision>
  onApprove: (vizId: string) => void
  onReject: (vizId: string) => void
}

export default function ImportedDefectViewer({
  visualizations,
  selectedVizId,
  onSelectViz,
  inspectionDecisions,
  onApprove,
  onReject,
}: ImportedDefectViewerProps) {
  const [resetKey, setResetKey] = useState(0)
  const [viewMode, setViewMode] = useState<'3d' | 'schematic'>('3d')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedViz = useMemo(
    () => visualizations.find((v) => v.viz_id === selectedVizId) || visualizations[0],
    [visualizations, selectedVizId],
  )

  const handleReset = useCallback(() => setResetKey((k) => k + 1), [])
  const handlePrev = useCallback(() => {
    const idx = visualizations.findIndex((v) => v.viz_id === selectedVizId)
    if (idx > 0) onSelectViz(visualizations[idx - 1].viz_id)
  }, [visualizations, selectedVizId, onSelectViz])
  const handleNext = useCallback(() => {
    const idx = visualizations.findIndex((v) => v.viz_id === selectedVizId)
    if (idx >= 0 && idx < visualizations.length - 1) onSelectViz(visualizations[idx + 1].viz_id)
  }, [visualizations, selectedVizId, onSelectViz])

  /* ─── Keyboard navigation (scoped to viewer focus) ─── */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement
      // Only handle keys when the viewer (or one of its children) has focus,
      // so page-wide navigation (scroll, map) is never hijacked.
      const focusedHere = container === active || (active !== null && container.contains(active))
      if (!focusedHere) return
      const isInput = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
      if (isInput) return

      const idx = visualizations.findIndex((v) => v.viz_id === selectedVizId)
      if (idx === -1) return
      if (e.key === 'ArrowLeft') {
        if (idx <= 0) return
        e.preventDefault()
        onSelectViz(visualizations[idx - 1].viz_id)
      } else if (e.key === 'ArrowRight') {
        if (idx >= visualizations.length - 1) return
        e.preventDefault()
        onSelectViz(visualizations[idx + 1].viz_id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visualizations, selectedVizId, onSelectViz])

  // Parent only mounts this viewer when at least one visualization exists
  if (!selectedViz) return null

  const decision = inspectionDecisions[selectedViz.viz_id] || 'pending'
  const selectedIdx = visualizations.findIndex((v) => v.viz_id === selectedViz.viz_id)

  const sidePanelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: '0 0 300px',
    minWidth: 260,
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        outline: 'none',
      }}
    >
      {/* Header + view toggle + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={18} color="#0284c7" />
          3D Defect Inspection
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {visualizations.length} asset{visualizations.length !== 1 ? 's' : ''} detected
          </span>
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['3d', 'schematic'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                title={m === '3d' ? 'Show 3D model as the main view' : 'Show the schematic as the main view'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: viewMode === m ? '#0284c7' : 'transparent',
                  color: viewMode === m ? '#fff' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m === '3d' ? <Box size={13} /> : <Map size={13} />}
                {m === '3d' ? '3D Model' : 'Schematic'}
              </button>
            ))}
          </div>
          {visualizations.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={handlePrev} disabled={selectedIdx === 0} style={navBtnStyle(selectedIdx === 0)}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', minWidth: 40, textAlign: 'center' }}>
                {selectedIdx + 1}/{visualizations.length}
              </span>
              <button onClick={handleNext} disabled={selectedIdx === visualizations.length - 1} style={navBtnStyle(selectedIdx === visualizations.length - 1)}>
                <ChevronRight size={14} />
              </button>
              <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                ← → keys
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Incident tabs */}
      {visualizations.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
          {visualizations.map((v) => {
            const isActive = v.viz_id === selectedViz.viz_id
            const dec = inspectionDecisions[v.viz_id] || 'pending'
            const sevColor = SEVERITY_COLOR[v.defect.severity] || '#888'
            return (
              <button
                key={v.viz_id}
                onClick={() => onSelectViz(v.viz_id)}
                style={{
                  background: isActive ? `${sevColor}15` : 'var(--color-bg-base)',
                  border: `1.5px solid ${isActive ? sevColor : 'var(--color-border)'}`,
                  borderRadius: 8, padding: '8px 14px', textAlign: 'left', cursor: 'pointer',
                  fontSize: '0.7rem', color: 'var(--color-text-primary)', transition: 'all 0.15s',
                  flexShrink: 0, minWidth: 140, position: 'relative',
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, boxShadow: `0 0 6px ${sevColor}`, display: 'inline-block', flexShrink: 0 }} />
                  <span>{v.asset_id}</span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 600, color: sevColor, background: `${sevColor}18`, padding: '1px 5px', borderRadius: 3, marginLeft: 'auto' }}>{v.defect.severity}</span>
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.6rem', marginTop: 3 }}>{v.defect.label}</div>
                <div style={{ fontSize: '0.55rem', marginTop: 4, color: dec === 'approved' ? '#10b981' : dec === 'rejected' ? '#ef4444' : 'var(--color-text-muted)', fontWeight: 600 }}>
                  {dec === 'pending' ? '● Awaiting review' : dec === 'approved' ? '✓ Approved' : '✗ Rejected'}
                </div>
                {isActive && <div style={{ position: 'absolute', bottom: 0, left: '10%', width: '80%', height: 2, borderRadius: 1, background: sevColor }} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Main content — layout depends on view mode */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {viewMode === '3d' ? (
          <>
            {/* Large 3D canvas fills the row height */}
            <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex' }}>
              <ThreeDCanvas viz={selectedViz} resetKey={resetKey} onReset={handleReset} style={{ flex: 1, minHeight: 420 }} />
            </div>
            {/* Side panel with schematic minimap */}
            <div style={sidePanelStyle}>
              <SchematicPanel
                visualizations={visualizations}
                selectedVizId={selectedViz.viz_id}
                onSelectViz={onSelectViz}
                canvasStyle={{ height: 190 }}
              />
              <AssetSummary viz={selectedViz} />
              <EvidencePanel viz={selectedViz} />
              <DecisionPanel
                decision={decision}
                onApprove={() => onApprove(selectedViz.viz_id)}
                onReject={() => onReject(selectedViz.viz_id)}
              />
            </div>
          </>
        ) : (
          <>
            {/* Schematic is the main window; 3D model stays visible below it */}
            <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SchematicPanel
                visualizations={visualizations}
                selectedVizId={selectedViz.viz_id}
                onSelectViz={onSelectViz}
                canvasStyle={{ height: 330 }}
                title="Schematic Overview"
              />
              <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Box size={10} /> 3D Model
                </div>
                <ThreeDCanvas viz={selectedViz} resetKey={resetKey} onReset={handleReset} style={{ height: 240 }} />
              </div>
            </div>
            {/* Side panel */}
            <div style={sidePanelStyle}>
              <AssetSummary viz={selectedViz} />
              <EvidencePanel viz={selectedViz} />
              <DecisionPanel
                decision={decision}
                onApprove={() => onApprove(selectedViz.viz_id)}
                onReject={() => onReject(selectedViz.viz_id)}
              />
              <div style={{ background: 'var(--color-bg-base)', border: '1px dashed var(--color-border)', borderRadius: 8, padding: 12, fontSize: '0.6rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                <AlertTriangle size={11} style={{ verticalAlign: -2, marginRight: 4 }} />
                Tip: click a marker on the schematic to jump to that asset — the 3D model updates live.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Nav button helper ─── */
function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--color-bg-base)',
    border: `1px solid ${disabled ? 'var(--color-border)' : 'var(--color-text-muted)'}`,
    borderRadius: 6, padding: '4px 6px',
    color: disabled ? 'var(--color-border)' : 'var(--color-text-primary)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center',
    opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
  }
}
