import { create } from 'zustand'

interface Player {
  id: string
  name: string
  ready: boolean
}

interface Room {
  room_id: string
  room_name: string
  host_id: string
  player_count: number
  max_players: number
  game_active: boolean
  players: Player[]
}

interface GameStore {
  playerId: string | null
  playerName: string
  currentRoom: Room | null
  rooms: Room[]
  currentTarget: string | null
  isSolo: boolean
  itemMode: boolean
  
  setPlayerId: (id: string) => void
  setPlayerName: (name: string) => void
  setCurrentRoom: (room: Room | null) => void
  setRooms: (rooms: Room[]) => void
  setCurrentTarget: (target: string | null) => void
  setIsSolo: (isSolo: boolean) => void
  setItemMode: (itemMode: boolean) => void
}

export const useGameStore = create<GameStore>((set) => ({
  playerId: null,
  playerName: '플레이어',
  currentRoom: null,
  rooms: [],
  currentTarget: null,
  isSolo: false,
  itemMode: false,
  
  setPlayerId: (id) => set({ playerId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setRooms: (rooms) => set({ rooms }),
  setCurrentTarget: (target) => set({ currentTarget: target }),
  setIsSolo: (isSolo) => set({ isSolo }),
  setItemMode: (itemMode) => set({ itemMode }),
}))
