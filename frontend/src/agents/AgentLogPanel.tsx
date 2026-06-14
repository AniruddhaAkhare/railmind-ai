import React from 'react'
import { useAgentGraphStore, AgentGraphEvent } from '../stores/useAgentGraphStore'
import { ScrollText, ChevronDown } from 'lucide-react'

export default function AgentLogPanel() {
  const { events } = useAgentGraphStore()

  // Filter out just the completed messages from agents
  const messages = events.filter((e: AgentGraphEvent) => e.event_type === 'agent_message_sent')

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <ScrollText size={18} className="text-primary" />
        <h3 className="card-title text-slate-800 m-0">Live Agent Feed</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400 text-center mt-10">Waiting for agent activity...</div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="bg-slate-50 rounded-md border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-primary uppercase bg-blue-50 px-2 py-0.5 rounded-full">
                  {msg.from_agent}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium leading-snug">
                {msg.message?.summary || "Analyzed scenario and formulated response."}
              </p>
              
              {(msg.message?.action_plan || (msg.message as any)?.risk_level || msg.message?.recommendations) && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase mb-2 block">Reasoning Data</span>
                  <div className="bg-slate-100 p-2 rounded text-[10px] font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {JSON.stringify(msg.message, null, 2)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
