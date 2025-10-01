# Quick Start Guide - Multiplayer Tetris

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Start the Server

**On Windows**:
```bash
cd server
start_server.bat
```

**On Mac/Linux**:
```bash
cd server
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Step 3: Launch the Game

**On Windows**:
```bash
cd client
start_game.bat
```

**On Mac/Linux**:
```bash
cd client
python lobby.py
```

---

## 🎮 How to Play Multiplayer

### Local Network (Same WiFi) - FREE

1. **Host** starts the server (Step 2 above)
2. **Host** finds their IP:
   - Windows: Open CMD and type `ipconfig`
   - Mac/Linux: Open Terminal and type `ifconfig`
   - Look for IPv4 address (e.g., `192.168.1.100`)

3. **All players** (including host) run:
   ```bash
   cd client
   python lobby.py ws://HOST-IP:8000
   ```
   Replace `HOST-IP` with the actual IP address

4. **In the Lobby**:
   - One player clicks "Create Room"
   - Others click "Join Room" and select the room
   - All players click "Ready"
   - Game starts automatically when everyone is ready!

---

### Internet Play (Play from Anywhere) - Uses ngrok (FREE)

1. **Host** downloads [ngrok](https://ngrok.com/download)

2. **Host** starts the server:
   ```bash
   cd server
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **Host** opens a NEW terminal and runs:
   ```bash
   ngrok http 8000
   ```
   
4. **Host** copies the URL shown (e.g., `https://abc123.ngrok.io`)

5. **All players** (including host) run:
   ```bash
   cd client
   python lobby.py wss://abc123.ngrok.io
   ```
   (Use the ngrok URL from step 4)

6. Follow the lobby steps above to create/join rooms!

---

## 🕹️ Game Controls

- **Left/Right Arrow**: Move piece
- **Down Arrow**: Soft drop (move down faster)
- **Up Arrow**: Rotate piece
- **Space**: Hard drop (instantly drop piece)
- **R**: Restart (when game over)

---

## 🏆 Lobby Features

- **Create Room**: Start a new game room (max 4 players)
- **Join Room**: Join an existing room
- **Ready Button**: Mark yourself as ready
- **Auto-Start**: Game starts when all players are ready
- **Live Updates**: See other players joining in real-time

---

## 🐛 Troubleshooting

### "Connection failed"
- Make sure the server is running
- Check if you're using the correct IP/URL
- Verify firewall isn't blocking port 8000

### "Can't see rooms"
- Click the "Refresh" button
- Make sure you're connected (green status text)

### ngrok URL not working
- Make sure to use `wss://` (not `ws://` or `http://`)
- Check that ngrok is still running
- Verify the server is running on port 8000

### Game won't start
- All players must click "Ready"
- Room must have at least 1 player

---

## 📝 For Long-term Hosting

Want to run a dedicated server? Check out **[DEPLOYMENT.md](DEPLOYMENT.md)** for:
- AWS EC2 setup (~$3/month)
- DigitalOcean setup (~$4/month)
- Heroku deployment (FREE tier)
- And more options!

---

## 💡 Tips

1. **Testing Locally**: Just run `python lobby.py` (no arguments) to connect to localhost
2. **Multiple Players on One Computer**: Run multiple instances of `python lobby.py`
3. **Custom Server**: Run `python lobby.py ws://custom-server:8000`
4. **Room Names**: Use descriptive names like "Friday Night Game"

---

## 🎯 Quick Commands Reference

### Server
```bash
# Start server
cd server && uvicorn main:app --host 0.0.0.0 --port 8000

# Start server with auto-reload (development)
cd server && uvicorn main:app --reload
```

### Client
```bash
# Local server
cd client && python lobby.py

# Custom server
cd client && python lobby.py ws://SERVER-IP:8000

# HTTPS server (ngrok/hosted)
cd client && python lobby.py wss://your-server.com
```

### Quick Test (One Computer)
```bash
# Terminal 1
cd server && uvicorn main:app --reload

# Terminal 2
cd client && python lobby.py

# Terminal 3 (second player)
cd client && python lobby.py
```

---

Enjoy playing Multiplayer Tetris! 🎮
