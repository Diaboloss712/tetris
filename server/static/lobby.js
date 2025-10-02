// 로비 및 네트워크 로직
class LobbyManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = '';
        this.currentRoom = null;
        this.rooms = [];
        this.connected = false;
        
        // 타겟팅 시스템
        this.currentTarget = null;
        this.availableTargets = [];
        
        // 싱글플레이 모드
        this.isSoloMode = false;
        this.soloItemMode = false;
        
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
                const itemMode = data.item_mode || false;
                this.startGame(itemMode);
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
    
    startGame(itemMode = false) {
        console.log('게임 시작!' + (itemMode ? ' (아이템 모드)' : ''));
        this.showGameScreen();
        
        // 게임 초기화
        window.game = new TetrisGame('game-canvas');
        window.game.itemMode = itemMode;
        
        // 아이템 UI 표시
        const itemsSection = document.getElementById('items-section');
        if (itemMode && itemsSection) {
            itemsSection.style.display = 'block';
        }
        
        // 게임 루프
        const gameLoop = (timestamp) => {
            if (!window.game.gameOver) {
                window.game.update(timestamp);
                requestAnimationFrame(gameLoop);
            } else {
                this.handleGameOver();
            }
        };
        
        requestAnimationFrame(gameLoop);
        
        // 키보드 이벤트
        this.setupKeyboardControls();
        
        this.updateGamePlayersList();
    }
    
    setupKeyboardControls() {
        // 키보드 이벤트 (싱글/멀티 공통)
        document.addEventListener('keydown', (e) => {
            if (!window.game || window.game.gameOver) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    window.game.moveLeft();
                    break;
                case 'ArrowRight':
                    window.game.moveRight();
                    break;
                case 'ArrowDown':
                    window.game.moveDown();
                    break;
                case 'ArrowUp':
                case 'x':
                case 'X':
                    window.game.rotate(true); // CW
                    break;
                case 'z':
                case 'Z':
                case 'Control':
                    e.preventDefault();
                    window.game.rotate(false); // CCW
                    break;
                case 'c':
                case 'C':
                case 'Shift':
                    e.preventDefault();
                    window.game.holdPiece();
                    break;
                case ' ':
                    e.preventDefault();
                    const attackLines = window.game.hardDrop();
                    if (!this.isSoloMode && attackLines > 0 && this.currentTarget) {
                        this.send({
                            type: 'attack',
                            target_id: this.currentTarget,
                            lines: attackLines,
                            combo: window.game.combo
                        });
                    }
                    break;
                case 'Tab':
                    if (!this.isSoloMode) {
                        e.preventDefault();
                        this.switchTarget();
                    }
                    break;
                case 'Alt':
                    e.preventDefault();
                    if (window.game.itemMode) {
                        if (window.game.ghostMode) {
                            window.game.fixGhostBlock();
                        } else {
                            window.game.useItem();
                        }
                    }
                    break;
            }
            
            window.game.draw();
        });
    }
    
    updateGamePlayersList() {
        // 게임 중 플레이어 목록 업데이트
        if (!this.currentRoom) return;
        
        const list = document.getElementById('game-players-list');
        list.innerHTML = '';
        
        // 사용 가능한 타겟 업데이트 (자신 제외)
        this.availableTargets = this.currentRoom.players
            .filter(p => p.id !== this.playerId)
            .map(p => p.id);
        
        // 현재 타겟이 없거나 유효하지 않으면 첫 번째 타겟으로 설정
        if (!this.currentTarget || !this.availableTargets.includes(this.currentTarget)) {
            this.currentTarget = this.availableTargets[0] || null;
        }
        
        this.currentRoom.players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'game-player-item';
            if (player.id === this.playerId) {
                item.classList.add('me');
            } else {
                // 타겟 표시
                if (player.id === this.currentTarget) {
                    item.classList.add('targeted');
                }
                // 클릭으로 타겟 변경
                item.onclick = () => {
                    this.setTarget(player.id);
                };
            }
            
            item.textContent = player.name + (player.id === this.playerId ? ' (나)' : '');
            list.appendChild(item);
        });
        
        // 현재 타겟 표시 업데이트
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
        
        this.updateGamePlayersList();
        console.log(`타겟 전환: ${this.getPlayerName(this.currentTarget)}`);
    }
    
    getPlayerName(playerId) {
        if (!this.currentRoom) return '알 수 없음';
        const player = this.currentRoom.players.find(p => p.id === playerId);
        return player ? player.name : '알 수 없음';
    }
    
    updateTargetDisplay() {
        const targetNameEl = document.getElementById('current-target-name');
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
