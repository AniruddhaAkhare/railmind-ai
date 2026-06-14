import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useEventStore } from '../stores/useEventStore'

interface RiskNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  category: 'Infrastructure' | 'Operations' | 'Passenger' | 'Environment'
  severity: number // 1 to 10
  status: 'active' | 'mitigated' | 'monitoring'
}

interface RiskLink extends d3.SimulationLinkDatum<RiskNode> {
  source: string | RiskNode
  target: string | RiskNode
  strength: number
}

export default function RiskConstellation() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { events } = useEventStore()

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const width = containerRef.current.clientWidth || 400
    const height = 300
    const svg = d3.select(svgRef.current)
    
    svg.selectAll('*').remove()

    // We generate the constellation based on recent events
    // For demo purposes, we create a base constellation that reacts to events
    const hasCritical = events.some(e => e.severity === 'critical')
    const hasHigh = events.some(e => e.severity === 'high')

    const nodesData: RiskNode[] = [
      { id: '1', label: 'Track Stability', category: 'Infrastructure', severity: hasCritical ? 9 : 4, status: hasCritical ? 'active' : 'monitoring' },
      { id: '2', label: 'Signal System', category: 'Infrastructure', severity: 3, status: 'monitoring' },
      { id: '3', label: 'Platform Crowding', category: 'Passenger', severity: hasHigh ? 8 : 5, status: hasHigh ? 'active' : 'monitoring' },
      { id: '4', label: 'Train Delays', category: 'Operations', severity: hasCritical || hasHigh ? 7 : 3, status: 'monitoring' },
      { id: '5', label: 'Flood Risk', category: 'Environment', severity: 2, status: 'monitoring' },
      { id: '6', label: 'Power Grid', category: 'Infrastructure', severity: 4, status: 'monitoring' },
      { id: '7', label: 'Evacuation Cap', category: 'Passenger', severity: hasCritical ? 8 : 4, status: 'monitoring' },
    ]

    const linksData: RiskLink[] = [
      { source: '1', target: '4', strength: 0.8 },
      { source: '2', target: '4', strength: 0.9 },
      { source: '4', target: '3', strength: 0.7 },
      { source: '5', target: '1', strength: 0.6 },
      { source: '5', target: '6', strength: 0.4 },
      { source: '6', target: '2', strength: 0.8 },
      { source: '3', target: '7', strength: 0.5 },
    ]

    // Setup scales
    const colorScale = d3.scaleOrdinal<string, string>()
      .domain(['Infrastructure', 'Operations', 'Passenger', 'Environment'])
      .range(['#3b82f6', '#f59e0b', '#10b981', '#6366f1'])

    // Force simulation
    const simulation = d3.forceSimulation<RiskNode>(nodesData)
      .force('link', d3.forceLink<RiskNode, RiskLink>(linksData).id((d: any) => d.id).distance((d: any) => 120 - (d.strength * 50)))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => (d as RiskNode).severity * 4 + 10))

    const g = svg.append('g')

    // Add zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    
    svg.call(zoom)

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(linksData)
      .enter().append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', (d: any) => d.strength * 3)

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodesData)
      .enter().append('g')
      .call(d3.drag<SVGGElement, RiskNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    // Node circles
    node.append('circle')
      .attr('r', (d: any) => d.severity * 3 + 5)
      .attr('fill', (d: any) => colorScale(d.category))
      .attr('stroke', (d: any) => d.status === 'active' ? '#ef4444' : '#ffffff')
      .attr('stroke-width', (d: any) => d.status === 'active' ? 3 : 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))')

    // Pulsing effect for active risks
    node.filter((d: any) => d.status === 'active')
      .append('circle')
      .attr('r', (d: any) => d.severity * 3 + 5)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none')
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr('r', (d: any) => d.severity * 3 + 20)
      .attr('opacity', 0)
      .on('end', function repeat() {
        d3.select(this)
          .attr('r', (d: any) => d.severity * 3 + 5)
          .attr('opacity', 1)
          .transition()
          .duration(1500)
          .ease(d3.easeLinear)
          .attr('r', (d: any) => d.severity * 3 + 20)
          .attr('opacity', 0)
          .on('end', repeat)
      })

    // Labels
    node.append('text')
      .attr('dy', (d: any) => d.severity * 3 + 18)
      .attr('text-anchor', 'middle')
      .text((d: any) => d.label)
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px')
      .style('font-weight', (d: any) => d.status === 'active' ? '800' : '600')
      .style('fill', (d: any) => d.status === 'active' ? '#dc2626' : '#475569')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '0.05em')
      .style('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as RiskNode).x!)
        .attr('y1', (d: any) => (d.source as RiskNode).y!)
        .attr('x2', (d: any) => (d.target as RiskNode).x!)
        .attr('y2', (d: any) => (d.target as RiskNode).y!)

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: any, d: RiskNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: RiskNode) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: RiskNode) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [events])

  return (
    <div className="card w-full mb-4" style={{ borderRadius: 12, padding: 16 }}>
      <div className="card-header" style={{ marginBottom: 16, borderBottom: '1px solid rgba(51,65,85,0.5)', paddingBottom: 12 }}>
        <h3 className="card-title m-0" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Constellation</h3>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '300px', position: 'relative' }}>
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  )
}
