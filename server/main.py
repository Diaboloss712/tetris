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
    def __init__(self, room_id: str, room_name: str, host_id: str, max_players: int = 16, item_mode: bool = False):
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
        self.combos: Dict[str, int] = {}
        self.current_targets: Dict[str, Optional[str]] = {}  # player_id -> target_id
        self.game_tick_task = None  # 서버 게임 틱 태스크
        self.tick_count = 0

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
        self.tick_count = 0
        for player_id in self.players:
            self.games[player_id] = TetrisGame()
            self.players[player_id]["ready"] = False
            self.players[player_id]["game_over"] = False
        
        # 각 플레이어에게 최적의 타겟 할당 (중복 없이)
        self.current_targets.clear()
        for player_id in self.players:
            best_target = self.get_best_target_for_player(player_id)
            self.current_targets[player_id] = best_target
            print(f"🎯 타겟 할당: {self.players[player_id]['name']} -> {self.players.get(best_target, {}).get('name', 'None') if best_target else 'None'}")

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
    
    def get_target_count(self, target_id: str) -> int:
        """특정 플레이어를 타겟으로 하는 플레이어 수 반환"""
        return sum(1 for tid in self.current_targets.values() if tid == target_id)
    
    def get_best_target_for_player(self, player_id: str) -> Optional[str]:
        """플레이어에게 최적의 타겟 반환 (타겟팅 제한 고려)"""
        alive_players = self.get_alive_players()
        # 자신 제외
        possible_targets = [pid for pid in alive_players if pid != player_id]
        
        print(f"🔍 타겟 선택: {self.players[player_id]['name']} - 가능한 대상: {len(possible_targets)}명")
        
        if not possible_targets:
            print(f"  ❌ 타겟 없음")
            return None
        
        # 각 타겟이 받고 있는 타겟팅 수 계산
        target_counts = {pid: self.get_target_count(pid) for pid in possible_targets}
        print(f"  📊 타겟팅 수: {[(self.players[pid]['name'], target_counts[pid]) for pid in possible_targets]}")
        
        # 타겟팅을 2명 미만으로 받고 있는 플레이어만 필터링
        available_targets = [pid for pid in possible_targets if target_counts[pid] < 2]
        
        if not available_targets:
            # 모든 플레이어가 2명 이상에게 타겟팅 받고 있다면, 가장 적게 받는 사람 선택
            min_count = min(target_counts.values())
            available_targets = [pid for pid in possible_targets if target_counts[pid] == min_count]
        
        # 랜덤하게 선택
        import random
        selected = random.choice(available_targets) if available_targets else None
        if selected:
            print(f"  ✅ 선택됨: {self.players[selected]['name']}")
        return selected
    
    def reset_game(self):
        """게임 종료 후 방 상태 초기화"""
        self.game_active = False
        self.tick_count = 0
        if self.game_tick_task:
            self.game_tick_task.cancel()
            self.game_tick_task = None
        self.games.clear()
        self.grids.clear()
        self.scores.clear()
        self.levels.clear()
        self.lines.clear()
        self.combos.clear()
        self.current_targets.clear()
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
                    'lines': self.lines.get(player_id, 0),
                    'combo': self.combos.get(player_id, 0),
                    'game_over': self.players[player_id].get("game_over", False)
                }
        return {
            "players": [{"id": pid, "name": data["name"], "score": self.scores.get(pid, 0), "ready": data["ready"]} 
                       for pid, data in self.players.items()],
            "game_active": self.game_active,
            "game_states": game_states,
            "targeting_info": self.current_targets  # 타겟팅 정보 추가
        }

class LobbyManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.player_rooms: Dict[str, str] = {}  # player_id -> room_id

    def create_room(self, room_name: str, host_id: str, host_name: str, max_players: int = 16, item_mode: bool = False) -> Room:
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

# 게임 틱 루프 함수
async def game_tick_loop(room: Room, connection_manager: ConnectionManager):
    """서버에서 60 FPS로 게임 틱을 전송"""
    try:
        while room.game_active:
            room.tick_count += 1
            
            # 모든 플레이어에게 틱 신호 전송
            await connection_manager.broadcast_to_room(room.room_id, {
                "type": "game_tick",
                "tick": room.tick_count,
                "timestamp": datetime.now().timestamp()
            })
            
            # 60 FPS = 16.67ms per frame
            await asyncio.sleep(0.0167)
    except asyncio.CancelledError:
        print(f"🛑 게임 틱 루프 종료: {room.room_id}")
    except Exception as e:
        print(f"❌ 게임 틱 루프 에러: {e}")

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
                    message.get("max_players", 16),
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
                        # 각 플레이어에게 개별적으로 타겟 정보 전송
                        for player_id in room.players:
                            await manager.send_to_player(player_id, {
                                "type": "game_start",
                                "game_state": room.get_game_state(),
                                "item_mode": room.item_mode,
                                "initial_target": room.current_targets.get(player_id)
                            })
                        
                        # 서버 게임 틱 시작
                        room.game_tick_task = asyncio.create_task(game_tick_loop(room, manager))
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
                    room.combos[client_id] = message.get("combo", 0)
                    
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
                    
                    attacker_name = room.players[client_id]['name']
                    target_name = room.players.get(target_id, {}).get('name', 'Unknown') if target_id else 'All'
                    print(f"⚔️ 공격 메시지 수신: {attacker_name} → {attack_lines}줄 (콤보 {combo}x) → 타겟: {target_name} (ID: {target_id})")
                    
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
            
            elif message["type"] == "switch_target":
                # Player wants to switch target (Tab key)
                room = lobby_manager.get_room_by_player(client_id)
                if room and room.game_active:
                    new_target = room.get_best_target_for_player(client_id)
                    room.current_targets[client_id] = new_target
                    print(f"🔄 타겟 전환: {room.players[client_id]['name']} -> {room.players.get(new_target, {}).get('name', 'None') if new_target else 'None'}")
                    await manager.send_to_player(client_id, {
                        "type": "target_changed",
                        "new_target": new_target
                    })
                    
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
                    
                    # 죽은 플레이어의 타겟 제거
                    if client_id in room.current_targets:
                        del room.current_targets[client_id]
                    
                    # 죽은 플레이어를 타겟으로 하고 있던 사람들에게 새 타겟 재할당
                    for player_id, target_id in list(room.current_targets.items()):
                        if target_id == client_id:
                            new_target = room.get_best_target_for_player(player_id)
                            room.current_targets[player_id] = new_target
                            print(f"🔄 타겟 재할당: {room.players[player_id]['name']} -> {room.players.get(new_target, {}).get('name', 'None') if new_target else 'None'}")
                            # 타겟 변경 알림
                            await manager.send_to_player(player_id, {
                                "type": "target_changed",
                                "new_target": new_target
                            })
                    
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
static_react_dir = Path(__file__).parent / "static-react"
static_react_dir.mkdir(exist_ok=True)

# API endpoints (먼저 정의)
@app.get("/api")
async def api_info():
    return {"message": "Tetris Multiplayer Server"}

@app.get("/v2")
async def serve_react():
    # Green: React 버전
    return FileResponse("server/static-react/index.html")

@app.get("/")
async def serve_vanilla():
    # Blue: 바닐라 JS 버전
    return FileResponse("server/static/index.html")

# Mount static files (라우트 뒤에)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
