import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Volume2, VolumeX, Eye, EyeOff, DoorOpen, DoorClosed } from 'lucide-react'
import toast from 'react-hot-toast'

// Types
type AnimatronicType = 'Deddy' | 'Gen' | 'Poppy'
type CameraLocation = 'stage' | 'cam3' | 'cam1' | 'leftDoor' | 'rightDoor'
type GameState = 'menu' | 'playing' | 'gameOver' | 'victory'

interface Animatronic {
  name: AnimatronicType
  location: CameraLocation
  isActive: boolean
  moveTimer: number
  atDoor: boolean
  soundPlayed: boolean
  doorTimer?: number // Track time at door
}

interface GameData {
  night: number
  time: number // 12 AM = 0, 6 AM = 360 (6 hours * 60 minutes)
  power: number
  leftDoorClosed: boolean
  rightDoorClosed: boolean
  currentCamera: number
  animatronics: Animatronic[]
  gameState: GameState
  bossMode: boolean
}

const NIGHT_DURATION = 360 // 6 hours in game time (6 minutes real time)
const BASE_POWER_DRAIN = 0.05 // Super slow base drain per tick
const DOOR_POWER_DRAIN = 0.15 // Small extra drain per closed door
const CAMERA_POWER_DRAIN = 0.2 // Small extra drain when cameras are open

