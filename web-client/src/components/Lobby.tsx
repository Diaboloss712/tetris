import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { generateClientId } from '../utils/clientId'

interface LobbyProps {
  onNavigateToRoom: () => void
  onNavigateToGame: () => void
  ws: WebSocket | null
  connected: boolean
  send: (data: any) => void
}

export default function Lobby({ onNavigateToRoom, onNavigateToGame, ws, connected, send }: LobbyProps) {
  const { 
    playerName, 
    setPlayerName, 
    rooms, 
    setRooms, 
    setPlayerId, 
    setCurrentRoom,
    setIsSolo,
    setItemMode,
  } = useGameStore()
  const [name, setName] = useState(playerName)
  const [roomName, setRoomName] = useState('내 방')
  const [roomItemMode, setRoomItemMode] = useState(false)
  const [soloItemMode, setSoloItemMode] = useState(false)

  // Set player ID on mount
  useEffect(() => {
    const clientId = generateClientId()
    setPlayerId(clientId)
    console.log('🆔 클라이언트 ID:', clientId)
  }, [setPlayerId])

  // Request room list when connected
  useEffect(() => {
    if (connected) {
      console.log('✅ WebSocket 연결됨, 방 목록 요청')
      send({ type: 'list_rooms' })
    }
  }, [connected, send])

  useEffect(() => {
    if (!ws) return

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('📨 메시지 수신:', data)

      switch (data.type) {
        case 'room_list':
          setRooms(data.rooms)
          console.log('📋 방 목록:', data.rooms)
          break

        case 'room_joined':
          setCurrentRoom(data.room)
          console.log('✅ 방 입장:', data.room)
          setIsSolo(false)
          setItemMode(!!data.room.item_mode)
          onNavigateToRoom()
          break
      }
    }
  }, [ws, send, setRooms, setCurrentRoom, onNavigateToRoom, setIsSolo, setItemMode])

  const handleCreateRoom = () => {
    if (!name.trim()) {
      alert('이름을 입력하세요')
      return
    }
    setPlayerName(name)
    send({
      type: 'create_room',
      room_name: roomName.trim() || `${name}의 방`,
      player_name: name,
      max_players: 16,
      item_mode: roomItemMode,
    })
  }

  const handleJoinRoom = (roomId: string) => {
    if (!name.trim()) {
      alert('이름을 입력하세요')
      return
    }
    setPlayerName(name)
    send({
      type: 'join_room',
      room_id: roomId,
      player_name: name
    })
  }

  const handleStartSolo = () => {
    if (!name.trim()) {
      alert('이름을 입력하세요')
      return
    }
    setPlayerName(name)
    setIsSolo(true)
    setItemMode(soloItemMode)
    onNavigateToGame()
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="card max-w-2xl w-full">
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
          🎮 테트리스 배틀
        </h1>
        <p className="text-center text-gray-600 mb-8 text-lg">
          친구들과 함께 실시간 대전! (React v2.0)
        </p>

        <div className="mb-4">
          <div className={`text-center text-sm mb-4 ${connected ? 'text-green-600' : 'text-red-600'}`}>
            {connected ? '🟢 서버 연결됨' : '🔴 서버 연결 중...'}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            플레이어 이름
          </label>
          <input
            type="text"
            placeholder="이름을 입력하세요"
            maxLength={15}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="p-3 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">🎮 혼자 하기</span>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={soloItemMode}
                  onChange={(e) => setSoloItemMode(e.target.checked)}
                />
                아이템 모드
              </label>
            </div>
            <button className="btn-secondary w-full" onClick={handleStartSolo}>
              싱글플레이 시작
            </button>
          </div>

          <div className="p-3 border rounded-lg space-y-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">방 이름</label>
              <input
                type="text"
                placeholder="방 이름을 입력하세요"
                maxLength={20}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={roomItemMode}
                onChange={(e) => setRoomItemMode(e.target.checked)}
              />
              아이템 모드 (랜덤 아이템 생성)
            </label>
            <button className="btn-primary w-full" onClick={handleCreateRoom} disabled={!connected}>
              방 만들기
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">방 목록 ({rooms.length}개)</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {rooms.length === 0 ? (
              <p className="text-center text-gray-500 py-8">생성된 방이 없습니다</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.room_id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => handleJoinRoom(room.room_id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{room.room_name}</p>
                      <p className="text-sm text-gray-600">플레이어: {room.player_count}/{room.max_players}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {room.game_active ? '게임 중' : '대기중'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
