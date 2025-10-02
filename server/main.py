import asyncio
import json
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, List, Optional
import uvicorn
from datetime import datetime
from pathlib import Path
from game import TetrisGame

app = FastAPI()

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Room/Lobby system
class Room:
    def __init__(self, room_id: str, room_name: str, host_id: str, max_players: int = 8, item_mode: bool = False):
        self.room_id = room_id
        self.room_name = room_name
        self.host_id = host_id
        self.max_players = max_players
        self.item_mode = item_mode  # 아이템 모드
        self.players: Dict[str, Dict] = {}
        self.games: Dict[str, TetrisGame] = {}
        self.game_active = False
        self.created_at = datetime.now()
        # 클라이언트 기반 게임 상태 저장
        self.grids: Dict[str, list] = {}
        self.scores: Dict[str, int] = {}
        self.levels: Dict[str, int] = {}
        self.lines: Dict[str, int] = {}

    def add_player(self, player_id: str, name: str) -> bool:
        if len(self.players) >= self.max_players:
            return False
        self.players[player_id] = {"name": name, "ready": False}
        return True

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
            if player_id in self.games:
                del self.games[player_id]
            
            # Transfer host if host left
            if player_id == self.host_id and len(self.players) > 0:
                self.host_id = next(iter(self.players))

    def set_ready(self, player_id: str, ready: bool):
        if player_id in self.players:
            self.players[player_id]["ready"] = ready

    def all_players_ready(self) -> bool:
        if len(self.players) < 1:
            return False
        return all(player["ready"] for player in self.players.values())

    def start_game(self):
        self.game_active = True
        for player_id in self.players:
            self.games[player_id] = TetrisGame()
            self.players[player_id]["ready"] = False
            self.players[player_id]["game_over"] = False

    def get_room_info(self) -> dict:
        return {
            "room_id": self.room_id,
            "room_name": self.room_name,
            "host_id": self.host_id,
            "player_count": len(self.players),
            "max_players": self.max_players,
            "game_active": self.game_active,
            "item_mode": self.item_mode,
            "players": [{"id": pid, "name": data["name"], "ready": data["ready"]} 
                       for pid, data in self.players.items()]
        }
    
    def get_alive_players(self) -> list:
        """게임 중 살아있는 플레이어 목록 반환"""
        return [pid for pid, data in self.players.items() if not data.get("game_over", False)]
    
    def reset_game(self):
        """게임 종료 후 방 상태 초기화"""
        self.game_active = False
        self.games.clear()
        self.grids.clear()
        self.scores.clear()
        self.levels.clear()
        self.lines.clear()
        for player_id in self.players:
            self.players[player_id]["ready"] = False
            self.players[player_id]["game_over"] = False

    def get_game_state(self) -> dict:
        game_states = {}
        # 클라이언트가 보낸 게임 상태 사용
        for player_id in self.players:
            if player_id in self.grids:
                game_states[player_id] = {
                    'grid': self.grids.get(player_id, []),
                    'score': self.scores.get(player_id, 0),
                    'level': self.levels.get(player_id, 1),
                    'lines_cleared': self.lines.get(player_id, 0),
                    'game_over': self.players[player_id].get("game_over", False)
                }
        return {
            "players": [{"id": pid, "name": data["name"], "score": self.scores.get(pid, 0), "ready": data["ready"]} 
                       for pid, data in self.players.items()],
            "game_active": self.game_active,
            "game_states": game_states
        }

class LobbyManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.player_rooms: Dict[str, str] = {}  # player_id -> room_id

    def create_room(self, room_name: str, host_id: str, host_name: str, max_players: int = 8, item_mode: bool = False) -> Room:
        room_id = f"room_{random.randint(1000, 9999)}"
        while room_id in self.rooms:
            room_id = f"room_{random.randint(1000, 9999)}"
        
        room = Room(room_id, room_name, host_id, max_players, item_mode)
        room.add_player(host_id, host_name)
        self.rooms[room_id] = room
        self.player_rooms[host_id] = room_id
        return room

    def join_room(self, room_id: str, player_id: str, player_name: str) -> Optional[Room]:
        if room_id not in self.rooms:
            return None
        
        room = self.rooms[room_id]
        if room.add_player(player_id, player_name):
            self.player_rooms[player_id] = room_id
            return room
        return None

    def leave_room(self, player_id: str):
        if player_id in self.player_rooms:
            room_id = self.player_rooms[player_id]
            if room_id in self.rooms:
                room = self.rooms[room_id]
                room.remove_player(player_id)
                
                # Delete room if empty
                if len(room.players) == 0:
                    del self.rooms[room_id]
            
            del self.player_rooms[player_id]

    def get_room_by_player(self, player_id: str) -> Optional[Room]:
        room_id = self.player_rooms.get(player_id)
        if room_id:
            return self.rooms.get(room_id)
        return None

    def get_available_rooms(self) -> List[dict]:
        return [room.get_room_info() for room in self.rooms.values() 
                if not room.game_active and len(room.players) < room.max_players]

