import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

interface GameProps {
  onBack: () => void
}

export default function Game({ onBack }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<any>(null)
  const { currentRoom, playerId, currentTarget, isSolo, itemMode } = useGameStore()
  
  // 자신 제외한 플레이어 목록
  const otherPlayers = currentRoom?.players.filter(p => p.id !== playerId) || []
  const playerCount = otherPlayers.length
  
  // 플레이어 수에 따른 그리드 레이아웃
  const getGridLayout = (count: number) => {
    if (count <= 1) return { cols: 1, rows: 1, size: 'w-32 h-48' }
    if (count <= 3) return { cols: 2, rows: 2, size: 'w-24 h-36' }
    if (count <= 7) return { cols: 2, rows: 4, size: 'w-20 h-32' }
    return { cols: 4, rows: 4, size: 'w-16 h-24' }
  }
  
  const layout = getGridLayout(playerCount)
  
  // 게임 로직 초기화
  useEffect(() => {
    // 바닐라 JS 버전의 TetrisGame 사용
    const script = document.createElement('script')
    script.src = '/game.js' // public 폴더에서 로드
    script.async = true
    script.onload = () => {
      if (canvasRef.current && (window as any).TetrisGame) {
        gameRef.current = new (window as any).TetrisGame('game-canvas', true)
        if (gameRef.current) {
          gameRef.current.itemMode = itemMode
        }
        console.log('✅ 테트리스 게임 시작!', { isSolo, itemMode })
      }
    }
    script.onerror = () => {
      console.error('❌ game.js 로드 실패. public 폴더에 game.js 파일이 있는지 확인하세요.')
    }
    document.body.appendChild(script)
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
      if (gameRef.current && gameRef.current.stopGame) {
        gameRef.current.stopGame()
      }
    }
  }, [itemMode, isSolo])
  
  return (
    <div className="flex justify-center items-start gap-4 p-5 min-h-screen">
      {/* 왼쪽 사이드바 */}
      <div className="card w-44 space-y-4">
        <div>
          <h3 className="text-sm font-bold mb-2">Hold (C7)</h3>
          <div className="bg-gray-100 rounded-lg h-20 flex items-center justify-center">
            <span className="text-gray-400 text-xs">홀드 블록</span>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-bold mb-2">다음 블록</h3>
          <div className="bg-gray-100 rounded-lg h-20 flex items-center justify-center">
            <span className="text-gray-400 text-xs">Next</span>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-bold mb-2">Stats</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>점수:</span>
              <span className="font-bold">0</span>
            </div>
            <div className="flex justify-between">
              <span>레벨:</span>
              <span className="font-bold">1</span>
            </div>
            <div className="flex justify-between">
              <span>라인:</span>
              <span className="font-bold">0</span>
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
