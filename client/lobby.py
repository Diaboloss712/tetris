import pygame
import json
import asyncio
import websockets
import sys
import socket
from typing import Optional, List, Dict

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)
GREEN = (0, 200, 0)
RED = (200, 0, 0)
BLUE = (0, 100, 200)
HOVER_BLUE = (0, 150, 255)

class Button:
    def __init__(self, x: int, y: int, width: int, height: int, text: str, color=BLUE, hover_color=HOVER_BLUE):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.hover_color = hover_color
        self.is_hovered = False

    def draw(self, screen, font):
        color = self.hover_color if self.is_hovered else self.color
        pygame.draw.rect(screen, color, self.rect)
        pygame.draw.rect(screen, WHITE, self.rect, 2)
        
        text_surface = font.render(self.text, True, WHITE)
        text_rect = text_surface.get_rect(center=self.rect.center)
        screen.blit(text_surface, text_rect)

    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.is_hovered = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                return True
        return False

class InputBox:
    def __init__(self, x: int, y: int, width: int, height: int, label: str, default_text: str = ""):
        self.rect = pygame.Rect(x, y, width, height)
        self.label = label
        self.text = default_text
        self.active = False
        self.color = GRAY
        self.max_length = 20

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            self.active = self.rect.collidepoint(event.pos)
            self.color = WHITE if self.active else GRAY
        elif event.type == pygame.KEYDOWN and self.active:
            if event.key == pygame.K_BACKSPACE:
                self.text = self.text[:-1]
            elif event.key == pygame.K_RETURN:
                self.active = False
                self.color = GRAY
            elif len(self.text) < self.max_length:
                self.text += event.unicode

    def draw(self, screen, font):
        # Draw label
        label_surface = font.render(self.label, True, WHITE)
        screen.blit(label_surface, (self.rect.x, self.rect.y - 25))
        
        # Draw input box
        pygame.draw.rect(screen, DARK_GRAY, self.rect)
        pygame.draw.rect(screen, self.color, self.rect, 2)
        
        # Draw text
        text_surface = font.render(self.text, True, WHITE)
        screen.blit(text_surface, (self.rect.x + 10, self.rect.y + 8))

def get_local_ip():
    """로컬 IP 주소 자동 감지"""
    try:
        # 외부 연결을 시도해서 로컬 IP 가져오기
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "127.0.0.1"

