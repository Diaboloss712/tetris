import { useEffect, useRef, useState } from 'react'

interface WebSocketHook {
  ws: WebSocket | null
  connected: boolean
  send: (data: any) => void
}

export const useWebSocket = (url: string): WebSocketHook => {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('✅ WebSocket 연결됨')
      setConnected(true)
    }

    ws.onclose = () => {
      console.log('❌ WebSocket 연결 끊김')
      setConnected(false)
    }

    ws.onerror = (error) => {
      console.error('WebSocket 에러:', error)
    }

    return () => {
      ws.close()
    }
  }, [url])

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { ws: wsRef.current, connected, send }
}
