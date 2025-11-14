import { useState } from 'react'
import Lobby from './components/Lobby'
import Room from './components/Room'
import Game from './components/Game'
import { useWebSocket } from './hooks/useWebSocket'
import { getWebSocketUrl } from './utils/clientId'

type Screen = 'lobby' | 'room' | 'game'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('lobby')
  const { ws, connected, send } = useWebSocket(getWebSocketUrl())

  return (
    <div className="min-h-screen p-4">
      {currentScreen === 'lobby' && (
        <Lobby 
          onNavigateToRoom={() => setCurrentScreen('room')} 
          onNavigateToGame={() => setCurrentScreen('game')}
          ws={ws}
          connected={connected}
          send={send}
        />
      )}
      {currentScreen === 'room' && (
        <Room 
          onBack={() => setCurrentScreen('lobby')}
          onGameStart={() => setCurrentScreen('game')}
          ws={ws}
          send={send}
        />
      )}
      {currentScreen === 'game' && (
        <Game onBack={() => setCurrentScreen('lobby')} />
      )}
    </div>
  )
}

export default App
