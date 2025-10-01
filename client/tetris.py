import pygame
import random
import json
import asyncio
import websockets
import sys
from typing import List, Tuple, Optional, Dict, Any

# Initialize Pygame
pygame.init()

# Constants
BLOCK_SIZE = 30
GRID_WIDTH = 10
GRID_HEIGHT = 20
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
SIDEBAR_WIDTH = 200

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (128, 128, 128)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
CYAN = (0, 255, 255)
MAGENTA = (255, 0, 255)
YELLOW = (255, 255, 0)
ORANGE = (255, 165, 0)

# Tetromino shapes
SHAPES = [
    [[1, 1, 1, 1]],  # I
    [[1, 1], [1, 1]],  # O
    [[1, 1, 1], [0, 1, 0]],  # T
    [[1, 1, 1], [1, 0, 0]],  # L
    [[1, 1, 1], [0, 0, 1]],  # J
    [[0, 1, 1], [1, 1, 0]],  # S
    [[1, 1, 0], [0, 1, 1]],  # Z
]

SHAPE_COLORS = [CYAN, YELLOW, MAGENTA, ORANGE, BLUE, GREEN, RED]

class Tetromino:
    def __init__(self, x: int, y: int, shape_idx: int):
        self.x = x
        self.y = y
        self.shape = SHAPES[shape_idx]
        self.color = SHAPE_COLORS[shape_idx]
        self.rotation = 0

    def rotate(self):
        # Transpose and reverse to rotate 90 degrees clockwise
        self.shape = [list(row) for row in zip(*self.shape[::-1])]

