// 테트리스 게임 로직
class TetrisGame {
    constructor(canvasId, autoStart = true) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.blockSize = 30;
        this.cols = 10;
        this.rows = 20;
        this.autoStart = autoStart;
        
        // 게임 상태
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.currentPiece = null;
        this.nextPiece = null;
        this.heldPiece = null;
        this.canHold = true;
        this.gameOver = false;
        this.gameOverSent = false; // 멀티플레이 게임 오버 메시지 전송 여부
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.currentRotation = 0; // 현재 회전 상태 (0, 1, 2, 3)
        
        // 중력 시스템 (jstris/tetr.io 스타일)
        this.gravity = 0.05; // G 단위 (1G = 1칸/프레임)
        this.gravityCounter = 0;
        this.lastFallTime = 0;
        this.frameTime = 1000 / 60; // 60fps
        
        // Lock Delay (바닥 닿은 후 대기 시간)
        this.lockDelay = 500; // 0.5초
        this.lockDelayTimer = 0;
        this.isOnGround = false;
        this.lockResetCount = 0;
        this.maxLockResets = 15; // 최대 15번까지 리셋 가능
        
        // 공격/방어 시스템
        this.combo = 0;
        this.backToBack = 0;
        this.pendingGarbage = 0; // 확정된 공격 (다음 블록 고정 시 적용)
        this.incomingGarbage = 0; // 큐에 대기 중인 공격 (콤보 중)
        this.lastClearWasDifficult = false;
        this.attackSent = 0;
        this.attackReceived = 0;
        
        // 7-bag 시스템
        this.bag = [];
        this.nextBag = [];
        
        // 아이템 시스템
        this.itemMode = false; // 아이템 모드 활성화 여부
        this.currentItem = null; // 현재 보관 중인 아이템 (1개만)
        this.itemSpawnChance = 0.15; // 블록 고정 시 15% 확률로 아이템 생성
        this.attackBoost = 0; // 다음 공격 보너스
        this.ghostMode = false; // 유령 블록 모드
        
        // 테트로미노 정의
        this.shapes = [
            [[1,1,1,1]], // I
            [[1,1],[1,1]], // O
            [[0,1,0],[1,1,1]], // T
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
        
        // 자동 시작이 활성화된 경우에만 게임 루프 시작
        if (this.autoStart) {
            this.startGameLoop();
        }
    }
    
