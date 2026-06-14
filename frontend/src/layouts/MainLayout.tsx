import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  Network,
  Map,
  Cpu,
  Play,
  Train,
  Activity,
  Wifi,
  WifiOff,
  ChevronRight,
  Shield,
  Presentation,
} from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'

const navGroups = [
  {
    section: 'Operations',
    items: [
      { to: '/',            icon: LayoutDashboard, label: 'Command Center',    badge: 'LIVE' },
      { to: '/map',         icon: Map,             label: 'Railway Network Map' },
    ],
  },
  {
    section: 'AI Intelligence',
    items: [
      { to: '/agents',      icon: Bot,             label: 'Agent Dashboard' },
      { to: '/agent-graph', icon: Network,         label: 'Agent Network Graph', badge: 'NEW' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { to: '/digital-twin',icon: Cpu,             label: 'Digital Twin' },
      { to: '/replay',      icon: Play,            label: 'Incident Replay' },
      { to: '/story',       icon: Presentation,    label: 'Executive Story', badge: 'EXEC' },
    ],
  },
]

import { useThemeStore } from '../stores/useThemeStore'

// Add inside the MainLayout component
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { connected } = useWebSocket()
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="app-layout">

      {/* ─── SIDEBAR ─── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
            }}>
              <Train size={18} color="#fff" />
            </div>
            <div>
              <div className="sidebar-logo-title">RailMind AI</div>
              <div className="sidebar-logo-subtitle">Indian Railways Intelligence</div>
            </div>
          </div>
        </div>

        {/* Live status bar */}
        <div style={{
          padding: '8px 16px',
          background: connected ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
          borderBottom: `1px solid ${connected ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '0.68rem', fontWeight: 700,
          color: connected ? '#059669' : '#dc2626',
        }}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'Live — Backend Connected' : 'Reconnecting to backend…'}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navGroups.map(group => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(({ to, icon: Icon, label, badge }) => {
                const isActive = to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(to)
                return (
                  <Link key={to} to={to} className={`nav-item ${isActive ? 'active' : ''}`}>
                    <Icon size={16} className="nav-icon" />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && (
                      <span style={{
                        fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '1px 5px', borderRadius: 4,
                        background: badge === 'LIVE' ? 'rgba(5,150,105,0.12)' : 'rgba(2,132,199,0.12)',
                        color: badge === 'LIVE' ? '#059669' : '#0284c7',
                        border: `1px solid ${badge === 'LIVE' ? 'rgba(5,150,105,0.25)' : 'rgba(2,132,199,0.25)'}`,
                      }}>
                        {badge}
                      </span>
                    )}
                    {isActive && <ChevronRight size={12} style={{ color: 'var(--color-primary)', marginLeft: 2 }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button 
            onClick={toggleTheme} 
            className="btn btn-ghost" 
            style={{ width: '100%', justifyContent: 'center', marginBottom: '12px', fontSize: '0.7rem' }}
          >
            {theme === 'light' ? '🌙 Switch to Dark Mode' : '☀️ Switch to Light Mode'}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Shield size={12} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Powered by OpenRouter AI
            </span>
          </div>
          <div style={{
            fontSize: '0.6rem', color: 'var(--color-text-muted)',
            paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)',
          }}>
            v2.0.0 • RailMind AI Platform
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="main-content">
        {children}
      </main>

    </div>
  )
}
