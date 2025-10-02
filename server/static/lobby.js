// 로비 및 네트워크 로직
class LobbyManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = '';
        this.currentRoom = null;
        this.rooms = [];
        this.connected = false;
        this.colors = ['#00ffff', '#ffff00', '#ff00ff', '#ff9900', '#0000ff', '#00ff00', '#ff0000'];

        // 타겟팅 시스템
        this.currentTarget = null;
        this.availableTargets = [];
        
        // 싱글플레이 모드
        this.isSoloMode = false;
        this.soloItemMode = false;

        // DAS/ARR for smooth movement
        this.dasDelay = 160; // ms
        this.arrRate = 30; // ms
        this.dasTimeout = null;
        this.arrInterval = null;
        this.keysDown = {};
        
        this.initElements();
        this.initEventListeners();
        this.connect();
    }
    
    initElements() {
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.roomScreen = document.getElementById('room-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.connectionStatus = document.getElementById('connection-status');
        this.roomsList = document.getElementById('rooms-list');
        this.playersList = document.getElementById('players-list');
    }
    
    initEventListeners() {
        document.getElementById('solo-play-btn').onclick = () => this.showSoloPlayModal();
        document.getElementById('confirm-solo-play').onclick = () => this.startSoloPlay();
        document.getElementById('cancel-solo-play').onclick = () => this.hideSoloPlayModal();
        document.getElementById('create-room-btn').onclick = () => this.showCreateRoomModal();
        document.getElementById('refresh-rooms-btn').onclick = () => this.requestRoomList();
        document.getElementById('confirm-create-room').onclick = () => this.createRoom();
        document.getElementById('cancel-create-room').onclick = () => this.hideCreateRoomModal();
        document.getElementById('ready-btn').onclick = () => this.toggleReady();
        document.getElementById('leave-room-btn').onclick = () => this.leaveRoom();
        document.getElementById('return-lobby-btn').onclick = () => this.returnToLobby();
        document.getElementById('restart-game-btn').onclick = () => this.restartGame();
    }
    
    connect() {
        this.playerId = 'player_' + Math.floor(Math.random() * 10000);
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.playerId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.connected = true;
            this.connectionStatus.textContent = '✅ 연결됨';
            this.connectionStatus.classList.add('connected');
            this.requestRoomList();
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.connectionStatus.textContent = '❌ 연결 끊김';
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('error');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.connectionStatus.textContent = '❌ 연결 오류';
            this.connectionStatus.classList.add('error');
        };
    }
    
    send(message) {
        if (this.connected && this.ws) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    handleMessage(data) {
        console.log('Received:', data);
        
        switch(data.type) {
            case 'room_list':
                this.updateRoomsList(data.rooms);
                break;
            case 'room_joined':
                this.currentRoom = data.room;
                this.showRoomScreen();
                break;
            case 'room_update':
                this.currentRoom = data.room;
                this.updateRoomUI();
                break;
            case 'room_left':
                this.currentRoom = null;
                this.showLobbyScreen();
                this.requestRoomList();
                break;
            case 'game_start':
                this.startGame(data.game_state, data.item_mode);
                break;
            case 'game_state_update':
                if (this.currentRoom && !this.isSoloMode) {
                    this.updateAllGames(data.game_state);
                }
                break;
            case 'receive_attack':
                if (window.game) {
                    window.game.receiveAttack(data.lines);
                    this.showAttackNotification(data.from_name, data.lines);
                    console.log(`공격 받음: ${data.from_name}에게서 ${data.lines}줄!`);
                }
                break;
            case 'player_game_over':
                this.updateGamePlayersList();
                break;
            case 'item_attack':
                if (window.game) {
                    window.game.receiveItemAttack(data.item_type);
                    console.log(`아이템 공격 받음: ${data.from_name} → ${data.item_type}`);
                }
                break;
            case 'grid_swap':
                if (window.game) {
                    window.game.receiveGridSwap(data.grid);
                    console.log(`그리드 교체: ${data.from_name}`);
                }
                break;
            case 'item_change':
                if (window.game) {
                    window.game.receiveItemChange(data.change_type);
                    console.log(`아이템 변경: ${data.from_name} (${data.change_type})`);
                }
                break;
            case 'target_redirect':
                if (window.game) {
                    window.game.receiveTargetRedirect(data.new_target);
                    console.log(`타겟 변경됨: ${data.from_name}`);
                }
                break;
        }
    }
    
    requestRoomList() {
        this.send({ type: 'list_rooms' });
    }
    
    updateRoomsList(rooms) {
        this.rooms = rooms;
        
        if (rooms.length === 0) {
            this.roomsList.innerHTML = '<p class="empty-message">사용 가능한 방이 없습니다. 새로 만들어보세요!</p>';
            return;
        }
        
        this.roomsList.innerHTML = '';
        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.innerHTML = `
                <div class="room-info-text">
                    <div class="room-name">${room.room_name}</div>
                    <div class="room-players">${room.player_count}/${room.max_players} 플레이어</div>
                </div>
            `;
            roomItem.onclick = () => this.joinRoom(room.room_id);
            this.roomsList.appendChild(roomItem);
        });
    }
    
    showSoloPlayModal() {
        document.getElementById('solo-play-modal').classList.add('active');
    }
    
    hideSoloPlayModal() {
        document.getElementById('solo-play-modal').classList.remove('active');
    }
    
    startSoloPlay() {
        const selectedMode = document.querySelector('input[name="solo-mode"]:checked').value;
        this.soloItemMode = (selectedMode === 'item');
        this.isSoloMode = true;
        
        this.hideSoloPlayModal();
        this.showGameScreen();
        
        // 싱글플레이 게임 시작
        window.game = new TetrisGame('game-canvas');
        window.game.itemMode = this.soloItemMode;
        
        // 아이템 UI 표시
        const itemsSection = document.getElementById('items-section');
        if (this.soloItemMode && itemsSection) {
            itemsSection.style.display = 'block';
        }
        
        // 타겟 UI 숨기기 (싱글플레이)
        const targetDisplay = document.getElementById('current-target-display');
        if (targetDisplay) {
            targetDisplay.style.display = 'none';
        }
        
        // 플레이어 목록 숨기기
        const playersList = document.getElementById('game-players-list');
        if (playersList) {
            playersList.style.display = 'none';
        }
        
        // 게임 루프
        const gameLoop = (timestamp) => {
            if (!window.game.gameOver) {
                window.game.update(timestamp);
                requestAnimationFrame(gameLoop);
            } else {
                this.handleSoloGameOver();
            }
        };
        
        requestAnimationFrame(gameLoop);
        
        // 키보드 이벤트
        this.setupKeyboardControls();
    }
    
    handleSoloGameOver() {
        console.log('게임 오버! (싱글플레이)');
        document.getElementById('game-over-overlay').style.display = 'block';
        document.getElementById('final-score').textContent = window.game.score;
        document.getElementById('final-lines').textContent = window.game.lines;
        document.getElementById('final-level').textContent = window.game.level;
        document.getElementById('restart-game-btn').style.display = 'inline-block';
    }
    
    restartGame() {
        // 게임 오버 오버레이 숨기기
        document.getElementById('game-over-overlay').style.display = 'none';
        
        // 게임 재시작
        this.startSoloPlay();
    }
    
    showCreateRoomModal() {
        this.playerName = document.getElementById('player-name').value || '플레이어';
        document.getElementById('create-room-modal').classList.add('active');
    }
    
    hideCreateRoomModal() {
        document.getElementById('create-room-modal').classList.remove('active');
    }
    
    createRoom() {
        const roomName = document.getElementById('room-name').value || '내 방';
        const itemMode = document.getElementById('item-mode-checkbox').checked;
        this.send({
            type: 'create_room',
            room_name: roomName,
            player_name: this.playerName,
            max_players: 8,
            item_mode: itemMode
        });
        this.hideCreateRoomModal();
    }
    
    joinRoom(roomId) {
        this.playerName = document.getElementById('player-name').value || '플레이어';
        this.send({
            type: 'join_room',
            room_id: roomId,
            player_name: this.playerName
        });
    }
    
    leaveRoom() {
        this.send({ type: 'leave_room' });
    }
    
    toggleReady() {
        if (!this.currentRoom) return;
        
        const myPlayer = this.currentRoom.players.find(p => p.id === this.playerId);
        const currentReady = myPlayer ? myPlayer.ready : false;
        
        this.send({
            type: 'ready',
            ready: !currentReady
        });
    }
    
    updateAllGames(gameState) {
        if (!this.currentRoom || !gameState.game_states) return;

        // 메인 캔버스 (자신) 업데이트
        const myState = gameState.game_states[this.playerId];
        if (myState) {
            const mainCanvas = document.getElementById('game-canvas');
            const mainCtx = mainCanvas.getContext('2d');
            this.drawGame(mainCtx, myState, mainCanvas.width, mainCanvas.height);
            
            document.getElementById('score').textContent = myState.score;
            document.getElementById('level').textContent = myState.level;
            document.getElementById('lines').textContent = myState.lines_cleared;

            const nextCanvas = document.getElementById('next-canvas');
            const nextCtx = nextCanvas.getContext('2d');
            this.drawNextOrHeld(nextCtx, myState.next_piece);

            const holdCanvas = document.getElementById('hold-canvas');
            const holdCtx = holdCanvas.getContext('2d');
            this.drawNextOrHeld(holdCtx, myState.held_piece);
        }

        // 다른 플레이어들의 미니 그리드 및 점수 업데이트
        for (const playerId in gameState.game_states) {
            const state = gameState.game_states[playerId];
            const scoreEl = document.querySelector(`#player-${playerId} .player-score`);
            if (scoreEl) scoreEl.textContent = state.score;

            if (playerId === this.playerId) continue;
            
            const canvas = document.getElementById(`grid-${playerId}`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                this.drawGame(ctx, state, canvas.width, canvas.height, true);
            }
        }
    }

    drawGame(ctx, state, width, height, isMini = false) {
        const TILE_SIZE = width / 10;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = isMini ? 'transparent' : '#555';

        if (state.grid) {
            for (let r = 0; r < 20; r++) {
                for (let c = 0; c < 10; c++) {
                    if (state.grid[r][c]) {
                        ctx.fillStyle = this.colors[state.grid[r][c] - 1];
                        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        if (!isMini) ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }

        if (state.current_piece && state.current_piece.shape) {
            ctx.fillStyle = state.current_piece.color;
            state.current_piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const drawX = (state.current_piece.x + x) * TILE_SIZE;
                        const drawY = (state.current_piece.y + y) * TILE_SIZE;
                        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                        if (!isMini) ctx.strokeRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                    }
                });
            });
        }
    }

    drawNextOrHeld(ctx, piece) {
        const TILE_SIZE = ctx.canvas.width / 4;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (!piece || !piece.shape) return;

        ctx.fillStyle = piece.color;
        ctx.strokeStyle = '#555';
        const shape = piece.shape;
        const shapeWidth = shape[0].length;
        const shapeHeight = shape.length;
        const startX = (4 - shapeWidth) / 2;
        const startY = (4 - shapeHeight) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    ctx.fillRect((startX + x) * TILE_SIZE, (startY + y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    ctx.strokeRect((startX + x) * TILE_SIZE, (startY + y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            });
        });
    }

    updateRoomUI() {
        
        document.getElementById('room-title').textContent = this.currentRoom.room_name;
        document.getElementById('room-player-count').textContent = 
            `플레이어: ${this.currentRoom.player_count}/${this.currentRoom.max_players}`;
        
        // 아이템 모드 표시
        const itemModeEl = document.getElementById('room-item-mode');
        if (itemModeEl) {
            itemModeEl.style.display = this.currentRoom.item_mode ? 'inline' : 'none';
        }
        
        // 플레이어 목록 업데이스트
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        this.currentRoom.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            if (player.ready) playerItem.classList.add('ready');
            if (player.id === this.currentRoom.host_id) playerItem.classList.add('host');
            if (player.id === this.playerId) playerItem.classList.add('me');
            
            playerItem.innerHTML = `
                <span>${player.name}${player.id === this.playerId ? ' (나)' : ''}</span>
                <span>${player.ready ? '✅ 준비' : '⏳ 대기중'}</span>
            `;
            
            playersList.appendChild(playerItem);
        });
    }
    
    showLobbyScreen() {
        this.lobbyScreen.classList.add('active');
        this.roomScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
    }
    
    showRoomScreen() {
        this.lobbyScreen.classList.remove('active');
        this.roomScreen.classList.add('active');
        this.gameScreen.classList.remove('active');
        this.updateRoomUI();
    }
    
    showGameScreen() {
        this.lobbyScreen.classList.remove('active');
        this.roomScreen.classList.remove('active');
        this.gameScreen.classList.add('active');
    }
    
    startGame(initialGameState, itemMode = false) {
        console.log('게임 시작!' + (itemMode ? ' (아이템 모드)' : ''));
        this.showGameScreen();
        this.isSoloMode = false; // 멀티플레이 게임 시작

        window.game = { itemMode: itemMode }; // 로컬 게임 로직 실행 방지

        document.getElementById('items-section').style.display = itemMode ? 'block' : 'none';
        document.getElementById('current-target-display').style.display = 'block';
        document.getElementById('game-players-list').style.display = 'flex';

        this.updateGamePlayersList();
        if (initialGameState) {
            this.updateAllGames(initialGameState);
        }
        this.setupKeyboardControls();
    }
    
    setupKeyboardControls() {
        // 기존 리스너 제거 (중복 방지)
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);

        this.keydownHandler = (e) => {
            if (!window.game || window.game.gameOver || this.keysDown[e.key]) return;
            this.keysDown[e.key] = true;

            const handleMove = (direction) => {
                this.sendGameInput(direction);
                clearTimeout(this.dasTimeout);
                this.dasTimeout = setTimeout(() => {
                    this.arrInterval = setInterval(() => {
                        this.sendGameInput(direction);
                    }, this.arrRate);
                }, this.dasDelay);
            };

            switch (e.key) {
                case 'ArrowLeft': handleMove('left'); break;
                case 'ArrowRight': handleMove('right'); break;
                case 'ArrowDown': this.sendGameInput('down'); break;
                case 'ArrowUp': case 'x': case 'X': this.sendGameInput('rotate_cw'); break;
                case 'z': case 'Z': case 'Control': e.preventDefault(); this.sendGameInput('rotate_ccw'); break;
                case 'c': case 'C': case 'Shift': e.preventDefault(); this.sendGameInput('hold'); break;
                case ' ': e.preventDefault(); this.sendGameInput('hard_drop'); break;
                case 'Tab': if (!this.isSoloMode) { e.preventDefault(); this.switchTarget(); } break;
                case 'Alt': e.preventDefault(); /* 아이템 로직 */ break;
            }
        };

        this.keyupHandler = (e) => {
            this.keysDown[e.key] = false;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                clearTimeout(this.dasTimeout);
                clearInterval(this.arrInterval);
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    sendGameInput(input) {
        if (this.isSoloMode) {
            switch (input) {
                case 'left': window.game.moveLeft(); break;
                case 'right': window.game.moveRight(); break;
                case 'down': window.game.moveDown(); break;
                case 'rotate_cw': window.game.rotate(true); break;
                case 'rotate_ccw': window.game.rotate(false); break;
                case 'hold': window.game.holdPiece(); break;
                case 'hard_drop': window.game.hardDrop(); break;
            }
        } else {
            this.send({ type: 'game_input', input: input });
        }
    }
            if (!window.game || window.game.gameOver) return;

            let action = null;

            // Tab, Alt 키는 게임 플레이와 별도로 처리
            if (e.key === 'Tab') {
                if (!this.isSoloMode) {
                    e.preventDefault();
                    this.switchTarget();
                }
                return;
            }
            if (e.key === 'Alt') {
                e.preventDefault();
                if (window.game.itemMode) {
                    if (window.game.ghostMode) {
                        window.game.toggleGhostMode();
                    } else {
                        this.useItem();
                    }
                }
                return;
            }

            // 게임 플레이 관련 키 처리
            const keyMap = {
                'ArrowLeft': 'left',
                'ArrowRight': 'right',
                'ArrowDown': 'down',
                'ArrowUp': 'rotate_cw',
                'x': 'rotate_cw',
                'X': 'rotate_cw',
                'z': 'rotate_ccw',
                'Z': 'rotate_ccw',
                'Control': 'rotate_ccw',
                'c': 'hold',
                'C': 'hold',
                'Shift': 'hold',
                ' ': 'hard_drop',
            };

            const input = keyMap[e.key];
            if (!input) return;

            e.preventDefault();

            if (this.isSoloMode) {
                // 솔로 모드: 로컬 게임 객체 직접 호출
                switch (input) {
                    case 'left': window.game.moveLeft(); break;
                    case 'right': window.game.moveRight(); break;
                    case 'down': window.game.moveDown(); break;
                    case 'rotate_cw': window.game.rotate(true); break;
                    case 'rotate_ccw': window.game.rotate(false); break;
                    case 'hold': window.game.holdPiece(); break;
                    case 'hard_drop': window.game.hardDrop(); break;
                }
            } else {
                // 멀티플레이 모드: 서버로 입력 전송
                this.send({ type: 'game_input', input: input });
            }
        });
        this.updateTargetDisplay();
    }
    
    setTarget(targetId) {
        if (targetId === this.playerId) return;
        this.currentTarget = targetId;
        this.updateGamePlayersList();
        console.log(`타겟 변경: ${this.getPlayerName(targetId)}`);
    }
    
    switchTarget() {
        if (this.availableTargets.length === 0) return;
        
        const currentIndex = this.availableTargets.indexOf(this.currentTarget);
        const nextIndex = (currentIndex + 1) % this.availableTargets.length;
        this.currentTarget = this.availableTargets[nextIndex];
        if (this.currentTarget) {
            targetNameEl.textContent = this.getPlayerName(this.currentTarget);
        } else {
            targetNameEl.textContent = '없음';
        }
    }
    
    showAttackNotification(fromName, lines) {
        const notification = document.getElementById('attack-notification');
        const attackFrom = document.getElementById('attack-from');
        
        attackFrom.textContent = `${fromName}에게서 ${lines}줄 공격!`;
        notification.style.display = 'block';
        
        // 3초 후 숨기기
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    // 아이템 공격 전송
    sendItemAttack(itemType) {
        if (!this.currentTarget) {
            console.log('⚠️ 타겟을 선택해주세요!');
            return;
        }
        
        this.send({
            type: 'item_attack',
            target_id: this.currentTarget,
            item_type: itemType
        });
        
        const itemNames = {
            'random': '🎲 랜덤 블록',
            'destroy': '💔 보관 파괴'
        };
        console.log(`${itemNames[itemType]} 아이템 사용 → ${this.getPlayerName(this.currentTarget)}`);
    }
    
    // 그리드 교체 전송
    sendGridSwap(myGrid) {
        if (!this.currentTarget) {
            console.log('⚠️ 타겟을 선택해주세요!');
            return;
        }
        
        this.send({
            type: 'grid_swap',
            target_id: this.currentTarget,
            my_grid: myGrid
        });
        
        console.log(`🔀 맵 교체 요청 → ${this.getPlayerName(this.currentTarget)}`);
    }
    
    handleGameOver() {
        console.log('게임 오버!');
        document.getElementById('game-over-overlay').style.display = 'block';
        document.getElementById('final-score').textContent = window.game.score;
        
        this.send({
            type: 'game_over'
        });
    }
    
    returnToLobby() {
        window.game = null;
        document.getElementById('game-over-overlay').style.display = 'none';
        document.getElementById('restart-game-btn').style.display = 'none';
        
        if (this.isSoloMode) {
            this.isSoloMode = false;
            this.showLobbyScreen();
        } else {
            this.leaveRoom();
        }
    }
}

// 공격 전송 함수 (전역으로 노출)
window.sendAttack = function(lines, combo) {
    if (window.lobbyManager) {
        window.lobbyManager.send({
            type: 'attack',
            lines: lines,
            combo: combo
        });
        console.log(`공격 전송: ${lines}줄 (콤보 ${combo}x)`);
    }
};