class LobbyUI:
    def __init__(self, server_url: str = "ws://localhost:8000"):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption('테트리스 멀티플레이어 - 로비')
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont('Arial', 20)
        self.title_font = pygame.font.SysFont('Arial', 36, bold=True)
        self.small_font = pygame.font.SysFont('Arial', 16)
        
        self.server_url = server_url
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.player_id = None
        self.player_name = ""
        self.connected = False
        self.local_ip = get_local_ip()
        
        # UI State
        self.state = "main_menu"  # main_menu, room_list, create_room, in_room, playing
        self.rooms: List[Dict] = []
        self.current_room: Optional[Dict] = None
        
        # UI Components
        self.player_name_input = InputBox(250, 200, 300, 40, "이름 입력:", "플레이어")
        self.room_name_input = InputBox(250, 250, 300, 40, "방 이름:", "내 방")
        
        self.connect_button = Button(300, 280, 200, 50, "연결")
        self.create_room_button = Button(250, 300, 150, 50, "방 만들기")
        self.join_room_button = Button(420, 300, 150, 50, "방 참가")
        self.refresh_button = Button(600, 100, 150, 40, "새로고침")
        self.back_button = Button(50, 50, 100, 40, "뒤로")
        self.start_button = Button(300, 500, 200, 50, "게임 시작")
        self.ready_button = Button(300, 450, 200, 50, "준비")
        self.leave_button = Button(300, 520, 200, 50, "방 나가기")

    async def connect_to_server(self):
        try:
            import random
            self.player_id = f"player_{random.randint(1000, 9999)}"
            self.ws = await websockets.connect(f"{self.server_url}/ws/{self.player_id}")
            self.connected = True
            print(f"Connected to server as {self.player_id}")
            return True
        except Exception as e:
            print(f"Failed to connect to server: {e}")
            return False

    async def send_message(self, message: dict):
        if self.connected and self.ws:
            try:
                await self.ws.send(json.dumps(message))
            except Exception as e:
                print(f"Error sending message: {e}")
                self.connected = False

    async def receive_messages(self):
        while self.connected and self.ws:
            try:
                message = await asyncio.wait_for(self.ws.recv(), timeout=0.01)
                data = json.loads(message)
                await self.handle_server_message(data)
            except asyncio.TimeoutError:
                pass
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed")
                self.connected = False
                break
            except Exception as e:
                print(f"Error receiving message: {e}")
                break

    async def handle_server_message(self, data: dict):
        msg_type = data.get("type")
        
        if msg_type == "room_list":
            self.rooms = data["rooms"]
            
        elif msg_type == "room_joined":
            self.current_room = data["room"]
            self.state = "in_room"
            
        elif msg_type == "room_update":
            self.current_room = data["room"]
            
        elif msg_type == "room_left":
            self.current_room = None
            self.state = "room_list"
            await self.request_room_list()
            
        elif msg_type == "game_start":
            # Launch the actual game
            print("Game starting!")
            await self.launch_game()
            
        elif msg_type == "error":
            print(f"Error: {data['message']}")

    async def request_room_list(self):
        await self.send_message({"type": "list_rooms"})

    async def create_room(self, room_name: str):
        await self.send_message({
            "type": "create_room",
            "room_name": room_name,
            "player_name": self.player_name,
            "max_players": 4
        })

    async def join_room(self, room_id: str):
        await self.send_message({
            "type": "join_room",
            "room_id": room_id,
            "player_name": self.player_name
        })

    async def leave_room(self):
        await self.send_message({"type": "leave_room"})

    async def toggle_ready(self):
        if self.current_room:
            # Find current ready status
            my_player = next((p for p in self.current_room["players"] if p["id"] == self.player_id), None)
            current_ready = my_player["ready"] if my_player else False
            await self.send_message({
                "type": "ready",
                "ready": not current_ready
            })

    async def launch_game(self):
        # Close WebSocket and launch the game
        self.state = "playing"
        if self.ws:
            await self.ws.close()
        
        # Import and run the game
        import subprocess
        import os
        
        # Launch the tetris game with player info
        game_path = os.path.join(os.path.dirname(__file__), "tetris.py")
        subprocess.Popen([sys.executable, game_path, self.player_name])
        
        # Exit lobby
        pygame.quit()
        sys.exit()

    def draw_main_menu(self):
        self.screen.fill(BLACK)
        
        # Title
        title = self.title_font.render("테트리스 멀티플레이어", True, WHITE)
        title_rect = title.get_rect(center=(SCREEN_WIDTH // 2, 80))
        self.screen.blit(title, title_rect)
        
        # 로컬 IP 표시 (같은 공유기 사용자를 위해)
        ip_info = self.small_font.render(f"내 로컬 IP: {self.local_ip}:8000", True, CYAN)
        ip_rect = ip_info.get_rect(center=(SCREEN_WIDTH // 2, 120))
        self.screen.blit(ip_info, ip_rect)
        
        help_text = self.small_font.render("(친구가 같은 공유기에 있다면 이 주소로 접속)", True, GRAY)
        help_rect = help_text.get_rect(center=(SCREEN_WIDTH // 2, 140))
        self.screen.blit(help_text, help_rect)
        
        # Input and button
        self.player_name_input.draw(self.screen, self.font)
        self.connect_button.draw(self.screen, self.font)
        
        # Instructions
        if not self.connected:
            status = self.font.render("이름을 입력하고 연결하세요", True, GRAY)
        else:
            status = self.font.render("연결됨! 옵션을 선택하세요", True, GREEN)
        status_rect = status.get_rect(center=(SCREEN_WIDTH // 2, 170))
        self.screen.blit(status, status_rect)

        if self.connected:
            self.create_room_button.draw(self.screen, self.font)
            self.join_room_button.draw(self.screen, self.font)

    def draw_room_list(self):
        self.screen.fill(BLACK)
        
        # Title
        title = self.title_font.render("AVAILABLE ROOMS", True, WHITE)
        self.screen.blit(title, (50, 50))
        
        self.back_button.draw(self.screen, self.font)
        self.refresh_button.draw(self.screen, self.font)
        
        # Room list
        y = 150
        if not self.rooms:
            no_rooms = self.font.render("No rooms available. Create one!", True, GRAY)
            self.screen.blit(no_rooms, (50, y))
        else:
            for room in self.rooms:
                room_button = Button(50, y, 700, 60, 
                                   f"{room['room_name']} ({room['player_count']}/{room['max_players']})")
                room_button.draw(self.screen, self.font)
                
                # Store button for click handling
                if not hasattr(self, 'room_buttons'):
                    self.room_buttons = {}
                self.room_buttons[room['room_id']] = room_button
                
                y += 70
                if y > 500:
                    break

    def draw_create_room(self):
        self.screen.fill(BLACK)
        
        title = self.title_font.render("CREATE ROOM", True, WHITE)
        self.screen.blit(title, (250, 100))
        
        self.back_button.draw(self.screen, self.font)
        self.room_name_input.draw(self.screen, self.font)
        
        create_button = Button(300, 350, 200, 50, "Create")
        create_button.draw(self.screen, self.font)
        
        if not hasattr(self, 'create_confirm_button'):
            self.create_confirm_button = create_button

    def draw_in_room(self):
        self.screen.fill(BLACK)
        
        if not self.current_room:
            return
        
        # Title
        title = self.title_font.render(f"ROOM: {self.current_room['room_name']}", True, WHITE)
        self.screen.blit(title, (50, 50))
        
        # Room info
        info = self.font.render(
            f"Players: {self.current_room['player_count']}/{self.current_room['max_players']}", 
            True, WHITE
        )
        self.screen.blit(info, (50, 120))
        
        # Player list
        y = 180
        players_title = self.font.render("Players:", True, WHITE)
        self.screen.blit(players_title, (50, y))
        y += 40
        
        for player in self.current_room['players']:
            is_me = player['id'] == self.player_id
            is_host = player['id'] == self.current_room['host_id']
            
            status = "✓" if player['ready'] else "✗"
            host_marker = "👑 " if is_host else ""
            me_marker = " (You)" if is_me else ""
            
            color = GREEN if player['ready'] else WHITE
            player_text = self.font.render(
                f"{status} {host_marker}{player['name']}{me_marker}",
                True, color
            )
            self.screen.blit(player_text, (70, y))
            y += 35
        
        # Buttons
        self.ready_button.draw(self.screen, self.font)
        self.leave_button.draw(self.screen, self.font)
        
        # Show start button only for host
        if self.current_room['host_id'] == self.player_id:
            all_ready = all(p['ready'] for p in self.current_room['players'])
            if all_ready and len(self.current_room['players']) > 0:
                self.start_button.draw(self.screen, self.font)

    async def handle_event(self, event):
        if self.state == "main_menu":
            self.player_name_input.handle_event(event)
            
            if self.connect_button.handle_event(event):
                if not self.connected:
                    self.player_name = self.player_name_input.text
                    if await self.connect_to_server():
                        # Stay in main menu to show options
                        pass
            
            if self.connected:
                if self.create_room_button.handle_event(event):
                    self.state = "create_room"
                elif self.join_room_button.handle_event(event):
                    self.state = "room_list"
                    await self.request_room_list()
        
        elif self.state == "room_list":
            if self.back_button.handle_event(event):
                self.state = "main_menu"
            elif self.refresh_button.handle_event(event):
                await self.request_room_list()
            
            # Handle room selection
            if hasattr(self, 'room_buttons'):
                for room_id, button in self.room_buttons.items():
                    if button.handle_event(event):
                        await self.join_room(room_id)
        
        elif self.state == "create_room":
            self.room_name_input.handle_event(event)
            
            if self.back_button.handle_event(event):
                self.state = "main_menu"
            elif hasattr(self, 'create_confirm_button'):
                if self.create_confirm_button.handle_event(event):
                    room_name = self.room_name_input.text
                    if room_name:
                        await self.create_room(room_name)
        
        elif self.state == "in_room":
            if self.ready_button.handle_event(event):
                await self.toggle_ready()
            elif self.leave_button.handle_event(event):
                await self.leave_room()
            elif self.current_room and self.current_room['host_id'] == self.player_id:
                if self.start_button.handle_event(event):
                    # Host can manually start (though it auto-starts when all ready)
                    await self.toggle_ready()

    async def run(self):
        running = True
        
        while running:
            # Handle events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                await self.handle_event(event)
            
            # Receive messages from server
            if self.connected:
                await self.receive_messages()
            
            # Draw current state
            if self.state == "main_menu":
                self.draw_main_menu()
            elif self.state == "room_list":
                self.draw_room_list()
            elif self.state == "create_room":
                self.draw_create_room()
            elif self.state == "in_room":
                self.draw_in_room()
            
            pygame.display.flip()
            self.clock.tick(60)
            await asyncio.sleep(0.01)
        
        if self.ws:
            await self.ws.close()
        pygame.quit()

if __name__ == "__main__":
    server_url = "ws://localhost:8000"
    if len(sys.argv) > 1:
        server_url = sys.argv[1]
    
    lobby = LobbyUI(server_url)
    asyncio.run(lobby.run())
