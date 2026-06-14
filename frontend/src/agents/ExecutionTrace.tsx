import React, { useState } from 'react';
import { useAgentGraphStore } from '../stores/useAgentGraphStore';
import { ChevronDown, ScrollText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function ExecutionTrace() {
  const { executionTrace } = useAgentGraphStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200">
        <ScrollText size={16} className="text-blue-600" />
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Execution Trace
        </span>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {executionTrace.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
            <Clock size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-medium">Waiting for LangGraph execution...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {executionTrace.map((event, idx) => {
              const isExpanded = expandedId === event.id;
              const isError = event.event_type === 'agent_failed';
              const isSuccess = event.event_type === 'agent_completed' || event.event_type === 'agent_message_sent';
              
              let bgColor = 'bg-slate-50';
              let borderColor = 'border-slate-200';
              if (isError) {
                bgColor = 'bg-red-50';
                borderColor = 'border-red-200';
              } else if (event.event_type === 'agent_started') {
                bgColor = 'bg-amber-50';
                borderColor = 'border-amber-200';
              }

              return (
                <div key={event.id || idx} className={`rounded-lg border ${borderColor} ${bgColor} p-3 transition-all`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                      {event.from_agent}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-medium mb-2">
                    {event.event_type === 'agent_started' && 'Started thinking...'}
                    {event.event_type === 'agent_message_sent' && 'Sent reasoning output'}
                    {event.event_type === 'agent_completed' && 'Execution completed'}
                    {isError && <span className="text-red-600">Execution failed</span>}
                  </div>

                  {event.message?.summary && (
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                      {event.message.summary}
                    </p>
                  )}

                  {(event.message?.reasoning || event.message?.error) && (
                    <div 
                      className="mt-2 pt-2 border-t border-slate-200/60 cursor-pointer flex justify-between items-center group"
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    >
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  )}

                  {isExpanded && (event.message?.reasoning || event.message?.error) && (
                    <div className="mt-2 p-2 bg-white/60 rounded text-[10px] font-mono text-slate-600 whitespace-pre-wrap">
                      {event.message?.error || event.message?.reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
