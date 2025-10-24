# Tetris Battle - React Web Client v2.0

React + TypeScript + Vite + Tailwind CSS로 구현된 테트리스 배틀 웹 클라이언트입니다.

## 🚀 시작하기

### 1. 의존성 설치

```bash
cd web-client
npm install
```

### 2. 개발 서버 실행

```bash
# 백엔드 서버가 실행 중이어야 합니다 (localhost:8000)
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 3. 프로덕션 빌드

```bash
npm run build
```

빌드 결과물은 `../server/static-react/` 에 생성됩니다.

## 📁 프로젝트 구조

```
web-client/
├── src/
│   ├── components/
│   │   ├── Lobby.tsx         # 로비 화면
│   │   ├── Room.tsx          # 대기실
│   │   └── Game.tsx          # 게임 화면
│   ├── hooks/                # 커스텀 훅 (WebSocket 등)
│   ├── App.tsx               # 메인 앱
│   ├── main.tsx              # 엔트리 포인트
│   └── index.css             # Tailwind CSS
├── vite.config.ts            # Vite 설정
├── tailwind.config.js        # Tailwind 설정
└── package.json
```

## 🎯 블루-그린 배포

- **Blue (안정)**: `server/static/` - 바닐라 JS 버전
- **Green (신규)**: `server/static-react/` - React 버전

## 🔄 다음 단계

1. WebSocket Hook 구현 (`useWebSocket.ts`)
2. 상태 관리 (Zustand)
3. 게임 로직 통합
4. 플레이어 그리드 컴포넌트
5. 실시간 동기화

## 🛠️ 기술 스택

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (상태 관리)
