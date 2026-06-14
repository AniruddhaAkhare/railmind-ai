import React from 'react'
import { AlertTriangle, Flame, CloudRain, Zap, RadioTower } from 'lucide-react'
import { useCommandStore, EmergencyType } from '../stores/useCommandStore'

export default function EmergencyControlPanel() {
  const { emergencyMode, setEmergencyMode } = useCommandStore()

  const scenarios = [
    { type: 'signal_failure' as EmergencyType, label: 'Signal Failure', icon: RadioTower, color: 'text-amber-600', bg: 'bg-amber-100' },
    { type: 'fire' as EmergencyType, label: 'Fire Incident', icon: Flame, color: 'text-red-600', bg: 'bg-red-100' },
    { type: 'flood' as EmergencyType, label: 'Track Flooding', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-100' },
    { type: 'network_disruption' as EmergencyType, label: 'Power Grid', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-100' },
  ]

  const handleTrigger = async (type: EmergencyType, label: string) => {
    if (emergencyMode === type) {
      setEmergencyMode('none')
    } else {
      setEmergencyMode(type)
      
      // Trigger actual backend LLM pipeline for simulation
      try {
        await fetch('http://localhost:5000/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: type,
            severity: 'critical',
            priority: 10,
            description: `MANUAL SIMULATION: ${label} triggered by Command Center`,
            station_id: 1, // New Delhi default for sim
            affected_passengers: Math.floor(Math.random() * 5000) + 1000,
            estimated_delay_minutes: Math.floor(Math.random() * 120) + 60,
            event_metadata: { simulated: true }
          })
        })
      } catch (err) {
        console.error('Failed to trigger simulation in backend:', err)
      }
    }
  }

  return (
    <div className="card w-full mb-4">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-danger" />
          <h3 className="card-title m-0 text-slate-800">Emergency War Room</h3>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mb-4 font-medium">Trigger simulation scenarios to test AI response</p>
      
      <div className="grid grid-cols-2 gap-3">
        {scenarios.map(s => {
          const isActive = emergencyMode === s.type
          return (
            <button
              key={s.type}
              onClick={() => handleTrigger(s.type, s.label)}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-md border-2 transition-all duration-200 
                ${isActive 
                  ? 'border-red-500 bg-red-50 shadow-sm scale-[1.02]' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-red-500 text-white' : s.bg + ' ' + s.color}`}>
                <s.icon size={16} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-red-600' : 'text-slate-600'}`}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
