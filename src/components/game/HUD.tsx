import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';
import { socket } from '../../lib/socket';

export function HUD() {
  const { status, health, score, cansThrown, wager, playersInfo } = useGameStore();
  const [showScoreboard, setShowScoreboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  if (status !== 'PLAYING') return null;

  // Derive my kills locally or from server
  const myInfo = playersInfo[socket.id];
  const myKills = myInfo?.kills || score;

  // Sort players by kills
  const sortedPlayers = Object.values(playersInfo).sort((a: any, b: any) => (b.kills || 0) - (a.kills || 0));

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="p-6 flex justify-between items-start font-pixel">
        <div className="text-3xl text-monster drop-shadow-[0_2px_0_rgba(0,0,0,1)] uppercase">
          HP: {health}
        </div>
        <div className="text-right">
          <div className="text-3xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,1)]">KILLS: {myKills}</div>
          <div className="text-xl text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)]">POOL: {wager}</div>
          <div className="text-sm text-gray-400 font-mono mt-1">CANS THROWN: {cansThrown}</div>
        </div>
      </div>

      {/* Scoreboard Overlay */}
      {showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <div className="bg-ps-panel border-2 border-gray-700 p-8 rounded-lg min-w-[500px] shadow-2xl">
            <h2 className="text-monster font-pixel text-3xl mb-6 text-center uppercase tracking-widest border-b border-gray-800 pb-4">Match Standings</h2>
            
            <div className="grid grid-cols-4 font-mono text-gray-500 font-bold mb-3 px-4 text-xs">
              <div className="col-span-2">PLAYER</div>
              <div className="text-right text-monster">KILLS</div>
              <div className="text-right text-red-500">DEATHS</div>
            </div>
            
            <div className="flex flex-col gap-2">
              {sortedPlayers.length === 0 && (
                <div className="text-center font-mono text-gray-400 py-4">Waiting for players...</div>
              )}
              {sortedPlayers.map((p: any, index: number) => {
                const isMe = p.id === socket.id;
                return (
                  <div 
                    key={p.id} 
                    className={`grid grid-cols-4 font-mono p-3 rounded items-center ${isMe ? 'bg-gray-800 border border-gray-600 text-white' : 'bg-gray-900 border border-transparent text-gray-300'}`}
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <span className="text-gray-500 w-4">{index + 1}.</span>
                      <span className="truncate" title={p.id}>
                        {isMe ? 'YOU' : `Player_${p.id.substring(0,4)}`}
                      </span>
                    </div>
                    <div className="text-right font-bold text-monster">{p.kills || 0}</div>
                    <div className="text-right font-bold text-red-400">{p.deaths || 0}</div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 text-center text-gray-500 font-mono text-xs">RELEASE [TAB] TO CLOSE</div>
          </div>
        </div>
      )}

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-1.5 h-1.5 bg-monster rounded-full opacity-80 shadow-[0_0_5px_#82ff00]"></div>
        <div className="absolute top-1/2 left-1/2 w-8 h-8 border-2 border-monster/30 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      </div>

      {/* Bottom Bar / Control Hint */}
      <div className="p-6 text-center font-mono text-xs text-white/50">
        [WASD] MOVE • [SPACE] JUMP • [CLICK] THROW • [TAB] SCOREBOARD • [ESC] MENU
      </div>
    </div>
  );
}
