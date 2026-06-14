import React from 'react';
import { BaseEdge, getBezierPath, EdgeProps } from 'reactflow';

export default function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isAnimating = data?.isAnimating;
  const isError = data?.isError;
  const color = isError ? '#ef4444' : '#0ea5e9';

  return (
    <>
      {/* Base edge — subtle when inactive, vibrant when active */}
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: isAnimating ? 2.5 : 1,
          stroke: isAnimating ? color : '#cbd5e1',
          transition: 'all 0.4s ease',
          filter: isAnimating ? `drop-shadow(0 0 4px ${color}60)` : 'none',
        }} 
      />

      {/* Animated message packet — travels along the edge path */}
      {isAnimating && (
        <>
          {/* Primary packet */}
          <circle r="5" fill={color} opacity="0.9">
            <animateMotion 
              dur="1.2s" 
              repeatCount="indefinite" 
              path={edgePath} 
            />
          </circle>

          {/* Inner glow dot */}
          <circle r="2.5" fill="#fff" opacity="0.9">
            <animateMotion 
              dur="1.2s" 
              repeatCount="indefinite" 
              path={edgePath} 
            />
          </circle>

          {/* Trail packet (delayed) */}
          <circle r="3" fill={color} opacity="0.4">
            <animateMotion 
              dur="1.2s" 
              repeatCount="indefinite" 
              path={edgePath}
              begin="0.3s"
            />
          </circle>

          {/* Pulsing glow effect on the edge path */}
          <path
            d={edgePath}
            fill="none"
            stroke={color}
            strokeWidth="6"
            opacity="0.15"
            strokeLinecap="round"
          >
            <animate
              attributeName="opacity"
              values="0.15;0.05;0.15"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}
    </>
  );
}
