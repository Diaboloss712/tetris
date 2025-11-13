// Generate a unique client ID for WebSocket connection
export function generateClientId(): string {
  // Check if we already have a client ID in sessionStorage
  let clientId = sessionStorage.getItem('tetris_client_id')
  
  if (!clientId) {
    // Generate a new client ID
    clientId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem('tetris_client_id', clientId)
  }
  
  return clientId
}

// Get WebSocket URL based on current environment
export function getWebSocketUrl(): string {
  const clientId = generateClientId()
  
  // Check if we're in development (localhost/127.0.0.1 on port 5173)
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  
  if (isDev) {
    // Development: connect directly to backend on port 8000
    return `ws://localhost:8000/ws/${clientId}`
  } else {
    // Production: use same protocol/host (nginx will proxy to backend)
    // Use ws:// for HTTP and wss:// for HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname // Don't include port, nginx handles it
    return `${protocol}//${host}/ws/${clientId}`
  }
}
