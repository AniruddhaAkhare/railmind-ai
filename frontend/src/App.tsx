import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import RailwayMap from './pages/RailwayMap'
import DigitalTwin from './pages/DigitalTwin'
import Replay from './pages/Replay'
import AgentNetworkPage from './pages/AgentNetworkPage'
import ExecutiveStoryPage from './pages/ExecutiveStoryPage'

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/agents"       element={<Agents />} />
          <Route path="/agent-graph"  element={<AgentNetworkPage />} />
          <Route path="/map"          element={<RailwayMap />} />
          <Route path="/digital-twin" element={<DigitalTwin />} />
          <Route path="/replay"       element={<Replay />} />
          <Route path="/story"        element={<ExecutiveStoryPage />} />
          <Route path="*"             element={<Dashboard />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}

export default App