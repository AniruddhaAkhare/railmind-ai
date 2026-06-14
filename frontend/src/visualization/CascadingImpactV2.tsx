import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useAgentGraphStore } from '../stores/useAgentGraphStore'

interface Node extends d3.SimulationNodeDatum {
  id: string
  label: string
  group: number
  value: number
  active: boolean
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
  active: boolean
}

export default function CascadingImpactV2({ fullScreen = false }: { fullScreen?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { events } = useAgentGraphStore()

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const width = containerRef.current.clientWidth
    const height = fullScreen ? 600 : 300

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Base chain: Track Defect → Train Delay → Platform Congestion → Passenger Overflow → Network Delay → Revenue Impact → Operational Risk
    const nodesData: Node[] = [
      { id: '1', label: 'Initial Incident', group: 1, value: 100, active: false },
      { id: '2', label: 'Train Delay', group: 2, value: 80, active: false },
      { id: '3', label: 'Platform Congestion', group: 3, value: 70, active: false },
      { id: '4', label: 'Passenger Overflow', group: 3, value: 90, active: false },
      { id: '5', label: 'Network Delay', group: 4, value: 60, active: false },
      { id: '6', label: 'Revenue Impact', group: 5, value: 50, active: false },
      { id: '7', label: 'Operational Risk', group: 5, value: 80, active: false },
    ]

    const linksData: Link[] = [
      { source: '1', target: '2', active: false },
      { source: '2', target: '3', active: false },
      { source: '3', target: '4', active: false },
      { source: '2', target: '5', active: false },
      { source: '4', target: '6', active: false },
      { source: '5', target: '7', active: false },
      { source: '6', target: '7', active: false },
    ]

    // Determine activation based on ImpactAgent
    const impactEvent = events.find(e => e.from_agent?.toLowerCase().includes('impact') && e.event_type === 'agent_message_sent')
    if (impactEvent) {
      nodesData.forEach((n, i) => {
        // Sequential activation based on index to simulate propagation
        setTimeout(() => {
          n.active = true
          updateGraph()
        }, i * 500)
      })
      
      linksData.forEach((l, i) => {
        setTimeout(() => {
          l.active = true
          updateGraph()
        }, (i * 500) + 250)
      })
    } else {
      // If no impact event, just show the first node
      nodesData[0].active = true
    }

    const simulation = d3.forceSimulation<Node>(nodesData)
      .force('link', d3.forceLink<Node, Link>(linksData).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(40))

    const g = svg.append('g')

    // Add zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    
    svg.call(zoom)

    let link: any = g.append('g').selectAll('.link')
    let node: any = g.append('g').selectAll('.node')

    function updateGraph() {
      // Update links
      link = link.data(linksData, (d: any) => d.source.id + '-' + d.target.id)
      
      const linkEnter = link.enter().append('line')
        .attr('class', 'link')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0)

      linkEnter.transition().duration(500)
        .attr('opacity', (d: any) => d.active ? 1 : 0.2)
        .attr('stroke', (d: any) => d.active ? '#ef4444' : '#cbd5e1')
        .attr('stroke-dasharray', (d: any) => d.active ? 'none' : '5,5')

      link = linkEnter.merge(link as any)

      // Update nodes
      node = node.data(nodesData, (d: any) => d.id)

      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('opacity', 0)
        .call(d3.drag<SVGGElement, Node>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended))

      nodeEnter.transition().duration(500)
        .attr('opacity', (d: any) => d.active ? 1 : 0.3)

      nodeEnter.append('circle')
        .attr('r', (d: any) => d.active ? 20 + (d.value / 10) : 15)
        .attr('fill', (d: any) => {
          if (!d.active) return '#f1f5f9'
          if (d.group === 1) return '#ef4444' // Incident
          if (d.group === 5) return '#f59e0b' // Risk/Revenue
          return '#3b82f6' // Operations
        })
        .attr('stroke', (d: any) => d.active ? '#fff' : '#cbd5e1')
        .attr('stroke-width', 3)
        .style('filter', (d: any) => d.active ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none')

      nodeEnter.append('text')
        .attr('dy', 35)
        .attr('text-anchor', 'middle')
        .text((d: any) => d.label)
        .style('font-family', 'Inter, sans-serif')
        .style('font-size', '10px')
        .style('font-weight', (d: any) => d.active ? '600' : '400')
        .style('fill', '#334155')
        .style('pointer-events', 'none')

      // Add pulsing ring for active nodes
      nodeEnter.append('circle')
        .attr('r', 25)
        .attr('fill', 'none')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('opacity', (d: any) => d.active && d.group === 1 ? 1 : 0)
        .style('pointer-events', 'none')
        .transition()
        .duration(1500)
        .ease(d3.easeLinear)
        .attr('r', 40)
        .attr('opacity', 0)
        .on('end', function repeat(this: any) {
          d3.select(this)
            .attr('r', 25)
            .attr('opacity', (d: any) => (d as Node).active && (d as Node).group === 1 ? 1 : 0)
            .transition()
            .duration(1500)
            .ease(d3.easeLinear)
            .attr('r', 40)
            .attr('opacity', 0)
            .on('end', repeat)
        })

      node = nodeEnter.merge(node as any)
      
      // Force update properties for merged elements
      node.select('circle')
        .transition().duration(500)
        .attr('r', (d: any) => d.active ? 20 + (d.value / 10) : 15)
        .attr('fill', (d: any) => {
          if (!d.active) return '#f1f5f9'
          if (d.group === 1) return '#ef4444'
          if (d.group === 5) return '#f59e0b'
          return '#3b82f6'
        })
        
      link.transition().duration(500)
        .attr('opacity', (d: any) => d.active ? 1 : 0.2)
        .attr('stroke', (d: any) => d.active ? '#ef4444' : '#cbd5e1')
        .attr('stroke-dasharray', (d: any) => d.active ? 'none' : '5,5')

      simulation.nodes(nodesData).on('tick', ticked)
      simulation.force<d3.ForceLink<Node, Link>>('link')!.links(linksData)
      simulation.alpha(0.3).restart()
    }

    function ticked() {
      link
        .attr('x1', (d: any) => (d.source as Node).x!)
        .attr('y1', (d: any) => (d.source as Node).y!)
        .attr('x2', (d: any) => (d.target as Node).x!)
        .attr('y2', (d: any) => (d.target as Node).y!)

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    }

    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    // Initial render
    updateGraph()

    return () => {
      simulation.stop()
    }
  }, [events, fullScreen])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg ref={svgRef} width="100%" height="100%" />
      {fullScreen && (
        <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(255,255,255,0.9)', padding: '12px 16px', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Cascading Impact Analysis</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Force-directed graph of propagating consequences</p>
        </div>
      )}
    </div>
  )
}