lobby_manager = LobbyManager()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        lobby_manager.leave_room(client_id)

    async def send_to_player(self, player_id: str, message: dict):
        if player_id in self.active_connections:
            try:
                await self.active_connections[player_id].send_json(message)
                if message.get("type") == "receive_attack":
                    print(f"📤 메시지 전송 성공: {player_id} - {message.get('type')} ({message.get('lines')}줄)")
            except Exception as e:
                print(f"❌ 메시지 전송 실패: {player_id} - {e}")
        else:
            print(f"❌ 연결 없음: {player_id} not in active_connections")

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in lobby_manager.rooms:
            room = lobby_manager.rooms[room_id]
            for player_id in room.players:
                await self.send_to_player(player_id, message)

manager = ConnectionManager()

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "list_rooms":
                # Send list of available rooms
                rooms = lobby_manager.get_available_rooms()
                await manager.send_to_player(client_id, {
                    "type": "room_list",
                    "rooms": rooms
                })
                
            elif message["type"] == "create_room":
                # Create a new room
                room = lobby_manager.create_room(
                    message["room_name"],
                    client_id,
                    message["player_name"],
                    message.get("max_players", 4),
                    message.get("item_mode", False)
                )
                await manager.send_to_player(client_id, {
                    "type": "room_joined",
                    "room": room.get_room_info()
                })
                await manager.broadcast_to_room(room.room_id, {
                    "type": "room_update",
                    "room": room.get_room_info()
                })
                
            elif message["type"] == "join_room":
                # Join an existing room
                room = lobby_manager.join_room(
                    message["room_id"],
                    client_id,
                    message["player_name"]
                )
                if room:
                    await manager.send_to_player(client_id, {
                        "type": "room_joined",
                        "room": room.get_room_info()
                    })
                    await manager.broadcast_to_room(room.room_id, {
                        "type": "room_update",
                        "room": room.get_room_info()
                    })
                else:
                    await manager.send_to_player(client_id, {
                        "type": "error",
                        "message": "Failed to join room"
                    })
                    
            elif message["type"] == "leave_room":
                # Leave current room
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    room_id = room.room_id
                    lobby_manager.leave_room(client_id)
                    await manager.send_to_player(client_id, {
                        "type": "room_left"
                    })
                    if room_id in lobby_manager.rooms:
                        await manager.broadcast_to_room(room_id, {
                            "type": "room_update",
                            "room": lobby_manager.rooms[room_id].get_room_info()
                        })
                
            elif message["type"] == "ready":
                # Toggle ready status
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    room.set_ready(client_id, message["ready"])
                    
                    # Start game if all ready
                    if room.all_players_ready() and len(room.players) > 0:
                        room.start_game()
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "game_start",
                            "game_state": room.get_game_state(),
                            "item_mode": room.item_mode
                        })
                    else:
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "room_update",
                            "room": room.get_room_info()
                        })
                
            elif message["type"] == "update_grid":
                # Update player's game state (클라이언트가 보낸 게임 상태 저장)
                room = lobby_manager.get_room_by_player(client_id)
                if room and room.game_active:
                    room.grids[client_id] = message.get("grid", [])
                    room.scores[client_id] = message.get("score", 0)
                    room.levels[client_id] = message.get("level", 1)
                    room.lines[client_id] = message.get("lines", 0)
                    
                    # 모든 플레이어에게 게임 상태 브로드캐스트
                    await manager.broadcast_to_room(room.room_id, {
                        "type": "game_state_update",
                        "game_state": room.get_game_state()
                    })
                    
            elif message["type"] == "attack":
                # Player sends attack to target (타겟팅 시스템)
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    attack_lines = message["lines"]
                    combo = message.get("combo", 0)
                    target_id = message.get("target_id")
                    
                    print(f"⚔️ 공격 메시지 수신: {room.players[client_id]['name']} → {attack_lines}줄, 타겟: {target_id}")
                    
                    # 타겟이 지정되어 있고 유효한 경우
                    if target_id and target_id in room.players and target_id != client_id:
                        print(f"🎯 타겟 공격: {target_id} ({room.players[target_id]['name']})")
                        await manager.send_to_player(target_id, {
                            "type": "receive_attack",
                            "from_player": client_id,
                            "from_name": room.players[client_id]["name"],
                            "lines": attack_lines,
                            "combo": combo
                        })
                        print(f"✅ 공격 메시지 전송 완료 → {target_id}")
                    # 타겟이 없으면 모든 플레이어에게 (기존 방식)
                    else:
                        print(f"📢 전체 공격 (타겟 없음)")
                        for player_id in room.players:
                            if player_id != client_id:
                                print(f"  → {player_id} ({room.players[player_id]['name']})")
                                await manager.send_to_player(player_id, {
                                    "type": "receive_attack",
                                    "from_player": client_id,
                                    "from_name": room.players[client_id]["name"],
                                    "lines": attack_lines,
                                    "combo": combo
                                })
                        print(f"✅ 전체 공격 메시지 전송 완료")
                else:
                    print(f"❌ room not found for player {client_id}")
                    
            elif message["type"] == "item_attack":
                # Player sends item attack to target
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    target_id = message.get("target_id")
                    item_type = message.get("item_type")
                    
                    # 아이템 정화 - 모든 상대방에게
                    if item_type == "item_to_clear":
                        for player_id in room.players:
                            if player_id != client_id:
                                await manager.send_to_player(player_id, {
                                    "type": "item_change",
                                    "from_player": client_id,
                                    "from_name": room.players[client_id]["name"],
                                    "change_type": "to_clear"
                                })
                    
                    # 타겟 변경 - 특정 타겟
                    elif item_type == "redirect_target":
                        if target_id and target_id in room.players and target_id != client_id:
                            # 타겟 리스트에서 랜덤 선택 (자신과 현재 타겟 제외)
                            available_targets = [pid for pid in room.players.keys() 
                                               if pid != target_id and pid != client_id]
                            if available_targets:
                                new_target = random.choice(available_targets)
                                await manager.send_to_player(target_id, {
                                    "type": "target_redirect",
                                    "from_player": client_id,
                                    "from_name": room.players[client_id]["name"],
                                    "new_target": new_target
                                })
                    
                    # 일반 공격 아이템
                    elif target_id and target_id in room.players and target_id != client_id:
                        await manager.send_to_player(target_id, {
                            "type": "item_attack",
                            "from_player": client_id,
                            "from_name": room.players[client_id]["name"],
                            "item_type": item_type
                        })
            
            elif message["type"] == "grid_swap":
                # Player swaps grid with target
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    target_id = message.get("target_id")
                    my_grid = message.get("my_grid")
                    
                    if target_id and target_id in room.players and target_id != client_id:
                        # 타겟에게 내 그리드 전송 (타겟은 이걸 받음)
                        await manager.send_to_player(target_id, {
                            "type": "grid_swap",
                            "from_player": client_id,
                            "from_name": room.players[client_id]["name"],
                            "grid": my_grid
                        })
                        
                        # 타겟에게 그리드 요청 메시지 전송
                        await manager.send_to_player(target_id, {
                            "type": "request_grid",
                            "requester_id": client_id
                        })
                        
                        print(f"🔀 그리드 교환: {room.players[client_id]['name']} ↔ {room.players[target_id]['name']}")
            
            elif message["type"] == "send_grid":
                # 그리드 응답 (맵 교환 완료)
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    target_id = message.get("target_id")
                    my_grid = message.get("my_grid")
                    
                    if target_id and target_id in room.players:
                        await manager.send_to_player(target_id, {
                            "type": "grid_swap",
                            "from_player": client_id,
                            "from_name": room.players[client_id]["name"],
                            "grid": my_grid
                        })
                        print(f"✅ 그리드 응답: {room.players[client_id]['name']} → {room.players[target_id]['name']}")
                        
            elif message["type"] == "game_over":
                # Player lost
                room = lobby_manager.get_room_by_player(client_id)
                if room and room.game_active:
                    # 플레이어를 게임 오버 상태로 표시
                    room.players[client_id]["game_over"] = True
                    
                    # 모든 플레이어에게 알림
                    await manager.broadcast_to_room(room.room_id, {
                        "type": "player_game_over",
                        "player_id": client_id,
                        "player_name": room.players[client_id]["name"]
                    })
                    
                    # 살아있는 플레이어 확인
                    alive_players = room.get_alive_players()
                    
                    if len(alive_players) == 1:
                        # 1명 남음 - 승리!
                        winner_id = alive_players[0]
                        winner_name = room.players[winner_id]["name"]
                        winner_score = room.games[winner_id].score if winner_id in room.games else 0
                        
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "game_end",
                            "winner_id": winner_id,
                            "winner_name": winner_name,
                            "winner_score": winner_score,
                            "reason": "last_survivor"
                        })
                        
                        # 게임 종료 및 초기화
                        room.reset_game()
                        
                        # 방 상태 업데이트 전송
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "room_update",
                            "room": room.get_room_info()
                        })
                        
                    elif len(alive_players) == 0:
                        # 모두 죽음 - 무승부
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "game_end",
                            "winner_id": None,
                            "winner_name": None,
                            "winner_score": 0,
                            "reason": "all_dead"
                        })
                        
                        # 게임 종료 및 초기화
                        room.reset_game()
                        
                        # 방 상태 업데이트 전송
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "room_update",
                            "room": room.get_room_info()
                        })
                    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        # Notify room about player disconnect
        room = lobby_manager.get_room_by_player(client_id)
        if room:
            room_id = room.room_id
            lobby_manager.leave_room(client_id)
            if room_id in lobby_manager.rooms:
                await manager.broadcast_to_room(room_id, {
                    "type": "room_update",
                    "room": lobby_manager.rooms[room_id].get_room_info()
                })

# Static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# API endpoints
@app.get("/api")
async def read_root():
    return {"message": "Tetris Multiplayer Server"}

@app.get("/")
async def serve_index():
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "Tetris Multiplayer Server - Frontend not found. Access /api for API info."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
