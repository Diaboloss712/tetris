import random

class TetrisGame:
    def __init__(self, rows=20, cols=10):
        self.rows = rows
        self.cols = cols
        self.grid = [[0 for _ in range(cols)] for _ in range(rows)]
        self.current_piece = None
        self.next_piece = None
        self.game_over = False
        self.score = 0
        self.lines_cleared = 0
        self.level = 1
        self.held_piece = None
        self.can_hold = True

        self.shapes = [
            [[1, 1, 1, 1]],  # I
            [[1, 1], [1, 1]],  # O
            [[0, 1, 0], [1, 1, 1]],  # T
            [[1, 1, 1], [1, 0, 0]],  # L
            [[1, 1, 1], [0, 0, 1]],  # J
            [[0, 1, 1], [1, 1, 0]],  # S
            [[1, 1, 0], [0, 1, 1]],  # Z
        ]

        self.colors = [
            '#00ffff', '#ffff00', '#ff00ff', '#ff9900', '#0000ff', '#00ff00', '#ff0000'
        ]

        self.bag = []
        self.fill_bag()
        self.spawn_piece()

    def fill_bag(self):
        pieces = list(range(len(self.shapes)))
        random.shuffle(pieces)
        self.bag.extend(pieces)

    def spawn_piece(self):
        if not self.bag:
            self.fill_bag()
        
        shape_index = self.bag.pop(0)
        shape = self.shapes[shape_index]
        
        self.current_piece = {
            'shape': shape,
            'color': self.colors[shape_index],
            'shape_index': shape_index,
            'x': self.cols // 2 - len(shape[0]) // 2,
            'y': 0,
            'rotation': 0
        }

        if not self.is_valid_position(self.current_piece['shape'], self.current_piece['x'], self.current_piece['y']):
            self.game_over = True

        if not self.bag:
            self.fill_bag()
        
        next_shape_index = self.bag[0]
        self.next_piece = {
            'shape': self.shapes[next_shape_index],
            'color': self.colors[next_shape_index],
            'shape_index': next_shape_index
        }

    def is_valid_position(self, shape, x, y):
        for row_idx, row in enumerate(shape):
            for col_idx, cell in enumerate(row):
                if cell:
                    new_x = x + col_idx
                    new_y = y + row_idx
                    if not (0 <= new_x < self.cols and 0 <= new_y < self.rows and self.grid[new_y][new_x] == 0):
                        return False
    def move_left(self):
        if self.is_valid_position(self.current_piece['shape'], self.current_piece['x'] - 1, self.current_piece['y']):
            self.current_piece['x'] -= 1

    def move_right(self):
        if self.is_valid_position(self.current_piece['shape'], self.current_piece['x'] + 1, self.current_piece['y']):
            self.current_piece['x'] += 1

    def move_down(self):
        if self.is_valid_position(self.current_piece['shape'], self.current_piece['x'], self.current_piece['y'] + 1):
            self.current_piece['y'] += 1
            return True
        else:
            self.merge()
            return False

    def hard_drop(self):
        while self.is_valid_position(self.current_piece['shape'], self.current_piece['x'], self.current_piece['y'] + 1):
            self.current_piece['y'] += 1
    def merge(self):
        shape = self.current_piece['shape']
        x, y = self.current_piece['x'], self.current_piece['y']
        for row_idx, row in enumerate(shape):
            for col_idx, cell in enumerate(row):
                if cell:
                    self.grid[y + row_idx][x + col_idx] = self.current_piece['shape_index'] + 1
        self.clear_lines()

    def clear_lines(self):
        lines_cleared = 0
        y = self.rows - 1
        while y >= 0:
            if all(cell != 0 for cell in self.grid[y]):
                lines_cleared += 1
                del self.grid[y]
                self.grid.insert(0, [0 for _ in range(self.cols)])
            else:
                y -= 1
        
        # 점수 계산 (간단한 버전, 추후 T-Spin, B2B 등 추가)
        if lines_cleared > 0:
            self.lines_cleared += lines_cleared
            base_score = {1: 100, 2: 300, 3: 500, 4: 800}
            self.score += base_score.get(lines_cleared, 0) * self.level

    def rotate(self, clockwise=True):
        shape = self.current_piece['shape']
        rotated_shape = self.get_rotated_shape(shape, clockwise)
        
        if self.is_valid_position(rotated_shape, self.current_piece['x'], self.current_piece['y']):
            self.current_piece['shape'] = rotated_shape
            self.current_piece['rotation'] = (self.current_piece['rotation'] + (1 if clockwise else -1) + 4) % 4
            return

        # Wall Kick
        kicks = self.get_wall_kick_offsets(self.current_piece['rotation'], (self.current_piece['rotation'] + (1 if clockwise else -1) + 4) % 4)
        for dx, dy in kicks:
            if self.is_valid_position(rotated_shape, self.current_piece['x'] + dx, self.current_piece['y'] + dy):
                self.current_piece['x'] += dx
                self.current_piece['y'] += dy
                self.current_piece['shape'] = rotated_shape
                self.current_piece['rotation'] = (self.current_piece['rotation'] + (1 if clockwise else -1) + 4) % 4
                return

    def get_rotated_shape(self, shape, clockwise):
        # 로테이션 로직 (간단한 버전)
        if clockwise:
            return [list(row) for row in zip(*shape[::-1])]
        else:
            return [list(row) for row in zip(*shape)][::-1]

    def get_wall_kick_offsets(self, from_rot, to_rot):
        # SRS Wall Kick 데이터 (J, L, S, T, Z 블록)
        jlstz_kicks = {
            (0, 1): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
            (1, 0): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
            (1, 2): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
            (2, 1): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
            (2, 3): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
            (3, 2): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
            (3, 0): [(0, 0), (-1, 0), (-1, -1), (0, 2), [-1, 2]],
            (0, 3): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        }
        return jlstz_kicks.get((from_rot, to_rot), [(0, 0)])

    def hold_piece(self):
        if not hasattr(self, 'can_hold') or not self.can_hold:
            return

        if not hasattr(self, 'held_piece') or self.held_piece is None:
            self.held_piece = {
                'shape_index': self.current_piece['shape_index'],
                'shape': self.shapes[self.current_piece['shape_index']],
                'color': self.colors[self.current_piece['shape_index']]
            }
            self.spawn_piece()
        else:
            held = self.held_piece
            self.held_piece = {
                'shape_index': self.current_piece['shape_index'],
                'shape': self.shapes[self.current_piece['shape_index']],
                'color': self.colors[self.current_piece['shape_index']]
            }
            self.current_piece = {
                'shape': self.shapes[held['shape_index']],
                'color': self.colors[held['shape_index']],
                'shape_index': held['shape_index'],
                'x': self.cols // 2 - len(self.shapes[held['shape_index']][0]) // 2,
                'y': 0,
                'rotation': 0
            }
        
        self.can_hold = False