class TetrisGame:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption('멀티플레이어 테트리스')
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont('Arial', 24)
        self.small_font = pygame.font.SysFont('Arial', 18)
        
        self.grid = [[0 for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
        self.current_piece = self.new_piece()
        self.next_piece = self.new_piece()
        self.game_over = False
        self.score = 0
        self.level = 1
        self.lines_cleared = 0
        self.fall_speed = 0.5  # seconds
        self.fall_time = 0
        self.players = {}
        self.player_name = "Player"
        self.player_id = str(random.randint(1000, 9999))
        self.connected = False
        self.ws = None
        self.game_started = False
        
        # 공격/방어 시스템
        self.combo = 0
        self.back_to_back = 0  # T-spin이나 테트리스 연속
        self.pending_garbage = 0  # 받을 예정인 쓰레기 라인
        self.last_clear_was_difficult = False  # 테트리스나 T-spin
        self.attack_sent = 0  # 보낸 공격 수 (통계)
        self.attack_received = 0  # 받은 공격 수 (통계)

    def new_piece(self) -> Tetromino:
        shape_idx = random.randint(0, len(SHAPES) - 1)
        return Tetromino(GRID_WIDTH // 2 - 2, 0, shape_idx)

    def valid_move(self, piece: Tetromino, x_offset: int = 0, y_offset: int = 0) -> bool:
        for y, row in enumerate(piece.shape):
            for x, cell in enumerate(row):
                if cell:
                    new_x = piece.x + x + x_offset
                    new_y = piece.y + y + y_offset
                    
                    if (new_x < 0 or new_x >= GRID_WIDTH or 
                        new_y >= GRID_HEIGHT or 
                        (new_y >= 0 and self.grid[new_y][new_x] != 0)):
                        return False
        return True

    def merge_piece(self):
        for y, row in enumerate(self.current_piece.shape):
            for x, cell in enumerate(row):
                if cell and self.current_piece.y + y >= 0:
                    self.grid[self.current_piece.y + y][self.current_piece.x + x] = self.current_piece.color
        
        # 라인 제거 및 공격 계산
        attack_lines = self.clear_lines()
        
        self.current_piece = self.next_piece
        self.next_piece = self.new_piece()
        
        if not self.valid_move(self.current_piece):
            self.game_over = True
        
        return attack_lines
    
    def add_garbage_lines(self, num_lines: int):
        """쓰레기 라인 추가 (공격 받음)"""
        if num_lines <= 0:
            return
        
        self.attack_received += num_lines
        
        # 맨 위 라인들 제거
        for _ in range(num_lines):
            self.grid.pop(0)
        
        # 맨 아래에 쓰레기 라인 추가 (랜덤한 위치에 한 칸 비움)
        for _ in range(num_lines):
            hole_position = random.randint(0, GRID_WIDTH - 1)
            garbage_line = [GRAY if i != hole_position else 0 for i in range(GRID_WIDTH)]
            self.grid.append(garbage_line)
        
        # 게임 오버 체크 (쓰레기가 현재 블록과 겹치면)
        if not self.valid_move(self.current_piece):
            self.game_over = True

    def clear_lines(self):
        lines_to_clear = []
        for i, row in enumerate(self.grid):
            if all(cell != 0 for cell in row):
                lines_to_clear.append(i)
        
        num_lines = len(lines_to_clear)
        
        if num_lines > 0:
            # 라인 제거
            for line in sorted(lines_to_clear, reverse=True):
                self.grid.pop(line)
                self.grid.insert(0, [0 for _ in range(GRID_WIDTH)])
            
            # 쓰레기 라인 방어 (상쇄)
            if self.pending_garbage > 0:
                cancelled = min(self.pending_garbage, num_lines)
                self.pending_garbage -= cancelled
                num_lines -= cancelled
            
            # 공격 라인 계산
            attack_lines = 0
            if num_lines > 0:
                # 기본 공격: 1줄=0, 2줄=1, 3줄=2, 4줄=4
                if num_lines == 1:
                    attack_lines = 0
                    self.combo += 1
                    self.last_clear_was_difficult = False
                elif num_lines == 2:
                    attack_lines = 1
                    self.combo += 1
                    self.last_clear_was_difficult = False
                elif num_lines == 3:
                    attack_lines = 2
                    self.combo += 1
                    self.last_clear_was_difficult = False
                elif num_lines >= 4:  # 테트리스!
                    attack_lines = 4
                    self.combo += 1
                    if self.last_clear_was_difficult:
                        self.back_to_back += 1
                        attack_lines += 1  # B2B 보너스
                    self.last_clear_was_difficult = True
                
                # 콤보 보너스 (jstris 방식)
                if self.combo > 1:
                    combo_bonus = min(self.combo - 1, 10)  # 최대 10
                    attack_lines += combo_bonus
                
                # B2B 추가 보너스
                if self.back_to_back > 1:
                    attack_lines += min(self.back_to_back // 2, 3)
            
            # 스코어 업데이트
            self.lines_cleared += len(lines_to_clear)
            self.score += [100, 300, 500, 800][min(len(lines_to_clear) - 1, 3)] * self.level
            self.score += attack_lines * 50  # 공격 보너스
            self.level = self.lines_cleared // 10 + 1
            self.fall_speed = max(0.05, 0.5 - (self.level - 1) * 0.05)
            
            # 공격 전송
            if attack_lines > 0:
                self.attack_sent += attack_lines
                return attack_lines
        else:
            # 라인을 못 지우면 콤보 초기화
            self.combo = 0
        
        return 0

    def draw_grid(self):
        # Draw game area border
        pygame.draw.rect(self.screen, WHITE, (0, 0, GRID_WIDTH * BLOCK_SIZE, GRID_HEIGHT * BLOCK_SIZE), 1)
        
        # Draw grid
        for y in range(GRID_HEIGHT):
            for x in range(GRID_WIDTH):
                if self.grid[y][x] != 0:
                    pygame.draw.rect(self.screen, self.grid[y][x], 
                                   (x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE))
                    pygame.draw.rect(self.screen, WHITE, 
                                   (x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE), 1)

    def draw_piece(self, piece: Tetromino, x_offset: int = 0, y_offset: int = 0):
        for y, row in enumerate(piece.shape):
            for x, cell in enumerate(row):
                if cell:
                    pygame.draw.rect(self.screen, piece.color,
                                   ((piece.x + x + x_offset) * BLOCK_SIZE,
                                    (piece.y + y + y_offset) * BLOCK_SIZE,
                                    BLOCK_SIZE, BLOCK_SIZE))
                    pygame.draw.rect(self.screen, WHITE,
                                   ((piece.x + x + x_offset) * BLOCK_SIZE,
                                    (piece.y + y + y_offset) * BLOCK_SIZE,
                                    BLOCK_SIZE, BLOCK_SIZE), 1)

    def draw_sidebar(self):
        # Draw sidebar background
        sidebar_x = GRID_WIDTH * BLOCK_SIZE + 10
        pygame.draw.rect(self.screen, (40, 40, 40), (sidebar_x, 0, SIDEBAR_WIDTH, SCREEN_HEIGHT))
        
        # Draw next piece preview
        next_text = self.font.render("Next:", True, WHITE)
        self.screen.blit(next_text, (sidebar_x + 10, 20))
        
        # Draw next piece
        if hasattr(self, 'next_piece'):
            for y, row in enumerate(self.next_piece.shape):
                for x, cell in enumerate(row):
                    if cell:
                        pygame.draw.rect(self.screen, self.next_piece.color,
                                       (sidebar_x + 30 + x * BLOCK_SIZE,
                                        60 + y * BLOCK_SIZE,
                                        BLOCK_SIZE, BLOCK_SIZE))
        
        # Draw score and level
        score_text = self.font.render(f"점수: {self.score}", True, WHITE)
        level_text = self.font.render(f"레벨: {self.level}", True, WHITE)
        lines_text = self.font.render(f"라인: {self.lines_cleared}", True, WHITE)
        
        self.screen.blit(score_text, (sidebar_x + 10, 150))
        self.screen.blit(level_text, (sidebar_x + 10, 180))
        self.screen.blit(lines_text, (sidebar_x + 10, 210))
        
        # 공격/방어 정보
        y_pos = 250
        
        # 콤보
        if self.combo > 1:
            combo_text = self.font.render(f"콤보: {self.combo}x", True, YELLOW)
            self.screen.blit(combo_text, (sidebar_x + 10, y_pos))
            y_pos += 30
        
        # Back-to-Back
        if self.back_to_back > 0:
            b2b_text = self.small_font.render(f"B2B: {self.back_to_back}", True, CYAN)
            self.screen.blit(b2b_text, (sidebar_x + 10, y_pos))
            y_pos += 25
        
        # 받을 쓰레기 라인 (경고)
        if self.pending_garbage > 0:
            garbage_text = self.font.render(f"받을 공격: {self.pending_garbage}", True, RED)
            self.screen.blit(garbage_text, (sidebar_x + 10, y_pos))
            y_pos += 30
            
            # 쓰레기 라인 시각적 표시
            for i in range(min(self.pending_garbage, 5)):
                pygame.draw.rect(self.screen, RED, 
                               (sidebar_x + 10, y_pos + i * 5, 180, 3))
            y_pos += 30
        
        # 통계
        sent_text = self.small_font.render(f"공격: {self.attack_sent}", True, GREEN)
        received_text = self.small_font.render(f"받음: {self.attack_received}", True, RED)
        self.screen.blit(sent_text, (sidebar_x + 10, y_pos))
        self.screen.blit(received_text, (sidebar_x + 100, y_pos))
        
        # Draw player list
        player_y = 400
        players_text = self.font.render("Players:", True, WHITE)
        self.screen.blit(players_text, (sidebar_x + 10, player_y))
        player_y += 30
        
        for player_id, player in self.players.items():
            player_color = (0, 255, 0) if player_id == self.player_id else WHITE
            player_text = self.font.render(f"{player['name']} ({player.get('score', 0)})", 
                                         True, player_color)
            self.screen.blit(player_text, (sidebar_x + 20, player_y))
            player_y += 25

    async def connect_to_server(self):
        try:
            self.ws = await websockets.connect("ws://localhost:8000/ws/" + self.player_id)
            self.connected = True
            # Send join message
            await self.ws.send(json.dumps({
                "type": "join",
                "name": self.player_name
            }))
            return True
        except Exception as e:
            print(f"Failed to connect to server: {e}")
            return False

    async def send_game_update(self):
        if self.connected and self.ws:
            try:
                await self.ws.send(json.dumps({
                    "type": "update_grid",
                    "grid": self.grid,
                    "score": self.score
                }))
            except Exception as e:
                print(f"게임 업데이트 전송 오류: {e}")
                self.connected = False
    
    async def send_attack(self, lines: int):
        """공격 전송"""
        if self.connected and self.ws and lines > 0:
            try:
                await self.ws.send(json.dumps({
                    "type": "attack",
                    "lines": lines,
                    "combo": self.combo
                }))
                print(f"공격 전송: {lines}줄 (콤보 {self.combo}x)")
            except Exception as e:
                print(f"공격 전송 오류: {e}")
                self.connected = False

    async def handle_network_messages(self):
        while self.connected and self.ws:
            try:
                message = await self.ws.recv()
                data = json.loads(message)
                
                if data["type"] == "game_state_update":
                    self.players = data["data"]
                
                elif data["type"] == "receive_attack":
                    # 공격 받음
                    lines = data["lines"]
                    from_name = data["from_name"]
                    combo = data.get("combo", 0)
                    
                    print(f"{from_name}에게서 {lines}줄 공격 받음! (콤보 {combo}x)")
                    self.pending_garbage += lines
                    
            except websockets.exceptions.ConnectionClosed:
                print("서버 연결이 끊어졌습니다")
                self.connected = False
                break
            except Exception as e:
                print(f"메시지 처리 오류: {e}")
                break

    async def run(self):
        # Connect to server
        if not await self.connect_to_server():
            print("Failed to connect to server. Running in single-player mode.")
        else:
            # Start network message handler in the background
            asyncio.create_task(self.handle_network_messages())
        
        # Main game loop
        last_time = pygame.time.get_ticks()
        
        while not self.game_over:
            current_time = pygame.time.get_ticks()
            delta_time = (current_time - last_time) / 1000.0
            last_time = current_time
            
            # Handle events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    if self.connected and self.ws:
                        await self.ws.close()
                    pygame.quit()
                    return
                
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_LEFT and self.valid_move(self.current_piece, x_offset=-1):
                        self.current_piece.x -= 1
                    elif event.key == pygame.K_RIGHT and self.valid_move(self.current_piece, x_offset=1):
                        self.current_piece.x += 1
                    elif event.key == pygame.K_DOWN and self.valid_move(self.current_piece, y_offset=1):
                        self.current_piece.y += 1
                    elif event.key == pygame.K_UP:
                        # Rotate piece
                        original_shape = self.current_piece.shape
                        self.current_piece.rotate()
                        if not self.valid_move(self.current_piece):
                            self.current_piece.shape = original_shape
                    elif event.key == pygame.K_SPACE:
                        # Hard drop
                        while self.valid_move(self.current_piece, y_offset=1):
                            self.current_piece.y += 1
                        attack_lines = self.merge_piece()
                        
                        # 쓰레기 라인 추가 (블록이 고정된 후)
                        if self.pending_garbage > 0:
                            self.add_garbage_lines(self.pending_garbage)
                            self.pending_garbage = 0
                        
                        if self.connected:
                            await self.send_game_update()
                            if attack_lines > 0:
                                await self.send_attack(attack_lines)
                    elif event.key == pygame.K_r:
                        # Reset game
                        self.__init__()
                        last_time = pygame.time.get_ticks()
            
            # Update game state
            self.fall_time += delta_time
            if self.fall_time >= self.fall_speed:
                self.fall_time = 0
                if self.valid_move(self.current_piece, y_offset=1):
                    self.current_piece.y += 1
                else:
                    attack_lines = self.merge_piece()
                    
                    # 쓰레기 라인 추가 (블록이 고정된 후)
                    if self.pending_garbage > 0:
                        self.add_garbage_lines(self.pending_garbage)
                        self.pending_garbage = 0
                    
                    if self.connected:
                        await self.send_game_update()
                        if attack_lines > 0:
                            await self.send_attack(attack_lines)
            
            # Draw everything
            self.screen.fill(BLACK)
            self.draw_grid()
            self.draw_piece(self.current_piece)
            self.draw_sidebar()
            
            # Draw game over message if needed
            if self.game_over:
                game_over_text = self.font.render("GAME OVER", True, RED)
                restart_text = self.font.render("Press R to restart", True, WHITE)
                self.screen.blit(game_over_text, (GRID_WIDTH * BLOCK_SIZE // 2 - 70, SCREEN_HEIGHT // 2 - 20))
                self.screen.blit(restart_text, (GRID_WIDTH * BLOCK_SIZE // 2 - 80, SCREEN_HEIGHT // 2 + 20))
            
            pygame.display.flip()
            self.clock.tick(60)
            
            # Small delay to prevent high CPU usage
            await asyncio.sleep(0.01)

if __name__ == "__main__":
    game = TetrisGame()
    # Get player name from command line or use default
    if len(sys.argv) > 1:
        game.player_name = sys.argv[1]
    asyncio.run(game.run())
