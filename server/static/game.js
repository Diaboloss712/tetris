// 테트리스 게임 로직
class TetrisGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.blockSize = 30;
        this.cols = 10;
        this.rows = 20;
        
        // 게임 상태
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.currentPiece = null;
        this.nextPiece = null;
        this.heldPiece = null;
        this.canHold = true;
        this.gameOver = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.fallSpeed = 500;
        this.lastFallTime = 0;
        
        // 공격/방어 시스템
        this.combo = 0;
        this.backToBack = 0;
        this.pendingGarbage = 0;
        this.lastClearWasDifficult = false;
        this.attackSent = 0;
        this.attackReceived = 0;
        
        // 7-bag 시스템
        this.bag = [];
        this.nextBag = [];
        
        // 테트로미노 정의
        this.shapes = [
            [[1,1,1,1]], // I
            [[1,1],[1,1]], // O
            [[1,1,1],[0,1,0]], // T
            [[1,1,1],[1,0,0]], // L
            [[1,1,1],[0,0,1]], // J
            [[0,1,1],[1,1,0]], // S
            [[1,1,0],[0,1,1]]  // Z
        ];
        
        this.colors = [
            '#00ffff', // I - cyan
            '#ffff00', // O - yellow
            '#ff00ff', // T - magenta
            '#ffa500', // L - orange
            '#0000ff', // J - blue
            '#00ff00', // S - green
            '#ff0000'  // Z - red
        ];
        
        this.garbageColor = '#808080';
        
        this.init();
    }
    
    init() {
        this.fillBag();
        this.currentPiece = this.createPiece();
        this.nextPiece = this.createPiece();
        this.drawNextPiece();
        this.drawHeldPiece();
    }
    
    fillBag() {
        // 7-bag 시스템: 7개 블록을 섞어서 사용
        const pieces = [0, 1, 2, 3, 4, 5, 6];
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        this.bag = this.bag.concat(pieces);
    }
    
    createPiece() {
        if (this.bag.length === 0) {
            this.fillBag();
        }
        
        const shapeIndex = this.bag.shift();
        return {
            shape: JSON.parse(JSON.stringify(this.shapes[shapeIndex])),
            color: this.colors[shapeIndex],
            shapeIndex: shapeIndex,
            x: Math.floor(this.cols / 2) - 1,
            y: 0
        };
    }
    
    holdPiece() {
        if (!this.canHold) return;
        
        if (this.heldPiece === null) {
            // 처음 Hold
            this.heldPiece = {
                shapeIndex: this.currentPiece.shapeIndex,
                shape: this.shapes[this.currentPiece.shapeIndex],
                color: this.currentPiece.color
            };
            this.currentPiece = this.nextPiece;
            this.nextPiece = this.createPiece();
        } else {
            // Hold와 교환
            const temp = {
                shapeIndex: this.heldPiece.shapeIndex,
                shape: JSON.parse(JSON.stringify(this.shapes[this.heldPiece.shapeIndex])),
                color: this.heldPiece.color,
                x: Math.floor(this.cols / 2) - 1,
                y: 0
            };
            
            this.heldPiece = {
                shapeIndex: this.currentPiece.shapeIndex,
                shape: this.shapes[this.currentPiece.shapeIndex],
                color: this.currentPiece.color
            };
            
            this.currentPiece = temp;
        }
        
        this.canHold = false;
        this.drawNextPiece();
        this.drawHeldPiece();
    }
    
    validMove(piece, offsetX = 0, offsetY = 0) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + offsetX;
                    const newY = piece.y + y + offsetY;
                    
                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return false;
                    }
                    
                    if (newY >= 0 && this.grid[newY][newX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    rotate(clockwise = true) {
        const oldShape = this.currentPiece.shape;
        
        if (clockwise) {
            // 시계방향: 전치 후 행 반전
            this.currentPiece.shape = this.currentPiece.shape[0].map((_, i) =>
                this.currentPiece.shape.map(row => row[i]).reverse()
            );
        } else {
            // 반시계방향: 전치 후 열 반전
            this.currentPiece.shape = this.currentPiece.shape[0].map((_, i) =>
                this.currentPiece.shape.map(row => row[row.length - 1 - i])
            );
        }
        
        // Wall kick 시도 (SRS - Super Rotation System)
        const wallKickOffsets = [
            [0, 0],   // 기본 위치
            [-1, 0],  // 왼쪽
            [1, 0],   // 오른쪽
            [0, -1],  // 위
            [-1, -1], // 왼쪽 위
            [1, -1],  // 오른쪽 위
        ];
        
        let rotated = false;
        for (const [dx, dy] of wallKickOffsets) {
            if (this.validMove(this.currentPiece, dx, dy)) {
                this.currentPiece.x += dx;
                this.currentPiece.y += dy;
                rotated = true;
                break;
            }
        }
        
        if (!rotated) {
            this.currentPiece.shape = oldShape;
        }
        
        return rotated;
    }
    
    checkTSpin() {
        // T-spin 감지 (T 블록만)
        if (this.currentPiece.shapeIndex !== 2) return { isTSpin: false, isMini: false };
        
        // 4개 코너 중 3개 이상이 막혀있으면 T-spin
        const corners = [
            [this.currentPiece.x - 1, this.currentPiece.y - 1],
            [this.currentPiece.x + 2, this.currentPiece.y - 1],
            [this.currentPiece.x - 1, this.currentPiece.y + 2],
            [this.currentPiece.x + 2, this.currentPiece.y + 2]
        ];
        
        let blockedCorners = 0;
        let frontCornersBlocked = 0;
        
        // 앞쪽 코너 판별 (회전 방향에 따라)
        const frontCorners = this.getFrontCorners();
        
        for (let i = 0; i < corners.length; i++) {
            const [x, y] = corners[i];
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows || 
                (y >= 0 && y < this.rows && this.grid[y][x] !== 0)) {
                blockedCorners++;
                if (frontCorners.includes(i)) {
                    frontCornersBlocked++;
                }
            }
        }
        
        if (blockedCorners >= 3) {
            // 앞쪽 코너 2개 다 막혔으면 정규 T-spin, 아니면 Mini
            return {
                isTSpin: true,
                isMini: frontCornersBlocked < 2
            };
        }
        
        return { isTSpin: false, isMini: false };
    }
    
    getFrontCorners() {
        // T 블록의 회전 상태에 따라 앞쪽 코너 인덱스 반환
        const shapeStr = JSON.stringify(this.currentPiece.shape);
        if (shapeStr === JSON.stringify([[1,1,1],[0,1,0]])) return [0, 1]; // 위
        if (shapeStr === JSON.stringify([[0,1,0],[1,1,1]])) return [2, 3]; // 아래
        if (shapeStr === JSON.stringify([[0,1],[1,1],[0,1]])) return [1, 3]; // 오른쪽
        if (shapeStr === JSON.stringify([[1,0],[1,1],[1,0]])) return [0, 2]; // 왼쪽
        return [0, 1];
    }
    
    checkPerfectClear() {
        // 모든 라인이 비어있는지 확인
        return this.grid.every(row => row.every(cell => cell === 0));
    }
    
    moveLeft() {
        if (this.validMove(this.currentPiece, -1, 0)) {
            this.currentPiece.x--;
        }
    }
    
    moveRight() {
        if (this.validMove(this.currentPiece, 1, 0)) {
            this.currentPiece.x++;
        }
    }
    
    moveDown() {
        if (this.validMove(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
            return true;
        }
        return false;
    }
    
    hardDrop() {
        while (this.validMove(this.currentPiece, 0, 1)) {
        }
        return this.merge();
    }
    
    merge() {
        // T-spin 체크 (블록 고정 전)
        const tSpinResult = this.checkTSpin();
        
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x] && this.currentPiece.y + y >= 0) {
                    this.grid[this.currentPiece.y + y][this.currentPiece.x + x] = this.currentPiece.color;
                }
            }
        }
        
        const attackLines = this.clearLines(tSpinResult);
        
        // 쓰레기 라인 추가
        if (this.pendingGarbage > 0) {
            this.addGarbageLines(this.pendingGarbage);
            this.pendingGarbage = 0;
        }
        
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
        this.drawNextPiece();
        this.canHold = true;  // 새 블록이면 다시 Hold 가능
        
        if (!this.validMove(this.currentPiece)) {
            this.gameOver = true;
        }
        
        return attackLines;
    }
    
    clearLines(tSpinResult = { isTSpin: false, isMini: false }) {
        const linesToClear = [];
        
        for (let y = 0; y < this.rows; y++) {
            if (this.grid[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
            }
        }
        
        const numLines = linesToClear.length;
        
        if (numLines > 0) {
            // 라인 제거
            linesToClear.reverse().forEach(line => {
                this.grid.splice(line, 1);
                this.grid.unshift(Array(this.cols).fill(0));
            });
            
            // Perfect Clear 체크
            const isPerfectClear = this.checkPerfectClear();
            
            // 쓰레기 상쇄
            let effectiveLines = numLines;
            if (this.pendingGarbage > 0) {
                const cancelled = Math.min(this.pendingGarbage, numLines);
                this.pendingGarbage -= cancelled;
                effectiveLines -= cancelled;
            }
            
            // 공격 계산
            let attackLines = 0;
            let isDifficult = false;
            
            if (effectiveLines > 0) {
                // T-spin 보너스
                if (tSpinResult.isTSpin) {
                    if (tSpinResult.isMini) {
                        // Mini T-spin
                        if (effectiveLines === 1) {
                            attackLines = 0;  // Mini T-spin Single (공격 없음)
                        } else if (effectiveLines === 2) {
                            attackLines = 1;  // Mini T-spin Double
                        }
                        isDifficult = false;
                        console.log(`🌀 Mini T-SPIN ${['', 'Single', 'Double'][Math.min(effectiveLines, 2)]}!`);
                    } else {
                        // 정규 T-spin
                        if (effectiveLines === 1) {
                            attackLines = 2;  // T-spin Single
                        } else if (effectiveLines === 2) {
                            attackLines = 4;  // T-spin Double
                        } else if (effectiveLines >= 3) {
                            attackLines = 6;  // T-spin Triple
                        }
                        isDifficult = true;
                        console.log(`🌀 T-SPIN ${['', 'Single', 'Double', 'Triple'][Math.min(effectiveLines, 3)]}!`);
                    }
                    this.combo++;
                } else if (effectiveLines === 1) {
                    attackLines = 0;
                    this.combo++;
                    isDifficult = false;
                } else if (effectiveLines === 2) {
                    attackLines = 1;
                    this.combo++;
                    isDifficult = false;
                } else if (effectiveLines === 3) {
                    attackLines = 2;
                    this.combo++;
                    isDifficult = false;
                } else if (effectiveLines >= 4) {
                    attackLines = 4;
                    this.combo++;
                    isDifficult = true;
                }
                
                // B2B 보너스
                if (isDifficult && this.lastClearWasDifficult) {
                    this.backToBack++;
                    attackLines += 1;
                } else if (!isDifficult) {
                    this.backToBack = 0;
                }
                
                this.lastClearWasDifficult = isDifficult;
                
                // 콤보 보너스
                if (this.combo > 1) {
                    const comboBonus = Math.min(this.combo - 1, 10);
                    attackLines += comboBonus;
                }
                
                // B2B 추가 보너스
                if (this.backToBack > 1) {
                    attackLines += Math.min(Math.floor(this.backToBack / 2), 3);
                }
                
                // Perfect Clear 보너스!
                if (isPerfectClear) {
                    const perfectClearBonus = numLines === 4 ? 10 : 6;
                    attackLines += perfectClearBonus;
                    this.score += 2000 * this.level;
                    console.log(`✨ PERFECT CLEAR! +${perfectClearBonus} 공격!`);
                }
            }
            
            // 점수 업데이트
            this.lines += numLines;
            this.score += [100, 300, 500, 800][Math.min(numLines - 1, 3)] * this.level;
            this.score += attackLines * 50;
            this.level = Math.floor(this.lines / 10) + 1;
            this.fallSpeed = Math.max(50, 500 - (this.level - 1) * 50);
            
            if (attackLines > 0) {
                this.attackSent += attackLines;
            }
            
            this.updateUI();
            return attackLines;
        } else {
            this.combo = 0;
        }
        
        return 0;
    }
    
    addGarbageLines(numLines) {
        this.attackReceived += numLines;
        
        // 위에서 라인 제거
        for (let i = 0; i < numLines; i++) {
            this.grid.shift();
        }
        
        // 아래에 쓰레기 라인 추가
        for (let i = 0; i < numLines; i++) {
            const hole = Math.floor(Math.random() * this.cols);
            const garbageLine = Array(this.cols).fill(this.garbageColor);
            garbageLine[hole] = 0;
            this.grid.push(garbageLine);
        }
        
        // 게임 오버 체크
        if (!this.validMove(this.currentPiece)) {
            this.gameOver = true;
        }
    }
    
    receiveAttack(lines) {
        this.pendingGarbage += lines;
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('attack-sent').textContent = this.attackSent;
        document.getElementById('attack-received').textContent = this.attackReceived;
        
        // 콤보 표시
        const comboDisplay = document.getElementById('combo-display');
        if (this.combo > 1) {
            comboDisplay.style.display = 'block';
            document.getElementById('combo-value').textContent = this.combo;
        } else {
            comboDisplay.style.display = 'none';
        }
        
        // B2B 표시
        const b2bDisplay = document.getElementById('b2b-display');
        if (this.backToBack > 0) {
            b2bDisplay.style.display = 'block';
            document.getElementById('b2b-value').textContent = this.backToBack;
        } else {
            b2bDisplay.style.display = 'none';
        }
        
        // 받을 공격 표시
        const garbageDisplay = document.getElementById('garbage-display');
        if (this.pendingGarbage > 0) {
            garbageDisplay.style.display = 'block';
            document.getElementById('garbage-value').textContent = this.pendingGarbage;
        } else {
            garbageDisplay.style.display = 'none';
        }
    }
    
    getGhostPieceY() {
        // Ghost Piece 위치 계산
        let ghostY = this.currentPiece.y;
        while (this.validMove(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        return ghostY;
    }
    
    draw() {
        // 배경
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 그리드
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x]) {
                    this.ctx.fillStyle = this.grid[y][x];
                    this.ctx.fillRect(
                        x * this.blockSize,
                        y * this.blockSize,
                        this.blockSize,
                        this.blockSize
                    );
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.strokeRect(
                        x * this.blockSize,
                        y * this.blockSize,
                        this.blockSize,
                        this.blockSize
                    );
                }
            }
        }
        
        // Ghost Piece (미리보기)
        if (this.currentPiece && !this.gameOver) {
            const ghostY = this.getGhostPieceY();
            this.ctx.fillStyle = this.currentPiece.color;
            this.ctx.globalAlpha = 0.3;
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                    if (this.currentPiece.shape[y][x]) {
                        this.ctx.fillRect(
                            (this.currentPiece.x + x) * this.blockSize,
                            (ghostY + y) * this.blockSize,
                            this.blockSize,
                            this.blockSize
                        );
                        this.ctx.strokeStyle = '#fff';
                        this.ctx.strokeRect(
                            (this.currentPiece.x + x) * this.blockSize,
                            (ghostY + y) * this.blockSize,
                            this.blockSize,
                            this.blockSize
                        );
                    }
                }
            }
            this.ctx.globalAlpha = 1.0;
        }
        
        // 현재 블록
        if (this.currentPiece && !this.gameOver) {
            this.ctx.fillStyle = this.currentPiece.color;
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                    if (this.currentPiece.shape[y][x]) {
                        this.ctx.fillRect(
                            (this.currentPiece.x + x) * this.blockSize,
                            (this.currentPiece.y + y) * this.blockSize,
                            this.blockSize,
                            this.blockSize
                        );
                        this.ctx.strokeStyle = '#fff';
                        this.ctx.strokeRect(
                            (this.currentPiece.x + x) * this.blockSize,
                            (this.currentPiece.y + y) * this.blockSize,
                            this.blockSize,
                            this.blockSize
                        );
                    }
                }
            }
        }
    }
    
    drawHeldPiece() {
        const canvas = document.getElementById('hold-piece-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.heldPiece) {
            ctx.fillStyle = this.heldPiece.color;
            const offsetX = (canvas.width - this.heldPiece.shape[0].length * 25) / 2;
            const offsetY = (canvas.height - this.heldPiece.shape.length * 25) / 2;
            
            for (let y = 0; y < this.heldPiece.shape.length; y++) {
                for (let x = 0; x < this.heldPiece.shape[y].length; x++) {
                    if (this.heldPiece.shape[y][x]) {
                        ctx.fillRect(
                            offsetX + x * 25,
                            offsetY + y * 25,
                            25,
                            25
                        );
                        ctx.strokeStyle = '#fff';
                        ctx.strokeRect(
                            offsetX + x * 25,
                            offsetY + y * 25,
                            25,
                            25
                        );
                    }
                }
            }
        }
    }
    
    drawNextPiece() {
        const canvas = document.getElementById('next-piece-canvas');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.nextPiece) {
            ctx.fillStyle = this.nextPiece.color;
            const offsetX = (canvas.width - this.nextPiece.shape[0].length * 25) / 2;
            const offsetY = (canvas.height - this.nextPiece.shape.length * 25) / 2;
            
            for (let y = 0; y < this.nextPiece.shape.length; y++) {
                for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                    if (this.nextPiece.shape[y][x]) {
                        ctx.fillRect(
                            offsetX + x * 25,
                            offsetY + y * 25,
                            25,
                            25
                        );
                        ctx.strokeStyle = '#fff';
                        ctx.strokeRect(
                            offsetX + x * 25,
                            offsetY + y * 25,
                            25,
                            25
                        );
                    }
                }
            }
        }
    }
    
    update(timestamp) {
        if (this.gameOver) return;
        
        if (timestamp - this.lastFallTime > this.fallSpeed) {
            if (!this.moveDown()) {
                const attackLines = this.merge();
                if (attackLines > 0 && window.sendAttack) {
                    window.sendAttack(attackLines, this.combo);
                }
            }
            this.lastFallTime = timestamp;
        }
        
        this.draw();
    }
}
