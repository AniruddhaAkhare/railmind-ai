import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export function useWebSocket(namespace: string = '') {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    const url = namespace ? `${SOCKET_URL}${namespace}` : SOCKET_URL

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.disconnect()
    }
  }, [namespace])

  return {
    connected,
    socket: socketRef.current as Socket | null,
  }
}