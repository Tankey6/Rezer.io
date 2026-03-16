import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Game } from './game/Game';
import { TankPreview } from './components/TankPreview';
import { UpgradeTree } from './components/UpgradeTree';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<any>({ leaderboard: [] });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isTitleScreen, setIsTitleScreen] = useState(true);
  const [isSpawning, setIsSpawning] = useState(false);
  const [deathInfo, setDeathInfo] = useState<any>(null);
  const [tankName, setTankName] = useState('');
  const [showUpgradeTree, setShowUpgradeTree] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key.toLowerCase() === 't') {
        setShowUpgradeTree(prev => !prev);
      }
      if (e.key.toLowerCase() === 'l') {
        setShowLeaderboard(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current);
    gameRef.current = game;

    const handleResize = () => {
      game.resize(window.innerWidth, window.innerHeight);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('resize', handleResize);
    canvasRef.current.addEventListener('contextmenu', handleContextMenu);
    handleResize();

    game.onStateChange = (state) => {
      setGameState(state);
    };

    game.onGameOver = (info) => {
      setDeathInfo(info);
      setIsSpawning(false);
      if (gameRef.current) {
        gameRef.current.cameraTargetId = info.killerId;
      }
    };

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      canvasRef.current?.removeEventListener('contextmenu', handleContextMenu);
      game.stop();
    };
  }, []);

  const handleSpawn = () => {
    if (gameRef.current) {
      if (!gameRef.current.ws || gameRef.current.ws.readyState !== WebSocket.OPEN) {
        gameRef.current.connect();
      }
      const level = deathInfo ? Math.max(1, Math.floor(deathInfo.level / 2)) : 1;
      gameRef.current.spawn(tankName || 'Unnamed Tank', level);
      gameRef.current.start();
      setIsTitleScreen(false);
      setIsSpawning(true);
      setDeathInfo(null);
      gameRef.current.cameraTargetId = null;
    }
  };

  const handleUpgrade = (stat: string) => {
    if (gameRef.current) {
      gameRef.current.upgradeStat(stat as any);
    }
  };

  const restartGame = () => {
    if (gameRef.current) {
      gameRef.current.stop();
    }
    setIsTitleScreen(true);
    setGameState({ leaderboard: [] });
    
    if (canvasRef.current) {
      const game = new Game(canvasRef.current);
      gameRef.current = game;
      game.resize(window.innerWidth, window.innerHeight);
      game.onStateChange = setGameState;
    }
  };

  const statColors: Record<string, string> = {
    healthRegen: '#e8b08d',
    maxHealth: '#e88ce6',
    bodyDamage: '#998ce8',
    bulletSpeed: '#8cb4e8',
    bulletPenetration: '#e8e68c',
    bulletDamage: '#e88c8c',
    reload: '#8ce8b4',
    movementSpeed: '#8ce8e6'
  };

  const statLabels: Record<string, string> = {
    healthRegen: 'Health Regen',
    maxHealth: 'Max Health',
    bodyDamage: 'Body Damage',
    bulletSpeed: 'Bullet Speed',
    bulletPenetration: 'Bullet Penetration',
    bulletDamage: 'Bullet Damage',
    reload: 'Reload',
    movementSpeed: 'Movement Speed'
  };

  const [showClassUpgrades, setShowClassUpgrades] = useState(true);
  const prevPendingUpgrades = useRef<string>('');

  useEffect(() => {
    if (gameState) {
      const currentUpgrades = gameState.pendingUpgrades?.join(',') || '';
      if (currentUpgrades !== prevPendingUpgrades.current) {
        if (currentUpgrades !== '') {
          setShowClassUpgrades(true);
        }
        prevPendingUpgrades.current = currentUpgrades;
      }
    }
  }, [gameState?.pendingUpgrades]);

  // Check if mouse is in the bottom left area
  const isHoveringMenuArea = mousePos.x < 300 && mousePos.y > window.innerHeight - 300;
  
  const allStatsMaxed = gameState?.stats ? Object.values(gameState.stats).every((val: any) => val >= (gameState?.level >= 80 ? 14 : 7)) : false;
  const showUpgrades = gameState && !allStatsMaxed && (gameState.skillPoints > 0 || isHoveringMenuArea);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#cdcdcd] font-sans select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
      />

      {/* Sliding Leaderboard */}
      {gameState?.leaderboard && (
        <div 
          className={`absolute top-1/2 -translate-y-1/2 flex items-center z-[60] transition-transform duration-300 ease-in-out ${showLeaderboard ? 'translate-x-0' : 'translate-x-[192px]'} right-0`}
          style={{ pointerEvents: 'none' }}
        >
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="bg-[#444] hover:bg-[#555] text-white p-2 rounded-l-md pointer-events-auto transition-colors border-2 border-r-0 border-white/40 h-12 w-10 flex items-center justify-center cursor-pointer shadow-[-2px_0_10px_rgba(0,0,0,0.5)]"
            title="Toggle Leaderboard (L)"
          >
            {showLeaderboard ? <ChevronRight size={24} strokeWidth={3} /> : <ChevronLeft size={24} strokeWidth={3} />}
          </button>
          <div className="bg-black/80 backdrop-blur-lg border-2 border-white/30 rounded-l-none p-3 text-left pointer-events-auto w-[192px] text-white shadow-2xl h-auto min-h-[100px]">
            <div className="text-center mb-2 border-b-2 border-white/20 pb-1 font-bold text-sm tracking-wider">LEADERBOARD</div>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {gameState.leaderboard.length > 0 ? (
              gameState.leaderboard.map((entry: any, index: number) => (
                <div key={index} className={`flex justify-between text-xs py-1 ${entry.isPlayer ? 'text-[#00b2e1] font-bold' : 'text-white/80'}`}>
                  <span className="truncate pr-2">{entry.name}</span>
                  <span>{Math.floor(entry.score)}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-white/50 text-center py-2">No entries yet</div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {isTitleScreen && (
        <div className="absolute inset-0 bg-[#cdcdcd] flex items-center justify-center flex-col gap-6 z-50">
          {/* Background grid pattern */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#999 1px, transparent 1px), linear-gradient(90deg, #999 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
          
          <div className="relative z-10 flex flex-col items-center gap-8 bg-black/10 p-12 rounded-3xl backdrop-blur-sm border border-white/20 shadow-2xl">
            <h1 
              className="text-7xl text-white mb-2 tracking-wider" 
              style={{ 
                fontFamily: "'Stalinist One', cursive",
                textShadow: '0 4px 0 #0089ad, 0 8px 0 #005c75, 0 12px 20px rgba(0,0,0,0.5)'
              }}
            >
              Rezer.io
            </h1>
            
            <div className="flex flex-col gap-4 w-full max-w-md">
              <input 
                type="text" 
                placeholder="Enter Tank Name" 
                value={tankName} 
                onChange={(e) => setTankName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSpawn()}
                className="w-full px-6 py-4 rounded-xl text-2xl text-center bg-white/90 border-4 border-[#555] focus:border-[#00b2e1] focus:outline-none transition-colors shadow-inner font-bold text-[#333] placeholder:text-[#999]"
                maxLength={15}
              />
              <button
                onClick={handleSpawn}
                className="w-full px-8 py-4 bg-[#00b2e1] text-white font-bold rounded-xl text-3xl hover:bg-[#0096be] transition-all shadow-[0_6px_0_#0089ad] hover:shadow-[0_2px_0_#0089ad] hover:translate-y-[4px] active:shadow-none active:translate-y-[6px]"
              >
                Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spawning Message */}
      {isSpawning && !gameState?.isSpawned && !isTitleScreen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-white text-2xl font-bold animate-pulse">Connecting to server...</div>
        </div>
      )}

      {/* UI Overlay */}
      {gameState && !isTitleScreen && (
        <>
          {/* Top Left - Class Upgrades */}
          {gameState.pendingUpgrades && gameState.pendingUpgrades.length > 0 && showClassUpgrades && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-white font-bold drop-shadow-md animate-pulse">
                  Class Upgrade Available!
                </div>
                <button 
                  onClick={() => setShowClassUpgrades(false)}
                  className="text-white text-xs bg-black/30 hover:bg-black/50 px-2 py-1 rounded cursor-pointer pointer-events-auto"
                >
                  Hide
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-w-md">
                {gameState.pendingUpgrades.map((tankClass: string) => (
                  <button
                    key={tankClass}
                    onClick={() => gameRef.current?.upgradeClass(tankClass as any)}
                    className="w-24 h-24 bg-[#00b2e1] hover:bg-[#0096be] text-white font-bold rounded shadow-md border-2 border-[#0089ad] transition-colors flex flex-col items-center justify-center p-1 group"
                  >
                    <TankPreview tankClass={tankClass as any} size={60} />
                    <div className="w-full overflow-hidden mt-1">
                      <span className={`text-xs text-center inline-block w-full ${tankClass.length > 12 ? 'group-hover:animate-scroll-text' : ''}`}>{tankClass}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Bar - Score/Level */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="w-64 h-6 bg-[#555555] rounded-full overflow-hidden border-2 border-[#555555] relative flex items-center justify-center">
              <div 
                className="absolute left-0 top-0 h-full bg-[#ffe869] transition-all duration-200"
                style={{ width: `${((gameState.xp || 0) / (gameState.xpNeeded || 100)) * 100}%` }}
              />
              <span className="relative z-10 text-white text-xs font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                {Math.floor(gameState.xp || 0)} / {gameState.xpNeeded || 100}
              </span>
            </div>
            <div className="text-white text-2xl font-bold drop-shadow-md mt-1">
              Level {gameState.level} {gameState.tankClass}
            </div>
          </div>

          {/* Bottom Left - Upgrades */}
          <div 
            className={`absolute bottom-4 left-4 flex flex-col gap-1 transition-transform duration-300 ease-in-out ${
              showUpgrades ? 'translate-x-0' : '-translate-x-[150%]'
            }`}
          >
            {gameState.skillPoints > 0 && (
              <div className="text-white font-bold mb-2 drop-shadow-md">
                x{gameState.skillPoints} Stats
              </div>
            )}
            {Object.entries(statLabels).map(([key, label], index) => {
              const level = gameState.stats?.[key] || 0;
              const isSmasherBranch = [
                'Smasher', 'AutoSmasher', 'Landmine', 'Spike'
              ].includes(gameState.tankClass);
              
              // Smasher, Landmine, Spike don't have bullet stats
              const isBulletStat = ['bulletSpeed', 'bulletPenetration', 'bulletDamage', 'reload'].includes(key);
              if (isBulletStat && ['Smasher', 'Landmine', 'Spike'].includes(gameState.tankClass)) {
                return null;
              }
              
              const maxLevel = isSmasherBranch ? 10 : 7;
              const canUpgrade = (gameState.skillPoints || 0) > 0 && level < maxLevel;

              return (
                <div key={key} className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={!canUpgrade}
                    className={`w-6 h-6 rounded flex items-center justify-center text-white font-bold text-lg leading-none pb-1 transition-colors ${
                      canUpgrade ? 'bg-[#555555] hover:bg-[#777777] cursor-pointer' : 'bg-[#555555]/50 cursor-not-allowed text-transparent'
                    }`}
                  >
                    +
                  </button>
                  <div className="flex-1 w-48 h-6 bg-[#555555] rounded relative overflow-hidden flex items-center px-2">
                    <div 
                      className="absolute left-0 top-0 bottom-0 transition-all duration-200"
                      style={{ 
                        width: `${(Math.min(level, 7) / 7) * 100}%`,
                        backgroundColor: statColors[key]
                      }}
                    />
                    {level > 7 && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 transition-all duration-200"
                        style={{ 
                          width: `${((level - 7) / 7) * 100}%`,
                          backgroundColor: 'rgba(255, 255, 255, 0.3)'
                        }}
                      />
                    )}
                    <span className="relative z-10 text-white text-xs font-bold drop-shadow-md flex justify-between w-full">
                      <span>{label} {level > 7 ? `7 (+${level - 7})` : ''}</span>
                      <span className="opacity-70">[{index + 1}]</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Right - Status */}
          <div className="absolute top-4 right-4 text-white font-bold text-right drop-shadow-md pointer-events-none">
            <div>Auto Fire: {gameState.autoFire ? 'ON' : 'OFF'} (E)</div>
            <div>Auto Spin: {gameState.autoSpin ? 'ON' : 'OFF'} (C)</div>
            {gameState.pendingUpgrades && gameState.pendingUpgrades.length > 0 && !showClassUpgrades && (
              <button 
                onClick={() => setShowClassUpgrades(true)} 
                className="mt-2 text-xs bg-[#00b2e1] hover:bg-[#0096be] px-3 py-2 rounded cursor-pointer pointer-events-auto transition-colors block ml-auto"
              >
                Show Upgrades
              </button>
            )}
            <button 
              onClick={() => setShowUpgradeTree(true)} 
              className="mt-2 text-xs bg-black/30 hover:bg-black/50 px-3 py-2 rounded cursor-pointer pointer-events-auto transition-colors"
            >
              View Upgrade Tree
            </button>
          </div>
        </>
      )}

      {/* Game Over Screen */}
      {deathInfo && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-4">
          <h1 className="text-4xl text-white font-bold">Game Over</h1>
          <TankPreview tankClass={deathInfo.tankClass} size={120} />
          <div className="text-white text-xl">
            Level {deathInfo.level} {deathInfo.tankClass}
          </div>
          <div className="text-white text-lg">
            Survived for {Math.floor(deathInfo.survivalTime / 60)}m {Math.floor(deathInfo.survivalTime % 60)}s
          </div>
          <div className="text-white text-lg">
            Killed by: {deathInfo.killedBy}
          </div>
          <button
            onClick={handleSpawn}
            className="px-8 py-4 bg-[#00b2e1] text-white font-bold rounded-lg text-xl hover:bg-[#0096be] transition-colors shadow-lg"
          >
            Respawn
          </button>
        </div>
      )}

      {/* Upgrade Tree Overlay */}
      {showUpgradeTree && (
        <UpgradeTree onClose={() => setShowUpgradeTree(false)} />
      )}
    </div>
  );
  
}
