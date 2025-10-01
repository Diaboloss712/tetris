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
    def __init__(self, room_id: str, room_name: str, host_id: str, max_players: int = 4):
        self.room_id = room_id
        self.room_name = room_name
        self.host_id = host_id
        self.max_players = max_players
        self.players: Dict[str, Dict] = {}
        self.grids: Dict[str, List[List[int]]] = {}
        self.scores: Dict[str, int] = {}
        self.game_active = False
        self.created_at = datetime.now()

    def add_player(self, player_id: str, name: str) -> bool:
        if len(self.players) >= self.max_players:
            return False
        self.players[player_id] = {"name": name, "ready": False}
        self.scores[player_id] = 0
        self.grids[player_id] = [[0 for _ in range(10)] for _ in range(20)]
        return True

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
            del self.scores[player_id]
            del self.grids[player_id]
            
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
            self.scores[player_id] = 0
            self.grids[player_id] = [[0 for _ in range(10)] for _ in range(20)]
            self.players[player_id]["ready"] = False

    def get_room_info(self) -> dict:
        return {
            "room_id": self.room_id,
            "room_name": self.room_name,
            "host_id": self.host_id,
            "player_count": len(self.players),
            "max_players": self.max_players,
            "game_active": self.game_active,
            "players": [{"id": pid, "name": data["name"], "ready": data["ready"]} 
                       for pid, data in self.players.items()]
        }

    def get_game_state(self) -> dict:
        return {
            "players": [{"id": pid, "name": data["name"], "score": self.scores[pid], "ready": data["ready"]} 
                       for pid, data in self.players.items()],
            "game_active": self.game_active,
            "grids": self.grids
        }

class LobbyManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.player_rooms: Dict[str, str] = {}  # player_id -> room_id

    def create_room(self, room_name: str, host_id: str, host_name: str, max_players: int = 4) -> Room:
        room_id = f"room_{random.randint(1000, 9999)}"
        while room_id in self.rooms:
            room_id = f"room_{random.randint(1000, 9999)}"
        
        room = Room(room_id, room_name, host_id, max_players)
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
            except:
                pass

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
                    message.get("max_players", 4)
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
                            "game_state": room.get_game_state()
                        })
                    else:
                        await manager.broadcast_to_room(room.room_id, {
                            "type": "room_update",
                            "room": room.get_room_info()
                        })
                
            elif message["type"] == "update_grid":
                # Update player's game state
                room = lobby_manager.get_room_by_player(client_id)
                if room and client_id in room.grids:
                    room.grids[client_id] = message["grid"]
                    room.scores[client_id] = message["score"]
                    await manager.broadcast_to_room(room.room_id, {
                        "type": "game_state_update",
                        "game_state": room.get_game_state()
                    })
                    
            elif message["type"] == "attack":
                # Player sends attack to opponents
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    attack_lines = message["lines"]
                    combo = message.get("combo", 0)
                    
                    # Send attack to all other players in the room
                    for player_id in room.players:
                        if player_id != client_id:
                            await manager.send_to_player(player_id, {
                                "type": "receive_attack",
                                "from_player": client_id,
                                "from_name": room.players[client_id]["name"],
                                "lines": attack_lines,
                                "combo": combo
                            })
                    
            elif message["type"] == "game_over":
                # Player lost
                room = lobby_manager.get_room_by_player(client_id)
                if room:
                    await manager.broadcast_to_room(room.room_id, {
                        "type": "player_game_over",
                        "player_id": client_id,
                        "player_name": room.players[client_id]["name"]
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
        return FileResponse(index_path)
    return {"message": "Tetris Multiplayer Server - Frontend not found. Access /api for API info."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
