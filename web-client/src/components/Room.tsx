import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'

interface RoomProps {
  onBack: () => void
  onGameStart: () => void
}

export default function Room({ onBack, onGameStart }: RoomProps) {
  const { playerId, currentRoom, setCurrentRoom } = useGameStore()
  const { ws, send } = useWebSocket(`ws://${window.location.hostname}:8000/ws`)
  
  useEffect(() => {
    if (!ws) return

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('📨 메시지 수신 (Room):', data)

      switch (data.type) {
        case 'room_update':
          setCurrentRoom(data.room)
          break

        case 'game_start':
          console.log('🎮 게임 시작!')
          onGameStart()
          break
      }
    }
  }, [ws, setCurrentRoom, onGameStart])

  if (!currentRoom) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-white">방 정보 로딩 중...</p>
    </div>
  }

  const myPlayer = currentRoom.players.find(p => p.id === playerId)
  const isHost = currentRoom.host_id === playerId
  const allReady = currentRoom.players.every(p => p.ready)

  const handleReady = () => {
    send({ type: 'ready' })
  }

  const handleStartGame = () => {
    if (isHost && allReady) {
      send({ type: 'start_game' })
    }
  }

  const handleLeave = () => {
    send({ type: 'leave_room' })
    setCurrentRoom(null)
    onBack()
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="card max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-center mb-6">{currentRoom.room_name}</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            플레이어 목록 ({currentRoom.player_count}/{currentRoom.max_players})
          </h3>
          <div className="space-y-2">
            {currentRoom.players.map((player) => (
              <div key={player.id} className="p-3 bg-gray-100 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{player.name}</span>
                  {player.id === playerId && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">나</span>}
                  {player.id === currentRoom.host_id && <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded">방장</span>}
                </div>
                {player.ready ? (
                  <span className="text-sm text-green-600 font-semibold">✓ 준비 완료</span>
                ) : (
                  <span className="text-sm text-gray-400">대기 중...</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary" onClick={handleLeave}>
            나가기
          </button>
          {!isHost && (
            <button 
              className={`flex-1 ${myPlayer?.ready ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleReady}
            >
              {myPlayer?.ready ? '준비 취소' : '준비'}
            </button>
          )}
          {isHost && (
            <button 
              className="btn-primary flex-1"
              onClick={handleStartGame}
              disabled={!allReady}
            >
              게임 시작 {allReady ? '✓' : '(모두 준비 필요)'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
