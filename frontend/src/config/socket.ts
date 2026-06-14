import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  autoConnect: true,
})

// Namespace-specific sockets
export const eventsSocket = io(`${SOCKET_URL}/events`, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
})

export const agentsSocket = io(`${SOCKET_URL}/agents`, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
})

export const pulseSocket = io(`${SOCKET_URL}/pulse`, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
})

export const agentGraphSocket = io(`${SOCKET_URL}/agent_graph`, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
})