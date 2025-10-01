// 로비 및 네트워크 로직
class LobbyManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = '';
        this.currentRoom = null;
        this.rooms = [];
        this.connected = false;
        
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
        document.getElementById('create-room-btn').onclick = () => this.showCreateRoomModal();
        document.getElementById('refresh-rooms-btn').onclick = () => this.requestRoomList();
        document.getElementById('confirm-create-room').onclick = () => this.createRoom();
        document.getElementById('cancel-create-room').onclick = () => this.hideCreateRoomModal();
        document.getElementById('ready-btn').onclick = () => this.toggleReady();
        document.getElementById('leave-room-btn').onclick = () => this.leaveRoom();
        document.getElementById('return-lobby-btn').onclick = () => this.returnToLobby();
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
                this.startGame();
                break;
            case 'receive_attack':
                if (window.game) {
                    window.game.receiveAttack(data.lines);
                    console.log(`공격 받음: ${data.from_name}에게서 ${data.lines}줄!`);
                }
                break;
            case 'player_game_over':
                this.updateGamePlayersList();
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
    
    showCreateRoomModal() {
        this.playerName = document.getElementById('player-name').value || '플레이어';
        document.getElementById('create-room-modal').classList.add('active');
    }
    
    hideCreateRoomModal() {
        document.getElementById('create-room-modal').classList.remove('active');
    }
    
    createRoom() {
        const roomName = document.getElementById('room-name').value || '내 방';
        this.send({
            type: 'create_room',
            room_name: roomName,
            player_name: this.playerName,
            max_players: 4
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
        if (!this.currentRoom) return;
        
        document.getElementById('room-title').textContent = this.currentRoom.room_name;
        document.getElementById('room-player-count').textContent = 
            `플레이어: ${this.currentRoom.player_count}/${this.currentRoom.max_players}`;
        
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
    
    startGame() {
        console.log('게임 시작!');
        this.showGameScreen();
        
        // 게임 초기화
        window.game = new TetrisGame('game-canvas');
        
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
                    // 시계방향 회전
                    window.game.rotate(true);
                    break;
                case 'z':
                case 'Z':
                case 'Control':
                    // 반시계방향 회전
                    e.preventDefault();
                    window.game.rotate(false);
                    break;
                case 'c':
                case 'C':
                case 'Shift':
                    // Hold
                    e.preventDefault();
                    window.game.holdPiece();
                    break;
                case ' ':
                    e.preventDefault();
                    const attackLines = window.game.hardDrop();
                    if (attackLines > 0) {
                        this.send({
                            type: 'attack',
                            lines: attackLines,
                            combo: window.game.combo
                        });
                    }
                    break;
            }
            
            window.game.draw();
        });
        
        this.updateGamePlayersList();
    }
    
    updateGamePlayersList() {
        // 게임 중 플레이어 목록 업데이트
        if (!this.currentRoom) return;
        
        const list = document.getElementById('game-players-list');
        list.innerHTML = '';
        
        this.currentRoom.players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'game-player-item';
            if (player.id === this.playerId) item.classList.add('me');
            
            item.textContent = player.name;
            list.appendChild(item);
        });
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
        this.leaveRoom();
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
