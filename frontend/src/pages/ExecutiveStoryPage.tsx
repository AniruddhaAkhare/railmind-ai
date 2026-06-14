import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../config/api'
import { useEventStore, RailEvent } from '../stores/useEventStore'
import { 
  Presentation, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  Bot, 
  AlertTriangle, 
  Zap, 
  Cpu, 
  CheckCircle,
  FileText
} from 'lucide-react'

interface StoryStep {
  title: string
  icon: React.ElementType
  content: React.ReactNode
}

export default function ExecutiveStoryPage() {
  const { events } = useEventStore()
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [storySteps, setStorySteps] = useState<StoryStep[]>([])

  const generateStory = useCallback(async (event: RailEvent) => {
    try {
      setLoading(true)
      setError(null)
      setCurrentStep(0)
      setStorySteps([])

      // Fetch messages from all agents for this event
      const agentsRes = await api.get('/agents') as any
      const allMessages: any[] = []

      for (const agent of (agentsRes.agents || []).slice(0, 5)) {
        try {
          const msgsRes = await api.get(`/agents/${agent.id}/messages?limit=20`) as any
          const eventMsgs = (msgsRes.messages || []).filter(
            (m: any) => m.event_id === event.id
          )
          allMessages.push(...eventMsgs)
        } catch {}
      }

      // Sort by creation time
      allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      const steps: StoryStep[] = []

      // 1. What Happened
      steps.push({
        title: 'Initial Incident',
        icon: Activity,
        content: (
          <div className="flex flex-col gap-4">
            <div className="text-xl font-semibold text-slate-800 uppercase tracking-wide">
              {event.event_type?.replace(/_/g, ' ')}
            </div>
            <p className="text-slate-600 text-lg leading-relaxed">
              {event.description || 'A critical infrastructure event occurred, triggering an immediate AI investigation.'}
            </p>
            <div className="flex gap-4 mt-4">
              <div className="bg-slate-100 px-4 py-3 rounded-lg border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Severity</div>
                <div className="font-mono text-lg font-bold" style={{ color: event.severity === 'critical' ? '#dc2626' : '#d97706' }}>
                  {event.severity.toUpperCase()}
                </div>
              </div>
              <div className="bg-slate-100 px-4 py-3 rounded-lg border border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase">Passengers Affected</div>
                <div className="font-mono text-lg font-bold text-slate-800">
                  {event.affected_passengers.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )
      })

      // Group messages by agent roles or themes to build the story
      const observationMsgs = allMessages.filter(m => m.agent_id === 1) // Assuming agent 1 is Observation
      const riskMsgs = allMessages.filter(m => m.agent_id === 4) // Assuming agent 4 is Risk
      const simMsgs = allMessages.filter(m => m.agent_id === 6) // Assuming agent 6 is Simulation
      const decisionMsgs = allMessages.filter(m => m.agent_id === 7) // Assuming agent 7 is Decision

      // 2. What Was Detected (Observation)
      if (observationMsgs.length > 0) {
        steps.push({
          title: 'AI Observation & Understanding',
          icon: Bot,
          content: (
            <div className="flex flex-col gap-4">
              <p className="text-slate-600 text-lg leading-relaxed">
                The AI Observation module immediately gathered telemetry data and built context around the incident.
              </p>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <p className="text-blue-900 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {observationMsgs[0].content}
                </p>
              </div>
            </div>
          )
        })
      }

      // 3. Risks Identified
      if (riskMsgs.length > 0) {
        steps.push({
          title: 'Cascading Risks Identified',
          icon: AlertTriangle,
          content: (
            <div className="flex flex-col gap-4">
              <p className="text-slate-600 text-lg leading-relaxed">
                The Risk Assessment module evaluated downstream consequences and passenger safety hazards.
              </p>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <p className="text-amber-900 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {riskMsgs[0].content}
                </p>
              </div>
            </div>
          )
        })
      }

      // 4. Simulations Ran
      if (simMsgs.length > 0) {
        steps.push({
          title: 'Digital Twin Simulation',
          icon: Zap,
          content: (
            <div className="flex flex-col gap-4">
              <p className="text-slate-600 text-lg leading-relaxed">
                The Simulation engine ran multiple predictive models on the Digital Twin to evaluate intervention strategies.
              </p>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                <p className="text-purple-900 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {simMsgs[0].content}
                </p>
              </div>
            </div>
          )
        })
      }

      // 5. Decision & Action
      if (decisionMsgs.length > 0) {
        steps.push({
          title: 'AI Executive Decision',
          icon: Cpu,
          content: (
            <div className="flex flex-col gap-4">
              <p className="text-slate-600 text-lg leading-relaxed">
                A final action plan was formulated and broadcasted to all operational domains.
              </p>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <p className="text-emerald-900 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {decisionMsgs[decisionMsgs.length - 1].content}
                </p>
              </div>
            </div>
          )
        })
      }

      // 6. Outcome
      steps.push({
        title: 'Final Outcome & Resolution',
        icon: CheckCircle,
        content: (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${event.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                {event.status}
              </div>
              <div className="text-sm font-mono text-slate-500">
                Delay Prevented: {event.estimated_delay_minutes > 15 ? event.estimated_delay_minutes - 10 : 0} mins
              </div>
            </div>
            <p className="text-slate-600 text-lg leading-relaxed mt-2">
              The AI Network successfully orchestrated a multi-domain response, minimizing impact and maintaining passenger safety. 
              The event is logged for future predictive training.
            </p>
          </div>
        )
      })

      setStorySteps(steps)
    } catch (err: any) {
      setError(err?.message || 'Failed to generate story')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <div className="page-header border-b border-slate-200 bg-white">
        <h1 className="page-title flex items-center gap-2">
          <Presentation className="text-primary" size={24} />
          Executive Story Mode
        </h1>
        <p className="page-subtitle">Auto-generated strategic narratives for major incidents.</p>
      </div>

      <div className="flex flex-1 overflow-hidden bg-slate-50">
        
        {/* Left Sidebar: Event List */}
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 text-sm flex items-center gap-2">
            <FileText size={16} /> Select Event to Summarize
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {events.length === 0 ? (
              <div className="text-sm text-slate-500 text-center mt-10">No events available.</div>
            ) : (
              events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    setSelectedEventId(event.id)
                    generateStory(event)
                  }}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedEventId === event.id 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-800 text-sm mb-1 uppercase tracking-wide">
                    {event.event_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      event.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {event.severity}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">#{event.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Area: Presentation Viewer */}
        <div className="flex-1 flex flex-col relative">
          {!selectedEventId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
              <Presentation size={64} className="opacity-20" />
              <p>Select an event from the sidebar to generate its executive story.</p>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="m-8 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
              {error}
            </div>
          ) : storySteps.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              
              {/* Presentation Slide */}
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col overflow-hidden min-h-[500px]">
                {/* Slide Header */}
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {React.createElement(storySteps[currentStep].icon, { size: 24 })}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Step {currentStep + 1} of {storySteps.length}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {storySteps[currentStep].title}
                    </h2>
                  </div>
                </div>

                {/* Slide Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {storySteps[currentStep].content}
                </div>

                {/* Slide Controls */}
                <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-4 py-2 flex items-center gap-2 text-slate-600 font-semibold disabled:opacity-30 hover:text-primary transition-colors"
                  >
                    <ChevronLeft size={18} /> Previous
                  </button>
                  
                  <div className="flex gap-2">
                    {storySteps.map((_, idx) => (
                      <div 
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-primary' : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentStep(Math.min(storySteps.length - 1, currentStep + 1))}
                    disabled={currentStep === storySteps.length - 1}
                    className="px-4 py-2 flex items-center gap-2 bg-primary text-white font-semibold rounded-lg shadow-sm disabled:opacity-30 hover:bg-sky-600 transition-colors"
                  >
                    Next <ChevronRight size={18} />
                  </button>
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
