import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useAgentGraphStore } from '../stores/useAgentGraphStore'
import CascadingImpactV2 from './CascadingImpactV2'
import { Maximize2, X } from 'lucide-react'

export default function CascadingImpactGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { events } = useAgentGraphStore()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!svgRef.current || expanded) return

    const width = 300
    const height = 150
    const svg = d3.select(svgRef.current)
    
    // Clear previous
    svg.selectAll('*').remove()

    // Base data
    let data = [
      { id: '1', name: 'Infrastructure', val: 100 },
      { id: '2', name: 'Operations', val: 100 },
      { id: '3', name: 'Passenger Flow', val: 100 },
    ]

    // Find latest ImpactAgent message
    const impactEvent = events.find(e => e.from_agent?.toLowerCase().includes('impact') && e.event_type === 'agent_message_sent')
    
    if (impactEvent && impactEvent.message) {
      const msg = impactEvent.message
      const baseConfidence = msg.confidence || 0.5
      
      data = [
        { id: '1', name: 'Infrastructure', val: Math.max(10, 100 - (baseConfidence * 70)) },
        { id: '2', name: 'Operations', val: Math.max(10, 100 - (baseConfidence * 60)) },
        { id: '3', name: 'Passenger Flow', val: Math.max(10, 100 - (baseConfidence * 80)) },
      ]
      
      const impacts = (msg as any).cascading_impacts
      if (impacts) {
         if (impacts.infrastructure_health) data[0].val = impacts.infrastructure_health
         if (impacts.operations_efficiency) data[1].val = impacts.operations_efficiency
         if (impacts.passenger_flow) data[2].val = impacts.passenger_flow
      }
    }

    const x = d3.scaleLinear().domain([0, 100]).range([0, width - 100])
    const y = d3.scaleBand().domain(data.map(d => d.name)).range([0, height]).padding(0.4)

    const g = svg.append('g').attr('transform', `translate(80, 0)`)

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.name)!)
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', 0)
      .attr('fill', d => {
        if (d.val < 40) return '#dc2626' // red
        if (d.val < 70) return '#d97706' // amber
        return '#0284c7' // blue
      })
      .attr('rx', 4)
      .transition()
      .duration(1000)
      .attr('width', d => x(d.val))

    // Labels
    g.selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .attr('y', d => y(d.name)! + y.bandwidth() / 2 + 4)
      .attr('x', -5)
      .attr('text-anchor', 'end')
      .text(d => d.name)
      .style('font-size', '10px')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('fill', '#475569')
      .style('font-weight', '600')
      .style('text-transform', 'uppercase')

  }, [events, expanded])

  return (
    <>
      <div className="card w-full mb-4" style={{ borderRadius: 12, padding: 16 }}>
        <div className="card-header" style={{ marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title m-0" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cascading Impact</h3>
          <button 
            onClick={() => setExpanded(true)}
            className="text-slate-400 hover:text-primary transition-colors p-1"
            title="Expand into V2 Force Graph"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Maximize2 size={14} color="#64748b" />
          </button>
        </div>
        <div className="flex justify-center" style={{ padding: '8px 0' }}>
          <svg ref={svgRef} width="300" height="150" />
        </div>
      </div>

      {/* Expandable V2 Overlay */}
      {expanded && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40
        }}>
          <div style={{
            background: 'white', width: '100%', maxWidth: 1000, height: 700, 
            borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'
          }}>
            <button 
              onClick={() => setExpanded(false)}
              style={{
                position: 'absolute', top: 16, right: 16, background: 'white', border: '1px solid #e2e8f0',
                borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10, color: '#64748b'
              }}
              className="hover:bg-slate-100"
            >
              <X size={16} />
            </button>
            <CascadingImpactV2 fullScreen={true} />
          </div>
        </div>
      )}
    </>
  )
}
