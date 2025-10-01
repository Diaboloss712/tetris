# Vercel 배포 가이드

## 🚀 3단계로 배포하기

### 1단계: Vercel 계정 만들기
1. [vercel.com](https://vercel.com) 접속
2. GitHub 계정으로 로그인
3. 무료!

### 2단계: GitHub에 푸시 (선택)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/tetris-battle.git
git push -u origin main
```

### 3단계: Vercel CLI로 배포
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포!
cd windsurf-project
vercel

# 몇 번 엔터 누르면 끝!
```

배포되면:
```
✅ Production: https://your-tetris-app.vercel.app
```

---

## 🎮 배포 후 확인사항

1. 브라우저에서 URL 접속
2. 이름 입력하고 방 만들기
3. 친구들과 URL 공유!

---

## 🔧 배포 설정

`vercel.json` 파일이 자동으로 설정되어 있습니다:
- Python FastAPI 서버
- 정적 파일 (HTML/JS/CSS)
- WebSocket 지원

---

## 💡 팁

### 커스텀 도메인
Vercel 대시보드에서 도메인 추가 가능 (무료!)

### 자동 배포
GitHub과 연동하면 push할 때마다 자동 배포

### 환경 변수
Vercel 대시보드에서 설정 가능

---

## 📊 모든 기능 구현 완료!

✅ Hold 기능 (C키)
✅ Ghost Piece (떨어질 위치 미리보기)
✅ 7-bag 랜덤 시스템
✅ Perfect Clear 보너스
✅ Mini T-Spin
✅ T-Spin (Single/Double/Triple)
✅ 시계/반시계 회전
✅ Wall Kick (SRS)
✅ 콤보 시스템
✅ Back-to-Back
✅ 쓰레기 라인 상쇄
✅ 멀티플레이어 (최대 4인)
✅ 룸 시스템

**tetris.io / jstris와 동일한 기능!**

---

즐거운 게임 되세요! 🎮✨