function App() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [gameData, setGameData] = useState<GameData>({
    night: 1,
    time: 0,
    power: 100,
    leftDoorClosed: false,
    rightDoorClosed: false,
    currentCamera: 4,
    animatronics: [
      { name: 'Deddy', location: 'stage', isActive: false, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 },
      { name: 'Gen', location: 'stage', isActive: false, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 },
      { name: 'Poppy', location: 'stage', isActive: false, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 }
    ],
    gameState: 'menu',
    bossMode: false
  })

  const [showCameras, setShowCameras] = useState(false)
  const gameTimerRef = useRef<NodeJS.Timeout>()
  const moveTimerRef = useRef<NodeJS.Timeout>()

  // Initialize animatronics for each night
  const initializeNight = useCallback((night: number) => {
    const animatronics: Animatronic[] = [
      { name: 'Deddy', location: 'stage', isActive: night >= 4, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 },
      { name: 'Gen', location: 'stage', isActive: night >= 1, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 },
      { name: 'Poppy', location: 'stage', isActive: night >= 1, moveTimer: 0, atDoor: false, soundPlayed: false, doorTimer: 0 }
    ]

    // Night 5 is boss mode with only Deddy
    if (night === 5) {
      animatronics[0].isActive = true // Deddy
      animatronics[1].isActive = false // Gen
      animatronics[2].isActive = false // Poppy
    }

    setGameData(prev => ({
      ...prev,
      night,
      time: 0,
      power: 100,
      leftDoorClosed: false,
      rightDoorClosed: false,
      currentCamera: 4,
      animatronics,
      gameState: 'playing',
      bossMode: night === 5
    }))
  }, [])

  // Play scary sound
  const playScarySound = useCallback(() => {
    if (soundEnabled) {
      // Create a simple scary sound effect using Web Audio API
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5)
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 1)
    }
  }, [soundEnabled])

  // Move animatronic
  const moveAnimatronic = useCallback((animatronic: Animatronic) => {
    const newLocation: CameraLocation = 
      animatronic.location === 'stage' ? 'cam3' :
      animatronic.location === 'cam3' ? 'cam1' :
      animatronic.location === 'cam1' ? (Math.random() < 0.5 ? 'leftDoor' : 'rightDoor') :
      'stage'

    // Play sound when Deddy moves
    if (animatronic.name === 'Deddy' && !animatronic.soundPlayed && newLocation !== 'stage') {
      playScarySound()
      animatronic.soundPlayed = true
    }

    return {
      ...animatronic,
      location: newLocation,
      atDoor: newLocation === 'leftDoor' || newLocation === 'rightDoor',
      moveTimer: 0
    }
  }, [playScarySound])

  // Check if animatronic is blocked by door
  const isBlockedByDoor = useCallback((animatronic: Animatronic, leftDoor: boolean, rightDoor: boolean) => {
    return (animatronic.location === 'leftDoor' && leftDoor) || 
           (animatronic.location === 'rightDoor' && rightDoor)
  }, [])

  // Game timer
  useEffect(() => {
    if (gameData.gameState === 'playing') {
      gameTimerRef.current = setInterval(() => {
        setGameData(prev => {
          const newTime = prev.time + 1
          // Calculate power drain
          let drain = BASE_POWER_DRAIN
          if (prev.leftDoorClosed) drain += DOOR_POWER_DRAIN
          if (prev.rightDoorClosed) drain += DOOR_POWER_DRAIN
          if (showCameras) drain += CAMERA_POWER_DRAIN
          const newPower = prev.power - drain
          
          // Game over conditions
          if (newPower <= 0) {
            return { ...prev, gameState: 'gameOver', power: 0 }
          }
          
          if (newTime >= NIGHT_DURATION) {
            if (prev.night >= 5) {
              return { ...prev, gameState: 'victory' }
            } else {
              return { ...prev, gameState: 'menu' }
            }
          }
          
          return { ...prev, time: newTime, power: Math.max(0, newPower) }
        })
      }, 100) // 100ms = faster game time

      return () => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current)
      }
    }
  }, [gameData.gameState, initializeNight, showCameras])

  // Auto-start next night after 2 seconds if in menu after a night
  const prevGameStateRef = useRef<GameState>(gameData.gameState)
  useEffect(() => {
    if (prevGameStateRef.current === 'playing' && gameData.gameState === 'menu') {
      const timeout = setTimeout(() => {
        initializeNight(gameData.night + 1)
      }, 2000)
      return () => clearTimeout(timeout)
    }
    prevGameStateRef.current = gameData.gameState
  }, [gameData.gameState, gameData.night, initializeNight])

  // Animatronic movement timer
  useEffect(() => {
    if (gameData.gameState === 'playing') {
      moveTimerRef.current = setInterval(() => {
        setGameData(prev => {
          const updatedAnimatronics = prev.animatronics.map(animatronic => {
            if (!animatronic.isActive) return animatronic
            
            const newMoveTimer = animatronic.moveTimer + 1
            
            // If at door
            if (animatronic.atDoor) {
              // Determine which door
              const isLeft = animatronic.location === 'leftDoor'
              const isRight = animatronic.location === 'rightDoor'
              const doorClosed = (isLeft && prev.leftDoorClosed) || (isRight && prev.rightDoorClosed)

              // If door is closed, send back to stage and reset doorTimer
              if (doorClosed) {
                return {
                  ...animatronic,
                  location: 'stage',
                  atDoor: false,
                  moveTimer: 0,
                  soundPlayed: false,
                  doorTimer: 0
                }
              }

              // If door is open, increment doorTimer
              const newDoorTimer = (animatronic.doorTimer || 0) + 1
              // If at door for 80 ticks (~8 seconds), game over
              if (newDoorTimer >= 80) {
                // We'll handle game over outside map
                return { ...animatronic, doorTimer: newDoorTimer }
              }
              return { ...animatronic, moveTimer: newMoveTimer, doorTimer: newDoorTimer }
            }

            // Not at door, reset doorTimer
            // Movement timing: 8s to cam3, 9s to cam1, 10s to door
            const shouldMove =
              (animatronic.location === 'stage' && newMoveTimer >= 80) ||
              (animatronic.location === 'cam3' && newMoveTimer >= 90) ||
              (animatronic.location === 'cam1' && newMoveTimer >= 100)
            
            if (shouldMove) {
              return { ...moveAnimatronic(animatronic), doorTimer: 0 }
            }
            
            // Check if blocked by door and should return
            if (isBlockedByDoor(animatronic, prev.leftDoorClosed, prev.rightDoorClosed) && newMoveTimer >= 90) {
              return {
                ...animatronic,
                location: 'stage',
                atDoor: false,
                moveTimer: 0,
                soundPlayed: false,
                doorTimer: 0
              }
            }
            
            // Boss mode: Deddy has 4.5% chance to run to door
            if (prev.bossMode && animatronic.name === 'Deddy' && Math.random() < 0.045) {
              const doorSide = Math.random() < 0.5 ? 'leftDoor' : 'rightDoor'
              return {
                ...animatronic,
                location: doorSide,
                atDoor: true,
                moveTimer: 0,
                soundPlayed: false,
                doorTimer: 0
              }
            }
            
            return { ...animatronic, moveTimer: newMoveTimer, doorTimer: 0 }
          })

          // Check for jumpscare (game over if any animatronic at door for >= 80 ticks)
          const atDoorTooLong = updatedAnimatronics.find(a => a.atDoor && (a.doorTimer || 0) >= 80)
          if (atDoorTooLong) {
            return { ...prev, gameState: 'gameOver' }
          }
          
          return { ...prev, animatronics: updatedAnimatronics }
        })
      }, 100)

      return () => {
        if (moveTimerRef.current) clearInterval(moveTimerRef.current)
      }
    }
  }, [gameData.gameState, moveAnimatronic, isBlockedByDoor])

  const startGame = () => {
    initializeNight(1)
  }

  const restartGame = () => {
    setGameData(prev => ({ ...prev, gameState: 'menu' }))
  }

  const toggleDoor = (side: 'left' | 'right') => {
    setGameData(prev => ({
      ...prev,
      [side === 'left' ? 'leftDoorClosed' : 'rightDoorClosed']: 
        !prev[side === 'left' ? 'leftDoorClosed' : 'rightDoorClosed']
    }))
  }

  const switchCamera = (camera: number) => {
    if (camera === 2) {
      toast.error('Camera 2 is not working!')
      return
    }
    setGameData(prev => ({ ...prev, currentCamera: camera }))
  }

  const getCameraView = () => {
    const { currentCamera, animatronics } = gameData
    
    if (currentCamera === 1) {
      const animatronicHere = animatronics.find(a => a.location === 'cam1')
      return (
        <div className="h-64 bg-gray-800 border-2 border-green-400 flex items-center justify-center text-green-400">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">CAM 1 - Hallway</h3>
            {animatronicHere ? (
              <p className="text-red-400 font-bold">{animatronicHere.name} is here!</p>
            ) : (
              <p>Empty</p>
            )}
          </div>
        </div>
      )
    }
    
    if (currentCamera === 3) {
      const animatronicHere = animatronics.find(a => a.location === 'cam3')
      return (
        <div className="h-64 bg-gray-700 border-2 border-green-400 flex items-center justify-center text-green-400">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">CAM 3 - Side Hall</h3>
            {animatronicHere ? (
              <p className="text-red-400 font-bold">{animatronicHere.name} is here!</p>
            ) : (
              <p>Empty</p>
            )}
          </div>
        </div>
      )
    }
    
    if (currentCamera === 4) {
      const animatronicsOnStage = animatronics.filter(a => a.location === 'stage')
      return (
        <div className="h-64 bg-gray-900 border-2 border-green-400 flex items-center justify-center text-green-400">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">CAM 4 - The Stage</h3>
            <div className="flex justify-center space-x-4">
              {animatronicsOnStage.map(animatronic => (
                <div key={animatronic.name} className="text-center">
                  <div className="w-12 h-16 bg-purple-600 rounded border-2 border-purple-400 mb-1"></div>
                  <p className="text-xs">{animatronic.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    
    return null
  }

  const formatTime = (time: number) => {
    const hour = Math.floor(time / 60)
    return `${12 + hour} AM`
  }

  if (gameData.gameState === 'menu') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="p-8 bg-gray-900 border-red-600">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-500 mb-4">Five Nights at Freddy's</h1>
            <h2 className="text-xl text-gray-300 mb-6">Deddy, Gen & Poppy</h2>
            <p className="text-gray-400 mb-8">Survive 5 nights in the security office</p>
            <Button onClick={startGame} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3">
              Start Night {gameData.night}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameData.gameState === 'gameOver') {
    return (
      <div className="min-h-screen bg-red-900 text-white flex items-center justify-center">
        <Card className="p-8 bg-gray-900 border-red-600">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-500 mb-4">GAME OVER</h1>
            <p className="text-gray-300 mb-6">You didn't survive the night...</p>
            <Button onClick={restartGame} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameData.gameState === 'victory') {
    return (
      <div className="min-h-screen bg-green-900 text-white flex items-center justify-center">
        <Card className="p-8 bg-gray-900 border-green-600">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-500 mb-4">YOU WIN!</h1>
            <p className="text-gray-300 mb-6">You survived all 5 nights!</p>
            <Button onClick={restartGame} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3">
              Play Again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-green-600">
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="border-green-400 text-green-400">
            Night {gameData.night}
            {gameData.bossMode && <span className="ml-2 px-2 py-1 rounded bg-red-700 text-white animate-pulse font-extrabold">BOSS NIGHT</span>}
          </Badge>
          <Badge variant="outline" className="border-blue-400 text-blue-400">
            {formatTime(gameData.time)}
          </Badge>
          <Badge variant="outline" className={`border-${gameData.power > 20 ? 'yellow' : 'red'}-400 text-${gameData.power > 20 ? 'yellow' : 'red'}-400`}>
            Power: {gameData.power}%
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCameras(!showCameras)}
            className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
          >
            {showCameras ? <EyeOff size={16} /> : <Eye size={16} />}
            Cameras
          </Button>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Main View */}
        <div className="flex-1 p-4">
          {showCameras ? (
            <div className="space-y-4">
              {/* Camera Controls */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => switchCamera(1)}
                  variant={gameData.currentCamera === 1 ? "default" : "outline"}
                  className="border-green-400 text-green-400"
                >
                  CAM 1
                </Button>
                <Button
                  onClick={() => switchCamera(2)}
                  variant="outline"
                  disabled
                  className="border-red-400 text-red-400 opacity-50"
                >
                  CAM 2 (BROKEN)
                </Button>
                <Button
                  onClick={() => switchCamera(3)}
                  variant={gameData.currentCamera === 3 ? "default" : "outline"}
                  className="border-green-400 text-green-400"
                >
                  CAM 3
                </Button>
                <Button
                  onClick={() => switchCamera(4)}
                  variant={gameData.currentCamera === 4 ? "default" : "outline"}
                  className="border-green-400 text-green-400"
                >
                  CAM 4 (STAGE)
                </Button>
              </div>

              {/* Camera View */}
              {getCameraView()}
            </div>
          ) : (
            <div className="h-64 bg-gray-900 border-2 border-green-400 flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-xl font-bold text-green-400 mb-2">Security Office</h3>
                <p className="text-gray-400">Use cameras to monitor the animatronics</p>
              </div>
            </div>
          )}

          {/* Door Controls */}
          <div className="mt-8 flex justify-between items-center">
            <div className="text-center relative">
              {/* Left Door Animatronic Popup */}
              {gameData.animatronics.some(a => a.location === 'leftDoor') && (
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-red-900 border-2 border-red-400 rounded-lg px-4 py-2 animate-pulse z-10">
                  <div className="text-red-100 font-bold text-lg">
                    {gameData.animatronics.find(a => a.location === 'leftDoor')?.name}
                  </div>
                  <div className="text-red-300 text-xs">AT LEFT DOOR!</div>
                  {/* Arrow pointing down */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-400"></div>
                </div>
              )}
              <p className="text-sm mb-2">Left Door</p>
              <Button
                onClick={() => toggleDoor('left')}
                variant={gameData.leftDoorClosed ? "default" : "outline"}
                className={`${gameData.leftDoorClosed ? 'bg-red-600 text-white' : 'border-green-400 text-green-400'} w-24 h-16`}
              >
                {gameData.leftDoorClosed ? <DoorClosed size={24} /> : <DoorOpen size={24} />}
              </Button>
              <p className="text-xs mt-1 text-gray-400">
                {gameData.leftDoorClosed ? 'CLOSED' : 'OPEN'}
              </p>
            </div>

            <div className="text-center relative">
              {/* Right Door Animatronic Popup */}
              {gameData.animatronics.some(a => a.location === 'rightDoor') && (
                <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-red-900 border-2 border-red-400 rounded-lg px-4 py-2 animate-pulse z-10">
                  <div className="text-red-100 font-bold text-lg">
                    {gameData.animatronics.find(a => a.location === 'rightDoor')?.name}
                  </div>
                  <div className="text-red-300 text-xs">AT RIGHT DOOR!</div>
                  {/* Arrow pointing down */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-400"></div>
                </div>
              )}
              <p className="text-sm mb-2">Right Door</p>
              <Button
                onClick={() => toggleDoor('right')}
                variant={gameData.rightDoorClosed ? "default" : "outline"}
                className={`${gameData.rightDoorClosed ? 'bg-red-600 text-white' : 'border-green-400 text-green-400'} w-24 h-16`}
              >
                {gameData.rightDoorClosed ? <DoorClosed size={24} /> : <DoorOpen size={24} />}
              </Button>
              <p className="text-xs mt-1 text-gray-400">
                {gameData.rightDoorClosed ? 'CLOSED' : 'OPEN'}
              </p>
            </div>
          </div>

          {/* Animatronic Status */}
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4">Animatronic Status</h3>
            <div className="grid grid-cols-3 gap-4">
              {gameData.animatronics.map(animatronic => (
                <Card key={animatronic.name} className="p-3 bg-gray-900 border-purple-600">
                  <h4 className="font-bold text-purple-400">{animatronic.name}</h4>
                  <p className="text-sm text-gray-400">
                    {animatronic.isActive ? `Location: ${animatronic.location}` : 'Inactive'}
                  </p>
                  {animatronic.atDoor && (
                    <p className="text-red-400 text-xs font-bold">AT DOOR!</p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App