    startGameLoop() {
        const gameLoop = (timestamp) => {
            if (!this.gameOver) {
                this.update(timestamp);
                requestAnimationFrame(gameLoop);
            }
        };
        requestAnimationFrame(gameLoop);
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
            y: 0,
            rotation: 0
        };
    }
    
    holdPiece() {
        // Hold 사용 불가 체크
        if (!this.canHold) {
            console.log('⚠️ Hold는 블록을 고정한 후 사용 가능합니다!');
            return;
        }
        
        if (this.heldPiece === null) {
            // 처음 Hold
            this.heldPiece = {
                shapeIndex: this.currentPiece.shapeIndex,
                shape: this.shapes[this.currentPiece.shapeIndex],
                color: this.currentPiece.color
            };
            this.currentPiece = this.nextPiece;
            this.currentPiece.x = Math.floor(this.cols / 2) - 1;
            this.currentPiece.y = 0;
            this.currentPiece.rotation = 0;
            this.nextPiece = this.createPiece();
        } else {
            // Hold와 교환
            const temp = {
                shapeIndex: this.heldPiece.shapeIndex,
                shape: JSON.parse(JSON.stringify(this.shapes[this.heldPiece.shapeIndex])),
                color: this.heldPiece.color,
                x: Math.floor(this.cols / 2) - 1,
                y: 0,
                rotation: 0
            };
            
            this.heldPiece = {
                shapeIndex: this.currentPiece.shapeIndex,
                shape: this.shapes[this.currentPiece.shapeIndex],
                color: this.currentPiece.color
            };
            
            this.currentPiece = temp;
        }
        
        // 새 블록이 유효한 위치인지 확인
        if (!this.validMove(this.currentPiece)) {
            console.log('💀 Hold 블록 배치 불가 - 게임 오버!');
            this.gameOver = true;
            return;
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
                    
                    // 벽과 바닥 체크
                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return false;
                    }
                    
                    // 유령 모드가 아닐 때만 블록 충돌 체크
                    if (!this.ghostMode && newY >= 0 && this.grid[newY][newX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    isValidPosition(shape, posX, posY) {
        // 회전된 shape + 절대 위치로 직접 검사
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const newX = posX + x;
                    const newY = posY + y;
                    
                    // 벽과 바닥 체크
                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return false;
                    }
                    
                    // 블록 충돌 체크
                    if (newY >= 0 && this.grid[newY][newX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    rotate(clockwise = true) {
        if (!this.currentPiece || this.gameOver) return;
        
        const oldRotation = this.currentPiece.rotation || 0;
        
        // O블록도 rotation 값은 갱신
        if (this.currentPiece.shapeIndex === 1) {
            this.currentPiece.rotation = (oldRotation + (clockwise ? 1 : 3)) % 4;
            return;
        }
        
        // 회전된 shape 계산 (원본은 보존, SRS origin 기준)
        const rotatedShape = this.getRotatedShape(this.currentPiece.shape, clockwise, this.currentPiece.shapeIndex);
        const newRotation = (oldRotation + (clockwise ? 1 : 3)) % 4;
        const dir = clockwise ? 'CW' : 'CCW';
        const tableKey = `${oldRotation}->${newRotation}`;
        
        // SRS Wall Kick 테이블
        const wallKickOffsets = this.getWallKickOffsets(oldRotation, newRotation, this.currentPiece.shapeIndex);
        
        // console.log(`🔄 회전 시도: ${oldRotation}->${newRotation} (${dir}), 블록:${this.currentPiece.shapeIndex}, 위치:(${this.currentPiece.x}, ${this.currentPiece.y})`);
        // console.log(`회전된 shape:`, JSON.stringify(rotatedShape));
        // console.log(`⚙️ 사용 오프셋 키: ${tableKey}, offsets=`, JSON.stringify(wallKickOffsets));
        
        // Wall Kick 시도
        for (let i = 0; i < wallKickOffsets.length; i++) {
            const [dx, dy] = wallKickOffsets[i];
            const testX = this.currentPiece.x + dx;
            const testY = this.currentPiece.y + dy;
            
            // 회전된 shape + 새 위치로 직접 검사
            if (this.isValidPosition(rotatedShape, testX, testY)) {
                // console.log(`  [${i}] offset:[${dx},${dy}] → 위치:(${testX},${testY}) ✅`);
                
                // 성공 → 반영
                this.currentPiece.shape = rotatedShape;
                this.currentPiece.rotation = newRotation;
                this.currentPiece.x = testX;
                this.currentPiece.y = testY;
                
                // 회전 후 바닥 상태 다시 확인
                const wasOnGround = this.isOnGround;
                this.isOnGround = !this.validMove(this.currentPiece, 0, 1);
                if (wasOnGround && this.isOnGround) {
                    this.resetLockDelay();
                } else if (!this.isOnGround) {
                    this.lockDelayTimer = 0;
                    this.lockResetCount = 0;
                }
                
                // if (i > 0) console.log(`✅ Wall Kick 성공!`);
                return;
            } else {
                // 실패 원인 로그
                let reason = '';
                for (let y = 0; y < rotatedShape.length; y++) {
                    for (let x = 0; x < rotatedShape[y].length; x++) {
                        if (rotatedShape[y][x]) {
                            const newX = testX + x;
                            const newY = testY + y;
                            if (newX < 0) reason = '왼쪽 벽';
                            else if (newX >= this.cols) reason = '오른쪽 벽';
                            else if (newY >= this.rows) reason = '바닥';
                            else if (newY >= 0 && this.grid[newY][newX] !== 0) reason = `블록충돌(${newX},${newY})`;
                        }
                    }
                }
                // console.log(`  [${i}] offset:[${dx},${dy}] → 위치:(${testX},${testY}) ❌ (${reason})`);
            }
        }
        
        // console.log(`❌ 모든 Wall Kick 실패! key=${tableKey}, dir=${dir}, shape=${this.currentPiece.shapeIndex}`);
    }
    
    getRotatedShape(shape, clockwise, shapeIdx) {
        // SRS origin 기준 회전
        const isI = shapeIdx === 0;
        const isO = shapeIdx === 1;
        const boxSize = isI || isO ? 4 : 3;
        
        let originX, originY;
        if (isI) { originX = 1.5; originY = 1.5; }
        else if (isO) { originX = 0.5; originY = 0.5; }
        else { originX = 1; originY = 1; }
        
        // 패딩된 SRS 박스 생성 (왼쪽 위 정렬)
        const box = Array.from({ length: boxSize }, () => Array(boxSize).fill(0));
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    if (y < boxSize && x < boxSize) box[y][x] = 1;
                }
            }
        }
        
        // origin 기준 회전
        const rotatedBox = Array.from({ length: boxSize }, () => Array(boxSize).fill(0));
        for (let y = 0; y < boxSize; y++) {
            for (let x = 0; x < boxSize; x++) {
                if (!box[y][x]) continue;
                const relX = x - originX;
                const relY = y - originY;
                
                let rx, ry;
                if (clockwise) { // CW
                    rx = originX - relY;
                    ry = originY + relX;
                } else { // CCW
                    rx = originX + relY;
                    ry = originY - relX;
                }
                const nx = Math.round(rx);
                const ny = Math.round(ry);
                if (ny >= 0 && ny < boxSize && nx >= 0 && nx < boxSize) {
                    rotatedBox[ny][nx] = 1;
                }
            }
        }
        
        // SRS는 고정 박스 크기 유지 (trim 안 함)
        return rotatedBox;
    }
    
    getWallKickOffsets(fromRot, toRot, shapeIdx) {
        // I블록 전용 Wall Kick (표준 SRS: 아래가 +Y)
        if (shapeIdx === 0) {
            const iTable = {
                '0->1': [[0,0], [-2,0], [1,0], [-2,-1], [1,2]],
                '1->0': [[0,0], [2,0], [-1,0], [2,1], [-1,-2]],
                '1->2': [[0,0], [-1,0], [2,0], [-1,2], [2,-1]],
                '2->1': [[0,0], [1,0], [-2,0], [1,-2], [-2,1]],
                '2->3': [[0,0], [2,0], [-1,0], [2,1], [-1,-2]],
                '3->2': [[0,0], [-2,0], [1,0], [-2,-1], [1,2]],
                '3->0': [[0,0], [1,0], [-2,0], [1,-2], [-2,1]],
                '0->3': [[0,0], [-1,0], [2,0], [-1,2], [2,-1]]
            };
            return iTable[`${fromRot}->${toRot}`] || [[0,0]];
        }
        
        // JLSTZ 블록 Wall Kick (표준 SRS: 아래가 +Y)
        const jlstzTable = {
            '0->1': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
            '1->0': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
            '1->2': [[0,0], [1,0], [1,-1], [0,2], [1,2]],
            '2->1': [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
            '2->3': [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
            '3->2': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
            '3->0': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
            '0->3': [[0,0], [1,0], [1,1], [0,-2], [1,-2]]
        };

        let kicks = jlstzTable[`${fromRot}->${toRot}`] || [[0,0]];

        // T-Spin 확장: 표준 킥 실패 시 미러 킥 시도
        if (shapeIdx === 2) {
            const isCW = (toRot === (fromRot + 1) % 4);
            let oppositeKicks;

            if (isCW) {
                // CW 회전 시, CCW의 반대 전이 테이블을 가져옴 (예: 2->3 CW일 때 3->2 CCW 테이블)
                oppositeKicks = jlstzTable[`${toRot}->${fromRot}`] || [[0,0]];
            } else {
                // CCW 회전 시, CW의 반대 전이 테이블을 가져옴 (예: 3->2 CCW일 때 2->3 CW 테이블)
                oppositeKicks = jlstzTable[`${toRot}->${fromRot}`] || [[0,0]];
            }
            
            // dx, dy 부호를 모두 반전시켜 완벽한 미러 킥 생성
            const mirrorKicks = oppositeKicks.slice(1).map(([dx, dy]) => [-dx, -dy]);
            kicks = kicks.concat(mirrorKicks);
        }

        return kicks;
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
        // T 블록의 회전 상태(0,1,2,3)에 따라 앞쪽 코너 인덱스 반환
        switch (this.currentPiece.rotation) {
            case 0: return [0, 1]; // 기본 (위)
            case 1: return [1, 3]; // 오른쪽
            case 2: return [2, 3]; // 아래
            case 3: return [0, 2]; // 왼쪽
            default: return [0, 1];
        }
    }
    
    checkPerfectClear() {
        // 모든 라인이 비어있는지 확인
        return this.grid.every(row => row.every(cell => cell === 0));
    }
    
    moveLeft() {
        if (this.validMove(this.currentPiece, -1, 0)) {
            this.currentPiece.x--;
            // 이동 후 바닥 상태 다시 확인
            const wasOnGround = this.isOnGround;
            this.isOnGround = !this.validMove(this.currentPiece, 0, 1);
            if (wasOnGround && this.isOnGround) {
                this.resetLockDelay();
            }
        }
    }
    
    moveRight() {
        if (this.validMove(this.currentPiece, 1, 0)) {
            this.currentPiece.x++;
            // 이동 후 바닥 상태 다시 확인
            const wasOnGround = this.isOnGround;
            this.isOnGround = !this.validMove(this.currentPiece, 0, 1);
            if (wasOnGround && this.isOnGround) {
                this.resetLockDelay();
            }
        }
    }
    
    getGhostPieceY() {
        // 고스트 피스: 현재 블록이 떨어질 위치의 Y 좌표 계산
        let ghostY = this.currentPiece.y;
        while (this.validMove(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        return ghostY;
    }
    
    moveDown() {
        if (this.validMove(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
            // 한 칸 더 내려갈 수 있는지 확인
            this.isOnGround = !this.validMove(this.currentPiece, 0, 1);
            return true;
        }
        // 더 이상 내려갈 수 없음 - 바닥에 닿음
        this.isOnGround = true;
        return false;
    }
    
    resetLockDelay() {
        // 이동/회전 시 Lock Delay 리셋 (최대 15번)
        // 바닥에 닿아있을 때만 리셋
        if (this.isOnGround && this.lockResetCount < this.maxLockResets) {
            this.lockDelayTimer = 0;
            this.lockResetCount++;
        } else if (!this.isOnGround) {
            // 바닥에서 떨어진 경우 Lock Delay 완전 초기화
            this.lockDelayTimer = 0;
            this.lockResetCount = 0;
        }
    }
    
    hardDrop() {
        while (this.validMove(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
        }
        // 하드드롭은 즉시 고정
        this.isOnGround = false;
        this.lockDelayTimer = 0;
        this.lockResetCount = 0;
        
        const attackLines = this.merge();
        console.log(`🔍 hardDrop merge 완료: attackLines=${attackLines}, sendAttack=${typeof window.sendAttack}`);
        
        if (attackLines > 0) {
            if (window.sendAttack) {
                console.log(`🚀 공격 전송 (하드드롭): ${attackLines}줄`);
                window.sendAttack(attackLines, this.combo);
            } else {
                console.error('❌ window.sendAttack 정의되지 않음!');
            }
        }
        
        return attackLines;
    }
    
    merge() {
        // T-spin 체크 (블록 고정 전)
        const tSpinResult = this.checkTSpin();
        
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const gridY = this.currentPiece.y + y;
                    const gridX = this.currentPiece.x + x;
                    
                    // 그리드 범위 체크
                    if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
                        this.grid[gridY][gridX] = this.currentPiece.color;
                    }
                }
            }
        }
        
        // 블록을 그리드에 병합했으므로 currentPiece 제거
        const mergedPiece = this.currentPiece;
        this.currentPiece = null;
        
        let attackLines = this.clearLines(tSpinResult);
        if (attackLines > 0) {
            console.log(`🎯 clearLines 결과: ${attackLines}줄 공격`);
        }
        
        // 공격 보너스 적용 (아이템)
        if (attackLines > 0 && this.attackBoost > 0) {
            attackLines += this.attackBoost;
            console.log(`⚔️ 공격 강화! +${this.attackBoost}줄 (총 ${attackLines}줄)`);
            this.attackBoost = 0;
        }
        
        // 아이템 생성 (아이템 모드)
        this.generateItem();
        
        // 쓰레기 라인 추가
        if (this.pendingGarbage > 0) {
            this.addGarbageLines(this.pendingGarbage);
            this.pendingGarbage = 0;
        }
        
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
        this.drawNextPiece();
        this.canHold = true;  // 새 블록이면 다시 Hold 가능
        
        // Lock Delay 초기화
        this.isOnGround = false;
        this.lockDelayTimer = 0;
        this.lockResetCount = 0;
        
        if (!this.validMove(this.currentPiece)) {
            console.log('💀 새 블록 배치 불가 - 게임 오버!');
            this.gameOver = true;
        }
        
        // UI 업데이트 (한 번만)
        this.updateUI();
        
        return attackLines;
    }
    
    clearLines(tSpinResult = { isTSpin: false, isMini: false }) {
        const linesToClear = [];
        
        for (let y = 0; y < this.rows; y++) {
            if (this.grid[y].every(cell => cell !== 0 && cell !== null && cell !== undefined)) {
                linesToClear.push(y);
            }
        }
        
        const numLines = linesToClear.length;
        
        if (numLines > 0) {
            console.log(`🎯 clearLines: ${numLines}줄 제거 (줄 번호: ${linesToClear})`);
        }
        
        if (numLines > 0) {
            // 라인 제거: 클리어되지 않은 줄만 유지
            const newGrid = [];
            for (let y = 0; y < this.rows; y++) {
                if (!linesToClear.includes(y)) {
                    newGrid.push(this.grid[y]);
                }
            }
            
            // 제거된 줄 수만큼 위에 빈 줄 추가
            for (let i = 0; i < numLines; i++) {
                newGrid.unshift(Array(this.cols).fill(0));
            }
            
            this.grid = newGrid;
            
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
                
                // 콤보 보너스 (TETR.IO/jstris 기준)
                if (this.combo > 2) {
                    let comboBonus = 0;
                    if (this.combo <= 4) comboBonus = 1;
                    else if (this.combo <= 7) comboBonus = 2;
                    else if (this.combo <= 10) comboBonus = 3;
                    else comboBonus = 4;
                    
                    attackLines += comboBonus;
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
            
            // 중력 증가 (jstris 스타일)
            // 레벨 1: 0.02G, 레벨 10: 0.2G, 레벨 20: 1G
            this.gravity = Math.min(0.02 * this.level, 20);
            
            if (attackLines > 0) {
                this.attackSent += attackLines;
            }
            
            return attackLines;
        } else {
            // 콤보 끊김
            if (this.combo > 0) {
                this.combo = 0;
                // 큐에 대기 중인 공격을 확정 공격으로 이동
                this.pendingGarbage += this.incomingGarbage;
                this.incomingGarbage = 0;
            }
        }
        
        return 0;
    }
    
    addGarbageLines(numLines) {
        console.log(`💥 쓰레기 라인 추가: ${numLines}줄`);
        this.attackReceived += numLines;
        
        // 위에서 라인 제거
        for (let i = 0; i < numLines; i++) {
            this.grid.shift();
        }
        
        // 아래에 쓰레기 라인 추가 (1칸 구멍)
        for (let i = 0; i < numLines; i++) {
            const hole = Math.floor(Math.random() * this.cols);
            const garbageLine = Array(this.cols).fill(this.garbageColor);
            garbageLine[hole] = 0; // 구멍
            this.grid.push(garbageLine);
        }
        
        // 현재 블록 위치 조정 (위로 올림)
        if (this.currentPiece) {
            this.currentPiece.y -= numLines;
        }
        
        // 게임 오버 체크: 맨 위 줄(생명선)에 고정된 블록이 있는지 확인
        if (this.grid[0].some(cell => cell !== 0)) {
            console.log('💀 생명선에 블록이 있어 게임 오버!');
            this.gameOver = true;
        }
        
        this.draw(); // 즉시 화면 업데이트
    }
    
    receiveAttack(lines) {
        console.log(`🎯 공격 받음: ${lines}줄, 콤보: ${this.combo}`);
        // 콤보 중이면 큐에 대기, 아니면 확정 공격
        if (this.combo > 0) {
            this.incomingGarbage += lines;
            console.log(`  → 큐에 대기 (쇁쇄 가능)`);
        } else {
            this.pendingGarbage += lines;
            console.log(`  → 확정 공격 (다음 블록에 추가)`);
        }
        this.updateUI();
    }
    
    // 아이템 생성
    generateItem() {
        if (!this.itemMode || this.currentItem !== null) return;
        
        if (Math.random() < this.itemSpawnChance) {
            const itemTypes = [
                { type: 'swap', name: '🔄 블록 교체', desc: '현재 블록 랜덤 교체', category: 'self' },
                { type: 'clear', name: '🧹 쓰레기 제거', desc: '공격줄 최대 2줄 제거', category: 'self' },
                { type: 'boost', name: '⚔️ 공격 강화', desc: '다음 공격 +1줄', category: 'self' },
                { type: 'ipiece', name: '📏 I블록', desc: '현재 블록을 I로 변경', category: 'self' },
                { type: 'ghost', name: '👻 유령 블록', desc: '블록이 통과 가능', category: 'self' },
                { type: 'random', name: '🎲 랜덤 블록', desc: '상대 블록 교체', category: 'attack' },
                { type: 'destroy', name: '💔 보관 파괴', desc: '상대 Hold 제거', category: 'attack' },
                { type: 'swap_grid', name: '🔀 맵 교체', desc: '상대와 맵 교체 (상대 2줄 제거)', category: 'attack' },
                { type: 'item_to_clear', name: '✨ 아이템 정화', desc: '모든 상대 아이템을 라인제거로 변경', category: 'attack' },
                { type: 'redirect_target', name: '🎯 타겟 변경', desc: '상대의 타겟을 랜덤으로 변경', category: 'attack' }
            ];
            
            const randomItem = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            this.currentItem = randomItem;
            console.log(`✨ 아이템 획득: ${randomItem.name}`);
            this.updateItemsUI();
        }
    }
    
    // 아이템 사용
    useItem() {
        if (!this.itemMode || !this.currentItem) return;
        
        // 블록이 없으면 사용 불가 (merge 중)
        if (!this.currentPiece) {
            console.log('⚠️ 블록 고정 중에는 아이템을 사용할 수 없습니다!');
            return;
        }
        
        const item = this.currentItem;
        console.log(`🎯 아이템 사용: ${item.name}`);
        
        switch(item.type) {
            case 'swap':
                // 현재 블록 교체
                if (this.currentPiece) {
                    this.currentPiece = this.createPiece();
                    this.currentPiece.x = Math.floor(this.cols / 2) - 1;
                    this.currentPiece.y = 0;
                    this.currentPiece.rotation = 0;
                    console.log('🔄 블록이 교체되었습니다!');
                    
                    // 새 블록이 유효한 위치인지 확인
                    if (!this.validMove(this.currentPiece)) {
                        console.log('💀 블록 교체 후 배치 불가 - 게임 오버!');
                        this.gameOver = true;
                    }
                }
                this.currentItem = null;
                this.updateItemsUI();
                break;
                
            case 'clear':
                // 공격 줄 제거
                console.log(`🧹 쓰레기 제거 시도: pending=${this.pendingGarbage}, incoming=${this.incomingGarbage}`);
                const clearAmount = Math.min(2, this.pendingGarbage + this.incomingGarbage);
                
                if (clearAmount > 0) {
                    if (this.pendingGarbage >= clearAmount) {
                        this.pendingGarbage -= clearAmount;
                    } else {
                        const remaining = clearAmount - this.pendingGarbage;
                        this.pendingGarbage = 0;
                        this.incomingGarbage -= remaining;
                    }
                    console.log(`🧹 공격 ${clearAmount}줄 제거 완료! (남은: pending=${this.pendingGarbage}, incoming=${this.incomingGarbage})`);
                } else {
                    console.log('🧹 제거할 공격이 없지만 아이템 소모됨');
                }
                
                this.currentItem = null;
                this.updateUI();
                this.updateItemsUI();
                break;
                
            case 'boost':
                // 다음 공격 강화
                this.attackBoost += 1;
                console.log(`⚔️ 다음 공격 +1줄! (현재 attackBoost: ${this.attackBoost})`);
                this.currentItem = null;
                this.updateItemsUI();
                break;
                
            case 'ipiece':
                // I블록으로 변경
                if (this.currentPiece) {
                    const currentY = this.currentPiece.y;
                    this.currentPiece = {
                        shape: JSON.parse(JSON.stringify(this.shapes[0])),
                        color: this.colors[0],
                        shapeIndex: 0,
                        x: Math.floor(this.cols / 2) - 1,
                        y: currentY,
                        rotation: 0
                    };
                    
                    // 새 블록이 유효한 위치인지 확인
                    if (!this.validMove(this.currentPiece)) {
                        console.log('💀 I블록으로 변경 후 배치 불가 - 게임 오버!');
                        this.gameOver = true;
                    }
                }
                console.log('📏 I블록으로 변경!');
                this.currentItem = null;
                this.updateItemsUI();
                break;
                
            case 'ghost':
                // 유령 블록 활성화
                this.ghostMode = true;
                this.currentItem = null;  // 즉시 아이템 제거
                this.updateItemsUI();
                console.log('👻 유령 블록 활성화! (Alt 다시 눌러 고정)');
                return;
                
            case 'random':
            case 'destroy':
                // 공격형 아이템
                if (window.lobbyManager && window.lobbyManager.isSoloMode) {
                    // 싱글플레이에서는 공격 아이템 사용 불가
                    console.log('⚠️ 싱글플레이에서는 공격 아이템을 사용할 수 없습니다!');
                    return;
                }
                
                // 멀티플레이 - 서버로 전송
                if (window.lobbyManager && window.lobbyManager.currentTarget) {
                    window.lobbyManager.sendItemAttack(item.type);
                    this.currentItem = null;
                    this.updateItemsUI();
                } else {
                    console.log('⚠️ 타겟을 선택해주세요!');
                    return;
                }
                break;
                
            case 'swap_grid':
                // 그리드 교체 아이템
                if (window.lobbyManager && window.lobbyManager.isSoloMode) {
                    console.log('⚠️ 싱글플레이에서는 공격 아이템을 사용할 수 없습니다!');
                    return;
                }
                
                if (window.lobbyManager && window.lobbyManager.currentTarget) {
                    // 서버로 그리드 교체 요청 (상대방 그리드에서 2줄 제거됨)
                    window.lobbyManager.sendGridSwap(this.grid);
                    this.currentItem = null;
                    this.updateItemsUI();
                    console.log('🔀 맵 교체 요청! (상대 맵 2줄 제거 후 교환)');
                } else {
                    console.log('⚠️ 타겟을 선택해주세요!');
                    return;
                }
                break;
                
            case 'item_to_clear':
                // 모든 상대 아이템을 라인 제거로 변경
                if (window.lobbyManager && window.lobbyManager.isSoloMode) {
                    console.log('⚠️ 싱글플레이에서는 공격 아이템을 사용할 수 없습니다!');
                    return;
                }
                
                if (window.lobbyManager) {
                    window.lobbyManager.sendItemAttack(item.type);
                    this.currentItem = null;
                    this.updateItemsUI();
                    console.log('✨ 모든 상대의 아이템을 정화했습니다!');
                } else {
                    console.log('⚠️ 오류가 발생했습니다!');
                    return;
                }
                break;
                
            case 'redirect_target':
                // 타겟의 공격 대상을 랜덤으로 변경
                if (window.lobbyManager && window.lobbyManager.isSoloMode) {
                    console.log('⚠️ 싱글플레이에서는 공격 아이템을 사용할 수 없습니다!');
                    return;
                }
                
                if (window.lobbyManager && window.lobbyManager.currentTarget) {
                    window.lobbyManager.sendItemAttack(item.type);
                    this.currentItem = null;
                    this.updateItemsUI();
                    console.log('🎯 상대의 타겟을 변경했습니다!');
                } else {
                    console.log('⚠️ 타겟을 선택해주세요!');
                    return;
                }
                break;
        }
        
        this.updateItemsUI();
        this.draw();
    }
    
    // 유령 블록 고정
    fixGhostBlock() {
        if (this.ghostMode) {
            this.ghostMode = false;
            
            // 현재 위치에 블록 고정
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                    if (this.currentPiece.shape[y][x]) {
                        const gridY = this.currentPiece.y + y;
                        const gridX = this.currentPiece.x + x;
                        if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
                            // 빈 공간만 채움
                            if (this.grid[gridY][gridX] === 0) {
                                this.grid[gridY][gridX] = this.currentPiece.color;
                            }
                        }
                    }
                }
            }
            
            console.log('👻 유령 블록 고정!');
            
            // 다음 블록으로
            this.currentPiece = this.nextPiece;
            this.currentPiece.x = Math.floor(this.cols / 2) - 1;
            this.currentPiece.y = 0;
            this.currentPiece.rotation = 0;
            this.nextPiece = this.createPiece();
            this.drawNextPiece();
            this.canHold = true;
            
            // 새 블록이 유효한 위치인지 확인
            if (!this.validMove(this.currentPiece)) {
                console.log('💀 유령 블록 고정 후 새 블록 배치 불가 - 게임 오버!');
                this.gameOver = true;
            }
            
            this.updateItemsUI();
            this.draw();
        }
    }
    
    updateItemsUI() {
        const itemsContainer = document.getElementById('items-container');
        if (!itemsContainer || !this.itemMode) return;
        
        itemsContainer.innerHTML = '';
        
        if (this.currentItem) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-box';
            itemDiv.innerHTML = `
                <div class="item-icon">${this.currentItem.name}</div>
                <div class="item-key">Alt</div>
            `;
            itemDiv.onclick = () => this.useItem();
            itemsContainer.appendChild(itemDiv);
        }
    }
    
    // 공격 아이템 받기
    receiveItemAttack(itemType) {
        switch(itemType) {
            case 'random':
                // 현재 블록 제거하고 다음 블록을 현재로 (순서 유지)
                if (this.currentPiece) {
                    this.currentPiece = this.nextPiece;
                    this.currentPiece.x = Math.floor(this.cols / 2) - 1;
                    this.currentPiece.y = 0;
                    this.currentPiece.rotation = 0;
                    this.nextPiece = this.createPiece();
                    this.drawNextPiece();
                    // Lock Delay 초기화
                    this.isOnGround = false;
                    this.lockDelayTimer = 0;
                    this.lockResetCount = 0;
                    console.log('🎲 상대가 블록을 교체했습니다! (현재 블록 사라짐)');
                    
                    // 새 블록이 유효한 위치인지 확인
                    if (!this.validMove(this.currentPiece)) {
                        console.log('💀 블록 교체 후 배치 불가 - 게임 오버!');
                        this.gameOver = true;
                    }
                }
                break;
                
            case 'destroy':
                // Hold 블록 제거
                if (this.heldPiece) {
                    this.heldPiece = null;
                    this.drawHeldPiece();
                    console.log('💔 Hold 블록이 파괴되었습니다!');
                }
                break;
        }
        
        this.draw();
    }
    
    // 그리드 교체 받기
    receiveGridSwap(newGrid) {
        // 그리드 유효성 검증
        if (!newGrid || !Array.isArray(newGrid) || newGrid.length !== this.rows) {
            console.error('❌ 잘못된 그리드 데이터:', newGrid);
            return;
        }
        
        // 각 행의 길이 검증
        for (let row of newGrid) {
            if (!Array.isArray(row) || row.length !== this.cols) {
                console.error('❌ 잘못된 그리드 행 길이:', row);
                return;
            }
        }
        
        if (true) {
            // 상대 그리드로 교체 후 하단 2줄 제거 (자동으로 내려감)
            const cleanedGrid = JSON.parse(JSON.stringify(newGrid));
            
            // 하단 2줄 제거 (splice로 제거만 하면 자동으로 위 블록들이 내려옴)
            cleanedGrid.splice(this.rows - 2, 2);
            
            // 상단에 빈 줄 2개 추가 (총 20줄 유지)
            cleanedGrid.unshift(Array(this.cols).fill(0));
            cleanedGrid.unshift(Array(this.cols).fill(0));
            
            this.grid = cleanedGrid;
            console.log('🔀 상대와 맵이 교체되었습니다! (하단 2줄 제거)');
            
            // 현재 블록을 새로 생성 (공정한 플레이)
            if (this.currentPiece) {
                this.currentPiece = this.createPiece();
                console.log('🔀 새 블록 생성');
                
                // 새 블록이 유효한 위치인지 확인
                if (!this.validMove(this.currentPiece)) {
                    console.log('💀 그리드 교체 후 블록 배치 불가 - 게임 오버!');
                    this.gameOver = true;
                }
            }
            
            this.draw();
        }
    }
    
    // 아이템 변경 받기
    receiveItemChange(changeType) {
        if (!this.currentItem) return;
        
        switch(changeType) {
            case 'to_clear':
                // 현재 아이템을 라인 제거로 변경
                this.currentItem = {
                    type: 'clear',
                    name: '🧹 쓰레기 제거',
                    desc: '공격줄 최대 2줄 제거',
                    category: 'self'
                };
                console.log('✨ 아이템이 라인 제거로 변경되었습니다!');
                this.updateItemsUI();
                break;
        }
    }
    
    // 타겟 변경 받기
    receiveTargetRedirect(newTargetId) {
        if (window.lobbyManager && !window.lobbyManager.isSoloMode) {
            window.lobbyManager.currentTarget = newTargetId;
            window.lobbyManager.updateGamePlayersList();
            console.log('🎯 타겟이 변경되었습니다!');
        }
    }
    
    updateUI() {
        try {
            const scoreEl = document.getElementById('score');
            const levelEl = document.getElementById('level');
            const linesEl = document.getElementById('lines');
            
            if (scoreEl) scoreEl.textContent = this.score;
            if (levelEl) levelEl.textContent = this.level;
            if (linesEl) linesEl.textContent = this.lines;
            
            // 콤보 표시
            const comboDisplay = document.getElementById('combo-display');
            const comboValue = document.getElementById('combo-value');
            if (comboDisplay && comboValue) {
                if (this.combo > 1) {
                    comboDisplay.style.display = 'block';
                    comboValue.textContent = this.combo;
                } else {
                    comboDisplay.style.display = 'none';
                }
            }
            
            // B2B 표시
            const b2bDisplay = document.getElementById('b2b-display');
            const b2bValue = document.getElementById('b2b-value');
            if (b2bDisplay && b2bValue) {
                if (this.backToBack > 0) {
                    b2bDisplay.style.display = 'block';
                    b2bValue.textContent = this.backToBack;
                } else {
                    b2bDisplay.style.display = 'none';
                }
            }
            
            // 쓰레기 표시 (확정 공격 + 큐 대기 분리)
            const garbageDisplay = document.getElementById('garbage-display');
            const pendingGarbage = document.getElementById('pending-garbage');
            const incomingGarbage = document.getElementById('incoming-garbage');
            
            if (garbageDisplay && pendingGarbage && incomingGarbage) {
                const totalGarbage = this.pendingGarbage + this.incomingGarbage;
                
                if (totalGarbage > 0) {
                    garbageDisplay.style.display = 'block';
                    pendingGarbage.textContent = this.pendingGarbage;
                    incomingGarbage.textContent = this.incomingGarbage;
                } else {
                    garbageDisplay.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('updateUI 에러:', error);
        }
    }
    
    getGhostY() {
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
        
        const deltaTime = timestamp - this.lastFallTime;
        
        // 중력 시스템 (jstris/tetr.io 스타일)
        if (deltaTime > this.frameTime) {
            this.gravityCounter += this.gravity;
            
            // 1칸 이상 내려가야 할 때
            while (this.gravityCounter >= 1) {
                this.gravityCounter -= 1;
                if (!this.moveDown()) {
                    // 바닥에 닿음 - Lock Delay 시작
                    this.gravityCounter = 0;
                    break;
                }
            }
            
            // Lock Delay 처리
            if (this.isOnGround) {
                this.lockDelayTimer += deltaTime;
                
                if (this.lockDelayTimer >= this.lockDelay || this.lockResetCount >= this.maxLockResets) {
                    // 블록 고정
                    const attackLines = this.merge();
                    console.log(`🔍 merge 완료: attackLines=${attackLines}, sendAttack=${typeof window.sendAttack}, combo=${this.combo}`);
                    
                    if (attackLines > 0) {
                        if (window.sendAttack) {
                            console.log(`🚀 공격 전송: ${attackLines}줄`);
                            window.sendAttack(attackLines, this.combo);
                        } else {
                            console.error('❌ window.sendAttack 정의되지 않음!');
                        }
                    }
                    
                    // Lock Delay 리셋
                    this.lockDelayTimer = 0;
                    this.lockResetCount = 0;
                    this.isOnGround = false;
                }
            }
            
            this.lastFallTime = timestamp;
        }
        
        this.draw();
    }
}

// TetrisGame을 전역으로 노출
window.TetrisGame = TetrisGame;
