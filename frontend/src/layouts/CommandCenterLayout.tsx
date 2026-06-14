import React from 'react'
import AgentNetworkGraph from '../agents/AgentNetworkGraph'
import AgentLogPanel from '../agents/AgentLogPanel'
import EmergencyControlPanel from '../emergency/EmergencyControlPanel'
import AssetVisualizer3D from '../3d/AssetVisualizer3D'
import CascadingImpactGraph from '../visualization/CascadingImpactGraph'
import DigitalTwinMap from '../map/DigitalTwinMap'
import { Train, Activity, Settings, LayoutDashboard, BrainCircuit, ShieldAlert } from 'lucide-react'

export default function CommandCenterLayout() {
  return (
    <div className="app-layout font-sans text-slate-800 bg-slate-50">
      
      {/* LEFT SIDEBAR - Global Nav */}
      <aside className="w-[60px] h-full bg-slate-900 flex flex-col items-center py-4 gap-6 z-50">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white mb-4">
          <Train size={24} />
        </div>
        
        <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800">
          <LayoutDashboard size={22} />
        </button>
        <button className="text-white transition-colors p-2 rounded-lg bg-primary/20 border-l-2 border-primary">
          <BrainCircuit size={22} />
        </button>
        <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800">
          <ShieldAlert size={22} />
        </button>
        
        <div className="mt-auto">
          <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800">
            <Settings size={22} />
          </button>
        </div>
      </aside>

      {/* LEFT PANEL - AI Agent Network Graph */}
      <div className="w-[30%] h-full flex flex-col border-r border-slate-200 bg-slate-50 relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            AI Network Core
          </h2>
          <p className="text-xs text-slate-500 mt-1">Multi-Agent Orchestration & Reasoning</p>
        </div>
        <div className="flex-1 relative">
          <AgentNetworkGraph />
        </div>
      </div>

      {/* CENTER PANEL - Digital Twin Map */}
      <div className="flex-1 h-full relative z-10 flex flex-col">
        <div className="flex-1 relative bg-slate-100">
          <DigitalTwinMap />
        </div>
        
        {/* BOTTOM TIMELINE / STATUS (Optional) */}
        <div className="h-12 bg-white border-t border-slate-200 flex items-center px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.02)] z-20">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            System Operating Normally
          </div>
          <div className="ml-auto text-xs text-slate-400 font-mono">
            {new Date().toISOString()}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Intelligence & War Room */}
      <div className="w-[350px] h-full bg-slate-50 border-l border-slate-200 flex flex-col relative z-30 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] overflow-y-auto">
        <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Intelligence</h2>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <EmergencyControlPanel />
          <AssetVisualizer3D />
          <CascadingImpactGraph />
        </div>
      </div>

      {/* OVERLAY - Live Agent Log Feed (Slides out over the map slightly) */}
      <div className="absolute right-[350px] top-0 bottom-0 z-40 transform translate-x-0 transition-transform">
        <AgentLogPanel />
      </div>

    </div>
  )
}
