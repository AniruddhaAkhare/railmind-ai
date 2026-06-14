import React from 'react';
import { useAgentGraphStore } from '../stores/useAgentGraphStore';
import { X, Bot, Shield, AlertTriangle, Zap, Server } from 'lucide-react';

export default function AgentDetails() {
  const { selectedNodeId, setSelectedNode, nodeData, nodeStates } = useAgentGraphStore();

  if (!selectedNodeId) return null;

  const agentKey = Object.keys(nodeStates).find(k => k.toLowerCase().includes(selectedNodeId.toLowerCase())) || selectedNodeId;
  const status = nodeStates[agentKey] || 'idle';
  const data = nodeData[agentKey] || {};

  return (
    <div className="absolute top-4 right-4 w-80 glass-panel shadow-xl flex flex-col z-20 animate-slide-in-right overflow-hidden border-2 border-slate-200">
      <div className="bg-slate-800 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider">{selectedNodeId} Agent</span>
        </div>
        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto bg-white/90">
        <div className="mb-4">
          <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Current Status</div>
          <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full ${status === 'thinking' ? 'bg-amber-400 animate-pulse' : status === 'reasoning' ? 'bg-blue-500 animate-pulse' : status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-xs font-semibold text-slate-700 capitalize">{status}</span>
          </div>
        </div>

        {data.confidence !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] uppercase text-slate-400 font-bold mb-1">
              <span>Confidence Level</span>
              <span className="text-blue-600">{Math.round(data.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${data.confidence * 100}%` }} />
            </div>
          </div>
        )}

        {data.summary && (
          <div className="mb-4">
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Executive Summary</div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
              {data.summary}
            </p>
          </div>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Recommendations</div>
            <ul className="flex flex-col gap-1.5">
              {data.recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.error && (
          <div className="mb-4 bg-red-50 border border-red-100 p-2 rounded">
            <div className="text-[10px] uppercase text-red-500 font-bold mb-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Error
            </div>
            <p className="text-xs text-red-700">{data.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
