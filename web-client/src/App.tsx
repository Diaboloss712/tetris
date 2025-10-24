import { useState } from 'react'
import Lobby from './components/Lobby'
import Room from './components/Room'
import Game from './components/Game'

type Screen = 'lobby' | 'room' | 'game'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('lobby')

  return (
    <div className="min-h-screen p-4">
      {currentScreen === 'lobby' && (
        <Lobby onNavigate={() => setCurrentScreen('room')} />
      )}
      {currentScreen === 'room' && (
        <Room 
          onBack={() => setCurrentScreen('lobby')}
          onGameStart={() => setCurrentScreen('game')}
        />
      )}
      {currentScreen === 'game' && (
        <Game onBack={() => setCurrentScreen('lobby')} />
      )}
    </div>
  )
}

export default App
