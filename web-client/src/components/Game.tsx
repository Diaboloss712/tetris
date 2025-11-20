import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface GameProps {
  onBack: () => void
}

export default function Game({ onBack }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const syncIntervalRef = useRef<any>(null)
  const currentTargetRef = useRef<string | null>(null)
  const [otherPlayersData, setOtherPlayersData] = useState<Record<string, any>>({})
  const { currentRoom, playerId, currentTarget, isSolo, itemMode, setCurrentTarget } = useGameStore()
  
  // currentTarget이 변경될 때마다 ref 업데이트
  useEffect(() => {
    currentTargetRef.current = currentTarget
  }, [currentTarget])
  
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
  
  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'game_tick':
        // 서버 틱으로 게임 속도 동기화 (모든 플레이어 같은 속도)
        if (gameRef.current && !gameRef.current.gameOver) {
          gameRef.current.update(performance.now())
        }
        break
      case 'game_state_update':
        // 서버가 모든 플레이어 상태를 game_states 객체로 보냄
        if (data.game_state && data.game_state.game_states && !isSolo) {
          const newPlayersData: Record<string, any> = {}
          
          // 자신을 제외한 다른 플레이어들의 상태만 저장
          Object.entries(data.game_state.game_states).forEach(([pid, state]: [string, any]) => {
            if (pid !== playerId) {
              newPlayersData[pid] = {
                grid: state.grid,
                score: state.score,
                lines: state.lines,
                combo: state.combo
              }
            }
          })
          
          console.log('📊 게임 상태 업데이트:', Object.keys(newPlayersData).length, '명')
          setOtherPlayersData(newPlayersData)
        }
        break
      case 'receive_attack':
        console.log('💥 공격 수신:', data)
        if (gameRef.current && typeof gameRef.current.receiveAttack === 'function') {
          gameRef.current.receiveAttack(data.lines)
          console.log(`🎯 receiveAttack 호출: ${data.lines}줄`)
        } else {
          console.error('❌ receiveAttack 함수 없음')
        }
        break
      case 'target_changed':
        setCurrentTarget(data.new_target)
        break
    }
  }

  // 공격 전송 함수
  const sendAttack = (lines: number, combo: number) => {
    const target = currentTargetRef.current
    console.log('🚀 sendAttack 호출:', { lines, combo, target, isSolo, wsReady: wsRef.current?.readyState === WebSocket.OPEN })
    
    if (isSolo) {
      console.log('⚠️ 싱글플레이 - 공격 전송 안함')
      return
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket 연결 없음')
      return
    }
    
    if (!target) {
      console.warn('⚠️ 타겟 없음 - 공격 전송 안함')
      return
    }
    
    console.log(`✅ 공격 전송: ${lines}줄 → ${target}`)
    wsRef.current.send(JSON.stringify({
      type: 'attack',  // 서버가 'attack' 타입을 기대함
      target_id: target,
      lines,
      combo
    }))
  }

  // 게임 상태 동기화
  const syncGameState = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !gameRef.current || isSolo) return
    
    wsRef.current.send(JSON.stringify({
      type: 'update_grid',
      grid: gameRef.current.grid,
      score: gameRef.current.score,
      level: gameRef.current.level,
      lines: gameRef.current.lines,
      combo: gameRef.current.combo
    }))
  }

  // 타겟 전환
  const switchTarget = () => {
    if (isSolo || !currentRoom) return
    
    const aliveIds = otherPlayers.map(p => p.id)
    if (aliveIds.length === 0) return
    
    const currentIndex = currentTarget ? aliveIds.indexOf(currentTarget) : -1
    const nextIndex = (currentIndex + 1) % aliveIds.length
    const newTarget = aliveIds[nextIndex]
    
    setCurrentTarget(newTarget)
    
    // 서버에 타겟 변경 알림
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'change_target',
        target_id: newTarget
      }))
    }
  }

  // 키보드 컨트롤 설정
  const setupKeyboardControls = () => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current || gameRef.current.gameOver) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          gameRef.current.moveLeft()
          gameRef.current.draw()
          break
        case 'ArrowRight':
          e.preventDefault()
          gameRef.current.moveRight()
          gameRef.current.draw()
          break
        case 'ArrowDown':
          e.preventDefault()
          if (gameRef.current.moveDown()) {
            gameRef.current.score += 1
          }
          gameRef.current.draw()
          break
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault()
          gameRef.current.rotate(true)
          gameRef.current.draw()
          break
        case 'z':
        case 'Z':
        case 'Control':
          e.preventDefault()
          gameRef.current.rotate(false)
          gameRef.current.draw()
          break
        case 'c':
        case 'C':
        case 'Shift':
          e.preventDefault()
          gameRef.current.holdPiece()
          gameRef.current.draw()
          break
        case ' ':
          e.preventDefault()
          gameRef.current.hardDrop()
          gameRef.current.draw()
          break
        case 'Tab':
          if (!isSolo) {
            e.preventDefault()
            switchTarget()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
  }
  
  // 게임 로직 초기화: 페이지당 한 번만 game.js 로드, 이미 로드됐다면 재사용
  useEffect(() => {
    const anyWindow = window as any

    const initGame = () => {
      const canvas = document.getElementById('game-canvas')
      
      if (!canvas) {
        setTimeout(initGame, 100)
        return
      }

      if (!anyWindow.TetrisGame || !canvasRef.current) return

      try {
        // 멀티플레이에서는 autoStart=false (서버 틱으로 동기화)
        // 싱글플레이에서는 autoStart=true (로컬 루프)
        const autoStart = isSolo
        gameRef.current = new anyWindow.TetrisGame('game-canvas', autoStart)
        if (gameRef.current) {
          gameRef.current.itemMode = itemMode
        }
        
        // 전역 공격 함수 등록
        anyWindow.sendAttack = sendAttack
        
        setupKeyboardControls()
        
        // 멀티플레이어 WebSocket 연결
        if (!isSolo && playerId) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const wsUrl = `${protocol}//${window.location.host}/ws/${playerId}`
          
          const ws = new WebSocket(wsUrl)
          wsRef.current = ws
          
          ws.onopen = () => {
            console.log('✅ WebSocket 연결됨')
            
            // 초기 타겟 설정 (첫 번째 플레이어)
            if (!currentTarget && otherPlayers.length > 0) {
              const firstTarget = otherPlayers[0].id
              setCurrentTarget(firstTarget)
              console.log(`🎯 초기 타겟 설정: ${firstTarget}`)
            }
          }
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              handleWebSocketMessage(data)
            } catch (error) {
              console.error('메시지 파싱 실패:', error)
            }
          }
          
          ws.onerror = (error) => {
            console.error('WebSocket 에러:', error)
          }
          
          ws.onclose = () => {
            console.log('❌ WebSocket 연결 끊김')
          }
          
          // 주기적으로 게임 상태 동기화 및 게임 오버 체크
          syncIntervalRef.current = setInterval(() => {
            syncGameState()
            
            // 게임 오버 체크
            if (gameRef.current && gameRef.current.gameOver && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'game_over'
              }))
              // 한 번만 전송
              if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current)
                syncIntervalRef.current = null
              }
            }
          }, 100)
        }
      } catch (error) {
        console.error('게임 초기화 실패:', error)
      }
    }

    if (anyWindow.TetrisGame) {
      setTimeout(initGame, 50)
    } else {
      const script = document.createElement('script')
      script.src = `/game.js?v=${Date.now()}`
      script.async = true
      script.onload = () => setTimeout(initGame, 50)
      script.onerror = () => console.error('game.js 로드 실패')
      document.body.appendChild(script)
    }

    return () => {
      if (gameRef.current?.stopGame) gameRef.current.stopGame()
      gameRef.current = null
      
      // WebSocket 정리
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      
      // 동기화 인터벌 정리
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [])

  // 아이템 모드 변경 시 인스턴스에 반영
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.itemMode = itemMode
    }
  }, [itemMode])

  // UI 업데이트 (점수, 레벨, 라인, 받을 공격)
  useEffect(() => {
    const updateUI = () => {
      if (!gameRef.current) return
      
      // Stats 업데이트
      const scoreEl = document.getElementById('score')
      const levelEl = document.getElementById('level')
      const linesEl = document.getElementById('lines')
      
      if (scoreEl) scoreEl.textContent = gameRef.current.score.toString()
      if (levelEl) levelEl.textContent = gameRef.current.level.toString()
      if (linesEl) linesEl.textContent = gameRef.current.lines.toString()
      
      // 받을 공격 업데이트 (멀티플레이)
      if (!isSolo) {
        const pendingEl = document.getElementById('pending-garbage')
        const incomingEl = document.getElementById('incoming-garbage')
        
        if (pendingEl) pendingEl.textContent = (gameRef.current.pendingGarbage || 0).toString()
        if (incomingEl) incomingEl.textContent = (gameRef.current.incomingGarbage || 0).toString()
      }
    }
    
    const interval = setInterval(updateUI, 50)
    return () => clearInterval(interval)
  }, [isSolo])

  // 다른 플레이어 그리드 렌더링
  useEffect(() => {
    if (isSolo) return

    const colors = ['#00ffff', '#ffff00', '#ff00ff', '#ffa500', '#0000ff', '#00ff00', '#ff0000']
    
    Object.entries(otherPlayersData).forEach(([playerId, data]: [string, any]) => {
      const canvas = document.getElementById(`grid-${playerId}`) as HTMLCanvasElement
      if (!canvas || !data.grid) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // 배경 클리어
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 그리드 그리기
      const blockSize = 5
      for (let y = 0; y < data.grid.length; y++) {
        for (let x = 0; x < data.grid[y].length; x++) {
          if (data.grid[y][x]) {
            ctx.fillStyle = colors[(data.grid[y][x] - 1) % colors.length]
            ctx.fillRect(x * blockSize, y * blockSize, blockSize - 1, blockSize - 1)
          }
        }
      }
    })
  }, [otherPlayersData, isSolo])
  
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

        {/* 받을 공격 표시 (멀티플레이에서만) */}
        {!isSolo && (
          <div className="bg-red-900 bg-opacity-30 rounded-lg p-2">
            <h3 className="text-xs font-bold mb-2">⚠️ 받을 공격</h3>
            <div className="flex gap-2 text-xs">
              <div className="flex-1 text-center">
                <div className="text-red-400 font-bold">🔴 확정</div>
                <div id="pending-garbage" className="text-lg font-bold">0</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-yellow-400 font-bold">🟡 대기</div>
                <div id="incoming-garbage" className="text-lg font-bold">0</div>
              </div>
            </div>
          </div>
        )}

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
          {otherPlayers.map((player) => {
            const playerData = otherPlayersData[player.id] || { score: 0, lines: 0, grid: null }
            return (
              <div 
                key={player.id} 
                className={`bg-tetris-card rounded-lg p-2 ${player.id === currentTarget ? 'ring-2 ring-red-500' : ''}`}
              >
                <p className="text-white text-xs mb-1 truncate">{player.name}</p>
                <canvas 
                  id={`grid-${player.id}`}
                  width={100}
                  height={200}
                  className={`bg-black rounded ${layout.size}`}
                />
                <div className="flex justify-between text-white text-xs mt-1">
                  <span>{playerData.score}점</span>
                  <span>{playerData.lines}줄</span>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* 조작법 */}
        <div className="border-t pt-3 mt-3">
          <h4 className="text-xs font-bold mb-2">조작법</h4>
          <div className="text-xs space-y-1">
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">←→</kbd> 이동</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Space</kbd> 하드 드롭</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Z/X</kbd> 회전</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">C</kbd> 홀드</div>
            <div className="text-orange-500 font-bold"><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Tab</kbd> 타겟 전환 🎯</div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
