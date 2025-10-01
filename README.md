# 멀티플레이어 테트리스 (Multiplayer Tetris)

Python, Pygame, FastAPI와 WebSocket을 사용한 실시간 멀티플레이어 테트리스 게임

[English Guide](README_EN.md) | [한글 상세 가이드](GUIDE_KO.md)

## 주요 기능

- 🎮 클래식 테트리스 게임플레이
- 🌐 온라인 멀티플레이어 지원
- ⚔️ **공격/방어 시스템** (tetris.io/jstris 스타일)
- 💥 **콤보 시스템** - 연속 제거로 강력한 공격
- 🛡️ **쓰레기 라인 상쇄** - 전략적 방어
- 🏆 룸/로비 시스템
- 📊 점수 추적 및 리더보드
- 🎨 깔끔하고 반응형 UI

## 필수 요구사항

- Python 3.7+
- pip (Python 패키지 관리자)

## 설치 방법

1. 리포지토리 클론:
   ```bash
   git clone <repository-url>
   cd windsurf-project
   ```

2. 필요한 패키지 설치:
   ```bash
   pip install -r requirements.txt
   ```

## 게임 실행 방법

### 1. 서버 시작

터미널을 열고 실행:
```bash
cd server
uvicorn main:app --host 0.0.0.0 --port 8000
```

또는 Windows에서:
```bash
cd server
start_server.bat
```

서버가 `http://localhost:8000`에서 시작됩니다.

### 2. 로비 시작 (권장)

로비 시스템으로 친구들과 방을 만들고 참가할 수 있습니다:

```bash
cd client
python lobby.py
```

또는 Windows에서:
```bash
cd client
start_game.bat
```

**로비 기능**:
- 게임 방 생성 및 참가
- 사용 가능한 방과 플레이어 확인
- 준비 시스템 - 모든 플레이어 준비 시 자동 시작
- 호스트 게임 시작 제어
- 로컬 IP 자동 표시 (같은 공유기 사용자용)

### 3. 같은 공유기에서 플레이하기

**호스트**가 서버를 시작한 후, **다른 컴퓨터**에서:
```bash
cd client
python lobby.py ws://호스트IP:8000
```

로비 메인 화면에 표시되는 로컬 IP를 사용하세요!

### 4. 대안: 직접 게임 시작

로비 없이 게임 직접 시작 (레거시 방식):
```bash
cd client
python tetris.py [플레이어이름]
```

## 조작 방법

- **←/→ 방향키**: 블록 좌우 이동
- **↓ 방향키**: 소프트 드롭 (빠르게 내리기)
- **↑ 방향키**: 블록 회전
- **스페이스바**: 하드 드롭 (즉시 떨어뜨리기)
- **R**: 게임 오버 후 재시작

## 공격/방어 시스템

### 공격하기
- **2줄 제거**: 1줄 공격
- **3줄 제거**: 2줄 공격
- **4줄 제거 (테트리스)**: 4줄 공격
- **콤보**: 연속 제거 시 추가 공격 (+최대 10줄)
- **Back-to-Back**: 테트리스 연속 시 보너스

### 방어하기
- 받을 공격은 화면에 빨간색으로 표시
- 블록이 고정되기 전에 라인 제거로 상쇄 가능
- 상쇄한 후 남은 라인으로 역공격!

## 멀티플레이어 설정

### 로컬 네트워크 플레이 (같은 공유기)
1. 한 컴퓨터에서 서버 시작
2. 로컬 IP 주소 확인 (Windows: ipconfig, Mac/Linux: ifconfig)
3. 다른 플레이어들이 접속: `python lobby.py ws://호스트IP:8000`

**더 쉬운 방법**: 로비 실행 시 메인 화면에 로컬 IP가 자동으로 표시됩니다!

### 인터넷 플레이 (다른 공유기 사용자와)
자세한 설명은 **[DEPLOYMENT.md](DEPLOYMENT.md)** 참조:
- ngrok 사용하기 (무료, 테스트용)
- AWS EC2 호스팅 (유료, ~$3-5/월)
- DigitalOcean 호스팅 (유료, ~$4-6/월)
- Heroku 배포 (무료 티어 사용 가능)
- 기타 호스팅 옵션

**빠른 온라인 플레이 시작**:
1. [ngrok](https://ngrok.com) 사용 - 테스트용으로 가장 쉬움
2. 서버 시작 후 `ngrok http 8000` 실행
3. ngrok URL을 친구들과 공유
4. 친구들이 실행: `python lobby.py wss://YOUR-NGROK-URL`

## 프로젝트 구조

```
windsurf-project/
├── server/                 # 서버 코드
│   ├── main.py            # 룸/로비 시스템과 WebSocket 핸들러
│   └── start_server.bat   # Windows용 서버 시작 스크립트
├── client/                 # 클라이언트 코드
│   ├── lobby.py           # 로비 UI (방 생성/참가)
│   ├── tetris.py          # 메인 게임 로직 (공격/방어 시스템)
│   └── start_game.bat     # Windows용 게임 시작 스크립트
├── requirements.txt        # Python 의존성
├── README.md              # 이 파일 (한글)
├── GUIDE_KO.md            # 상세 한글 가이드
├── DEPLOYMENT.md          # 온라인 호스팅 가이드
└── QUICKSTART.md          # 빠른 시작 가이드
```

## 추가 문서

- **[GUIDE_KO.md](GUIDE_KO.md)**: 상세한 한글 가이드 (공격/방어 시스템 설명)
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: 온라인 호스팅 방법 (ngrok, AWS, DigitalOcean 등)
- **[QUICKSTART.md](QUICKSTART.md)**: 3단계 빠른 시작 가이드

## 스크린샷 & 데모

게임 특징:
- ✅ 실시간 멀티플레이어 대전
- ✅ 공격/방어/콤보 시스템
- ✅ 쓰레기 라인 상쇄
- ✅ 로컬 네트워크 자동 감지
- ✅ 룸 기반 게임 시스템
- ✅ 최대 4인 동시 플레이

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

**즐거운 게임 되세요!** 🎮✨

질문이나 문제가 있으면 [Issue](../../issues)를 열어주세요.
