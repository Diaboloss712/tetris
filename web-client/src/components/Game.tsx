import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface GameProps {
  onBack: () => void
}

export default function Game({ onBack }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<any>(null)
  const [gameReady, setGameReady] = useState(false)
  const { currentRoom, playerId, currentTarget, isSolo, itemMode } = useGameStore()
  
  // 자신 제외한 플레이어 목록
  const otherPlayers = currentRoom?.players.filter(p => p.id !== playerId) || []
  const playerCount = otherPlayers.length
  
  // 플레이어 수에 따른 그리드 레이아웃
  const getGridLayout = (count: number) => {
    if (count <= 1) return { cols: 1, rows: 1, size: 'w-20 h-32' }
    if (count <= 3) return { cols: 2, rows: 2, size: 'w-24 h-36' }
    if (count <= 7) return { cols: 2, rows: 4, size: 'w-20 h-32' }
    return { cols: 4, rows: 4, size: 'w-16 h-24' }
  }
  
  const layout = getGridLayout(playerCount)
  
  // 게임 로직 초기화: 페이지당 한 번만 game.js 로드, 이미 로드됐다면 재사용
  useEffect(() => {
    const anyWindow = window as any

    const initGame = () => {
      // 캔버스가 DOM에 확실히 준비될 때까지 기다림
      const canvas = document.getElementById('game-canvas')
      console.log('🔍 initGame 호출 - canvas:', canvas, 'canvasRef.current:', canvasRef.current, 'TetrisGame:', anyWindow.TetrisGame)
      
      if (!canvas) {
        console.warn('⏳ 캔버스가 아직 준비되지 않았습니다. 재시도 중...')
        setTimeout(initGame, 100)
        return
      }

      if (!anyWindow.TetrisGame) {
        console.error('❌ TetrisGame 클래스가 로드되지 않았습니다!')
        return
      }

      if (!canvasRef.current) {
        console.error('❌ canvasRef.current가 null입니다!')
        return
      }

      try {
        console.log('🎮 TetrisGame 생성 시작...')
        gameRef.current = new anyWindow.TetrisGame('game-canvas', true)
        if (gameRef.current) {
          gameRef.current.itemMode = itemMode
        }
        console.log('✅ 테트리스 게임 시작! (아이템 모드:', itemMode, ')')
        setGameReady(true) // 게임 준비 완료 플래그 설정
      } catch (error) {
        console.error('❌ 게임 초기화 실패:', error)
      }
    }

    if (anyWindow.TetrisGame) {
      // 이미 스크립트가 로드된 경우, 약간의 지연 후 게임 인스턴스 생성 (DOM 준비 보장)
      setTimeout(initGame, 50)
    } else {
      // 아직 로드되지 않았다면 한 번만 로드
      const script = document.createElement('script')
      script.src = `/game.js?v=${Date.now()}`  // 캐시 방지
      script.async = true
      script.onload = () => {
        console.log('✅ game.js 로드 완료, window.TetrisGame:', anyWindow.TetrisGame)
        setTimeout(initGame, 50)  // DOM 준비를 위한 짧은 지연
      }
      script.onerror = () => {
        console.error('❌ game.js 로드 실패. public 폴더에 game.js 파일이 있는지 확인하세요.')
      }
      document.body.appendChild(script)
    }

    return () => {
      // 스크립트는 그대로 두고, 게임 인스턴스만 정리
      if (gameRef.current && gameRef.current.stopGame) {
        gameRef.current.stopGame()
      }
      gameRef.current = null
    }
  }, [])

  // 아이템 모드 변경 시 인스턴스에 반영
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.itemMode = itemMode
    }
  }, [itemMode])

  // 키보드 컨트롤
  useEffect(() => {
    // 게임이 준비될 때까지 대기
    if (!gameReady || !gameRef.current) {
      console.log('⏳ 게임이 아직 준비되지 않아 키보드 리스너 대기 중... gameReady:', gameReady)
      return
    }

    console.log('🎮 키보드 이벤트 리스너 등록 시작')
    
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('🎮 키 입력:', e.key, 'gameRef:', !!gameRef.current, 'gameOver:', gameRef.current?.gameOver)
      
      if (!gameRef.current) {
        console.warn('⚠️ gameRef.current가 null입니다!')
        return
      }
      
      if (gameRef.current.gameOver) {
        console.warn('⚠️ 게임이 종료되었습니다!')
        return
      }

      console.log('✅ 게임 메서드 호출 시도:', e.key)

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          gameRef.current.moveLeft()
          gameRef.current.draw()
          console.log('← 왼쪽 이동')
          break
        case 'ArrowRight':
          e.preventDefault()
          gameRef.current.moveRight()
          gameRef.current.draw()
          console.log('→ 오른쪽 이동')
          break
        case 'ArrowDown':
          e.preventDefault()
          if (gameRef.current.moveDown()) {
            gameRef.current.score += 1 // 소프트 드롭 점수
          }
          gameRef.current.draw()
          console.log('↓ 아래 이동')
          break
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault()
          gameRef.current.rotate(true)
          gameRef.current.draw()
          console.log('🔄 시계방향 회전')
          break
        case 'z':
        case 'Z':
        case 'Control':
          e.preventDefault()
          gameRef.current.rotate(false)
          gameRef.current.draw()
          console.log('🔄 반시계방향 회전')
          break
        case 'c':
        case 'C':
        case 'Shift':
          e.preventDefault()
          gameRef.current.holdPiece()
          gameRef.current.draw()
          console.log('📦 Hold')
          break
        case ' ':
          e.preventDefault()
          gameRef.current.hardDrop()
          gameRef.current.draw()
          console.log('⬇️ 하드드롭')
          break
      }
    }

    console.log('✅ 키보드 이벤트 리스너 등록 완료!')
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      console.log('🎮 키보드 이벤트 리스너 제거')
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [gameReady])
  
  return (
    <div className="flex justify-center items-start gap-4 p-5 min-h-screen">
      {/* 왼쪽 사이드바 */}
      <div className="card w-44 space-y-4">
        {/* Hold 영역 */}
        <div>
          <h3 className="text-sm font-bold mb-2">Hold (C키)</h3>
          <div className="bg-gray-100 rounded-lg h-20 flex items-center justify-center">
            <canvas
              id="hold-piece-canvas"
              width={100}
              height={80}
              className="bg-black rounded"
            />
          </div>
        </div>
        
        {/* Next 영역 */}
        <div>
          <h3 className="text-sm font-bold mb-2">다음 블록</h3>
          <div className="bg-gray-100 rounded-lg h-20 flex items-center justify-center">
            <canvas
              id="next-piece-canvas"
              width={100}
              height={80}
              className="bg-black rounded"
            />
          </div>
        </div>

        {/* Stats 영역 */}
        <div>
          <h3 className="text-sm font-bold mb-2">Stats</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>점수:</span>
              <span id="score" className="font-bold">0</span>
            </div>
            <div className="flex justify-between">
              <span>레벨:</span>
              <span id="level" className="font-bold">1</span>
            </div>
            <div className="flex justify-between">
              <span>라인:</span>
              <span id="lines" className="font-bold">0</span>
            </div>
          </div>
        </div>

        <button className="btn-secondary w-full text-xs py-2" onClick={onBack}>
          나가기
        </button>
      </div>

      {/* 중앙 게임 캔버스 */}
      <div className="relative">
        <div className="bg-white rounded-2xl shadow-2xl p-2">
          <canvas 
            id="game-canvas"
            ref={canvasRef}
            className="border-4 border-white rounded-xl shadow-lg" 
            width="300" 
            height="600"
            style={{ display: 'block', backgroundColor: '#000' }}
          />
        </div>
      </div>

      {/* 오른쪽: 플레이어 그리드 (멀티플레이에서만 노출) */}
      {!isSolo && (
      <div className="card space-y-3" style={{ width: 'fit-content' }}>
        <h3 className="text-sm font-bold">
          🎯 타겟: {currentTarget ? otherPlayers.find(p => p.id === currentTarget)?.name || '없음' : '없음'}
        </h3>
        
        {/* 플레이어 그리드 */}
        <div 
          className="grid gap-2"
          style={{ 
            gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          }}
        >
          {otherPlayers.map((player) => (
            <div 
              key={player.id} 
              className={`bg-tetris-card rounded-lg p-2 ${player.id === currentTarget ? 'ring-2 ring-red-500' : ''}`}
            >
              <p className="text-white text-xs mb-1 truncate">{player.name}</p>
              <div className={`bg-black rounded ${layout.size}`}></div>
              <div className="flex justify-between text-white text-xs mt-1">
                <span>0점</span>
                <span>0줄</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* 조작법 */}
        <div className="border-t pt-3 mt-3">
          <h4 className="text-xs font-bold mb-2">조작법</h4>
          <div className="text-xs space-y-1">
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">←→</kbd> 이동</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Space</kbd> 하드 드롭</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Z/X</kbd> 회전</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">C</kbd> 홀드</div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
