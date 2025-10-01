# 빠른 시작 가이드 - 멀티플레이어 테트리스

## 🚀 3단계로 시작하기

### 1단계: 의존성 설치
```bash
pip install -r requirements.txt
```

### 2단계: 서버 시작

**Windows**:
```bash
cd server
start_server.bat
```

**Mac/Linux**:
```bash
cd server
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3단계: 게임 실행

**Windows**:
```bash
cd client
start_game.bat
```

**Mac/Linux**:
```bash
cd client
python lobby.py
```

---

## 🎮 같은 공유기에서 멀티플레이

### 가장 쉬운 방법 (자동)

1. **호스트**가 서버 시작 (위 2단계)

2. **모든 플레이어**가 로비 실행:
   ```bash
   cd client
   python lobby.py
   ```

3. 로비 메인 화면에서 **"내 로컬 IP"** 확인 (예: `192.168.0.10:8000`)

4. **다른 컴퓨터**에서:
   ```bash
   python lobby.py ws://192.168.0.10:8000
   ```
   (호스트 IP를 사용)

5. **로비에서**:
   - 한 명이 "방 만들기" → 방 이름 입력
   - 다른 플레이어들이 "방 참가" → 방 선택
   - 모두 "준비" 클릭
   - 자동으로 게임 시작! 🎉

---

## 🌐 인터넷으로 플레이 (다른 공유기)

### ngrok 사용 (무료, 5분 완료)

1. **호스트**가 [ngrok 다운로드](https://ngrok.com/download)

2. **호스트**가 서버 시작:
   ```bash
   cd server
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **호스트**가 새 터미널에서 ngrok 실행:
   ```bash
   ngrok http 8000
   ```
   
4. **호스트**가 표시된 URL 복사 (예: `https://abc123.ngrok.io`)

5. **모든 플레이어**가 접속:
   ```bash
   cd client
   python lobby.py wss://abc123.ngrok.io
   ```

6. 로비에서 방 만들고 게임 시작!

---

## 🕹️ 게임 조작법

| 키 | 동작 |
|---|---|
| ← → | 블록 좌우 이동 |
| ↓ | 소프트 드롭 (빠르게 내리기) |
| ↑ | 블록 회전 |
| **스페이스바** | **하드 드롭 (즉시 떨어뜨리기)** |
| R | 재시작 (게임 오버 시) |

---

## ⚔️ 공격/방어 시스템 (간단 설명)

### 공격하는 법
- **2줄 동시 제거** → 상대에게 1줄 공격
- **3줄 동시 제거** → 2줄 공격
- **4줄 동시 제거 (테트리스!)** → 4줄 공격
- **콤보** (연속 제거) → 추가 공격!

### 방어하는 법
- 화면에 빨간색으로 **"받을 공격: X줄"** 표시됨
- 블록이 고정되기 **전에** 라인을 지우면 공격 상쇄!
- 예: 3줄 받을 예정 → 2줄 지우면 → 1줄만 받음

### 콤보 만들기
1. 라인 지우기 (1줄이라도 OK)
2. 다음 블록으로 또 라인 지우기
3. 계속 지우면 콤보 증가!
4. 콤보가 높을수록 강력한 공격

---

## 🎯 빠른 테스트 (한 컴퓨터에서)

여러 플레이어를 시뮬레이션하려면:

```bash
# 터미널 1 - 서버
cd server && uvicorn main:app --reload

# 터미널 2 - 플레이어 1
cd client && python lobby.py

# 터미널 3 - 플레이어 2
cd client && python lobby.py

# 터미널 4 - 플레이어 3
cd client && python lobby.py
```

모두 같은 로비에 연결됩니다!

---

## 🐛 문제 해결

### "연결 실패"
✅ 서버가 실행 중인지 확인  
✅ 올바른 IP/URL 사용 중인지 확인  
✅ 방화벽이 8000번 포트를 막고 있는지 확인

### "방이 안 보여요"
✅ "새로고침" 버튼 클릭  
✅ 연결 상태 확인 (초록색 "연결됨" 표시)

### "공격이 안 가요"
✅ 1줄 제거는 공격이 없음 (콤보만 증가)  
✅ 2줄 이상 제거해야 공격 발생

### ngrok URL이 안 돼요
✅ `wss://` 사용 (`ws://`나 `http://` 아님)  
✅ ngrok이 계속 실행 중인지 확인  
✅ 서버가 8000번 포트에서 실행 중인지 확인

---

## 💡 꿀팁

### 초보자
1. **스페이스바** 많이 사용하기 (하드 드롭)
2. **I 블록**(일자)을 위한 공간 만들기
3. 콤보보다는 생존이 우선!

### 중급자
1. **콤보 유지**로 지속적인 압박
2. **테트리스**(4줄) 노리기
3. 상대 공격 보고 방어 타이밍 조절

### 고급자
1. **다운스태킹** - 쓰레기 빠르게 처리
2. **Back-to-Back** 보너스 활용
3. 여러 상대를 동시에 압박

---

## 📚 더 자세한 정보

- **상세 가이드**: [GUIDE_KO.md](GUIDE_KO.md)
- **공격/방어 시스템 전략**: GUIDE_KO.md의 "고급 전략" 섹션
- **온라인 호스팅**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🎮 지금 바로 시작하기!

```bash
# 1. 패키지 설치
pip install -r requirements.txt

# 2. 서버 시작
cd server
start_server.bat  # Windows
# 또는
uvicorn main:app --host 0.0.0.0 --port 8000  # Mac/Linux

# 3. 게임 시작 (새 터미널)
cd client
start_game.bat  # Windows
# 또는
python lobby.py  # Mac/Linux
```

**즐거운 게임 되세요!** 🎮✨

---

## 명령어 치트시트

```bash
# 서버
cd server && uvicorn main:app --host 0.0.0.0 --port 8000

# 로컬 클라이언트
cd client && python lobby.py

# 다른 IP로 접속
cd client && python lobby.py ws://192.168.0.10:8000

# ngrok으로 접속
cd client && python lobby.py wss://your-url.ngrok.io
```
