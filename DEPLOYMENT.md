# Deployment Guide for Multiplayer Tetris

## Overview

To play multiplayer Tetris with friends over the internet, you need to host the server on a publicly accessible machine. Here are your options:

## Option 1: Local Network (LAN) Play - FREE ✅

**Best for**: Playing with friends on the same WiFi/network

**Setup**:
1. Find your local IP address:
   ```bash
   # On Windows
   ipconfig
   # Look for "IPv4 Address" (e.g., 192.168.1.100)
   
   # On Mac/Linux
   ifconfig
   # or
   ip addr show
   ```

2. Start the server:
   ```bash
   cd server
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. Share your local IP with friends (e.g., `192.168.1.100`)

4. Friends connect using:
   ```bash
   cd client
   python lobby.py ws://192.168.1.100:8000
   ```

**Limitations**: Only works on the same network

---

## Option 2: AWS EC2 - Paid 💰

**Best for**: Reliable hosting with full control

**Cost**: ~$3-5/month (t2.micro or t3.micro)

### Setup Steps:

1. **Launch EC2 Instance**:
   - Go to AWS Console → EC2
   - Launch instance with Ubuntu 22.04
   - Instance type: t2.micro (free tier eligible)
   - Configure security group:
     - Allow SSH (port 22) from your IP
     - Allow Custom TCP (port 8000) from anywhere (0.0.0.0/0)
   - Create/download key pair

2. **Connect to Instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   ```

3. **Install Dependencies**:
   ```bash
   sudo apt update
   sudo apt install python3-pip -y
   git clone <your-repo-url>
   cd multiplayer-tetris
   pip3 install -r requirements.txt
   ```

4. **Run Server**:
   ```bash
   cd server
   nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
   ```

5. **Connect Clients**:
   ```bash
   python lobby.py ws://your-ec2-public-ip:8000
   ```

### Keep Server Running:
Use systemd service:
```bash
sudo nano /etc/systemd/system/tetris.service
```

Add:
```ini
[Unit]
Description=Tetris Multiplayer Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/multiplayer-tetris/server
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable tetris
sudo systemctl start tetris
```

---

## Option 3: Heroku - FREE/Paid 🆓

**Best for**: Easy deployment without server management

**Cost**: Free tier available, paid starts at $7/month

### Setup:

1. **Install Heroku CLI**:
   ```bash
   # Download from: https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Create Procfile** in project root:
   ```
   web: cd server && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

3. **Deploy**:
   ```bash
   heroku login
   heroku create your-tetris-app
   git push heroku main
   ```

4. **Connect**:
   ```bash
   python lobby.py wss://your-tetris-app.herokuapp.com
   ```

**Note**: Heroku's free tier sleeps after 30 minutes of inactivity

---

## Option 4: DigitalOcean - Paid 💰

**Best for**: Simple and affordable cloud hosting

**Cost**: $4-6/month (basic droplet)

### Setup:

1. Create droplet (Ubuntu 22.04)
2. Follow similar steps as EC2
3. More straightforward than AWS

---

## Option 5: ngrok - FREE for Testing 🧪

**Best for**: Quick testing, temporary sessions

**Cost**: Free tier available

### Setup:

1. **Download ngrok**: https://ngrok.com/download

2. **Start your local server**:
   ```bash
   cd server
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **Expose with ngrok**:
   ```bash
   ngrok http 8000
   ```

4. **Share the URL**:
   - ngrok will give you a public URL like: `https://abc123.ngrok.io`
   - Friends connect with: `python lobby.py wss://abc123.ngrok.io`

**Limitations**: 
- URL changes each time you restart ngrok (free tier)
- Session limits on free tier
- Not suitable for long-term hosting

---

## Option 6: Replit - FREE 🆓

**Best for**: Instant deployment, no setup needed

### Setup:

1. Create Replit account
2. Import your GitHub repo
3. Add `.replit` file:
   ```
   run = "cd server && uvicorn main:app --host 0.0.0.0 --port 8000"
   ```
4. Click "Run"
5. Use the Replit URL to connect

**Limitations**: May sleep when inactive

---

## Recommended Approach

### For Development/Testing:
1. **ngrok** - Quickest to get started
2. **Local Network** - If testing with friends nearby

### For Production:
1. **AWS EC2** - Most reliable, scalable
2. **DigitalOcean** - Simpler than AWS, still reliable
3. **Heroku** - Easiest deployment, but can be costly

---

## Important Notes

### Security:
- For production, add authentication
- Use HTTPS/WSS for encrypted connections
- Configure firewall rules properly
- Don't expose unnecessary ports

### Performance:
- Choose server location close to players
- t2.micro is fine for ~10 concurrent players
- Monitor CPU/memory usage

### Domain Name (Optional):
- Purchase domain from Namecheap, GoDaddy, etc. (~$10/year)
- Point DNS to your server IP
- Connect with: `ws://tetris.yourdomain.com:8000`

---

## Quick Start Commands

### For EC2/DigitalOcean:
```bash
# Server
cd server
uvicorn main:app --host 0.0.0.0 --port 8000

# Client
cd client
python lobby.py ws://YOUR-SERVER-IP:8000
```

### For local testing:
```bash
# Terminal 1 - Server
cd server
uvicorn main:app --reload

# Terminal 2 - Client
cd client
python lobby.py
```

---

## Troubleshooting

### Can't connect to server:
- Check firewall rules
- Verify security group settings (EC2)
- Ensure server is running: `curl http://localhost:8000`
- Check if port 8000 is open: `sudo netstat -tulpn | grep 8000`

### WebSocket connection failed:
- Make sure to use `ws://` not `http://`
- Use `wss://` for HTTPS servers
- Check server logs for errors

### Server crashes:
- Check memory usage: `free -m`
- Check logs: `tail -f /var/log/syslog`
- Restart service: `sudo systemctl restart tetris`

---

## Cost Comparison Summary

| Option | Monthly Cost | Setup Difficulty | Best For |
|--------|-------------|------------------|----------|
| Local/LAN | Free | Easy | Same network |
| ngrok | Free* | Very Easy | Quick testing |
| Replit | Free* | Very Easy | Learning/demos |
| DigitalOcean | $4-6 | Medium | Production |
| AWS EC2 | $3-5 | Medium-Hard | Scalable production |
| Heroku | Free-$7+ | Easy | Easy deployment |

*Free tiers have limitations
