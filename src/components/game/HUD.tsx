import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useGameStore } from '../../store';
import { socket } from '../../lib/socket';
import {
  setMobileJump,
  setMobileLookDelta,
  setMobileMove,
  setMobileThrowHeld,
} from '../../lib/mobileControls';

const STICK_RADIUS = 54;
const KNOB_RADIUS = 22;

function MobileControls() {
  const stickRef = useRef<HTMLDivElement>(null);
  const activeStickPointer = useRef<number | null>(null);
  const activeLookPointer = useRef<number | null>(null);
  const lastLookPoint = useRef<{ x: number; y: number } | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });

  const updateStick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = stickRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.min(STICK_RADIUS, Math.hypot(rawX, rawY));
    const angle = Math.atan2(rawY, rawX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    setStick({ x, y });
    setMobileMove(x / STICK_RADIUS, -y / STICK_RADIUS);
  };

  const resetStick = () => {
    activeStickPointer.current = null;
    setStick({ x: 0, y: 0 });
    setMobileMove(0, 0);
  };

  return (
    <div className="md:hidden pointer-events-none absolute inset-0 z-30 touch-none select-none">
      <div
        className="pointer-events-auto absolute bottom-20 left-5 h-36 w-36 rounded-full border border-white/15 bg-black/35 shadow-2xl backdrop-blur-sm"
        ref={stickRef}
        onPointerDown={(event) => {
          activeStickPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (activeStickPointer.current === event.pointerId) {
            updateStick(event);
          }
        }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
      >
        <div className="absolute inset-5 rounded-full border border-white/10" />
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-monster/70 bg-monster/80 shadow-[0_0_18px_rgba(130,255,0,0.45)]"
          style={{
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))`,
          }}
        />
      </div>

      <div
        className="pointer-events-auto absolute right-0 top-20 h-[calc(100%-13rem)] w-[52%]"
        onPointerDown={(event) => {
          activeLookPointer.current = event.pointerId;
          lastLookPoint.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (activeLookPointer.current !== event.pointerId || !lastLookPoint.current) {
            return;
          }

          setMobileLookDelta(event.clientX - lastLookPoint.current.x, event.clientY - lastLookPoint.current.y);
          lastLookPoint.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          activeLookPointer.current = null;
          lastLookPoint.current = null;
        }}
        onPointerCancel={() => {
          activeLookPointer.current = null;
          lastLookPoint.current = null;
        }}
      />

      <div className="pointer-events-auto absolute bottom-20 right-5 grid grid-cols-2 gap-3">
        <button
          className="h-16 w-16 rounded-full border border-white/15 bg-white/12 font-pixel text-2xl uppercase text-white shadow-2xl backdrop-blur-sm active:bg-white/25"
          onPointerDown={() => setMobileJump(true)}
          onPointerUp={() => setMobileJump(false)}
          onPointerCancel={() => setMobileJump(false)}
        >
          Jump
        </button>
        <button
          className="h-20 w-20 rounded-full border border-monster/60 bg-monster font-pixel text-2xl uppercase text-black shadow-[0_0_22px_rgba(130,255,0,0.35)] active:bg-monster-dark"
          onPointerDown={() => setMobileThrowHeld(true)}
          onPointerUp={() => setMobileThrowHeld(false)}
          onPointerCancel={() => setMobileThrowHeld(false)}
          onPointerLeave={() => setMobileThrowHeld(false)}
        >
          Toss
        </button>
      </div>
    </div>
  );
}

export function HUD() {
  const status = useGameStore((state) => state.status);
  const playersInfo = useGameStore((state) => state.playersInfo);
  const cans = useGameStore((state) => state.cans);
  const throwCharge = useGameStore((state) => state.throwCharge);
  const wager = useGameStore((state) => state.wager);
  const [showScoreboard, setShowScoreboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        setShowScoreboard(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
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

  const myInfo = socket.id ? playersInfo[socket.id] : undefined;
  const sortedPlayers = useMemo(
    () => Object.values(playersInfo).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths)),
    [playersInfo],
  );

  if (status !== 'PLAYING') {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
      <div className="p-4 sm:p-6 flex justify-between items-start font-pixel">
        <div className="rounded border border-white/10 bg-black/45 px-4 py-3 shadow-xl backdrop-blur-sm">
          <div className="text-4xl text-monster drop-shadow-[0_2px_0_rgba(0,0,0,1)] uppercase leading-none">
            {myInfo?.health ?? 0} HP
          </div>
          <div className="text-[11px] font-mono text-white/50 mt-2 uppercase tracking-[0.18em]">
            LAST MAN STANDING
          </div>
        </div>

        <div className="rounded border border-white/10 bg-black/45 px-4 py-3 text-right shadow-xl backdrop-blur-sm">
          <div className="text-4xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,1)] leading-none">
            {myInfo?.kills ?? 0} K
          </div>
          <div className="text-2xl text-yellow-300 drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
            {wager === 'FREE' ? 'FREE ROOM' : wager}
          </div>
          <div className="text-[11px] text-white/45 font-mono mt-1 uppercase tracking-[0.18em]">
            ACTIVE CANS: {cans.length}
          </div>
          {!myInfo?.alive && (
            <div className="text-sm text-red-400 font-mono mt-2">
              ELIMINATED
            </div>
          )}
        </div>
      </div>

      {showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <div className="bg-black/70 border border-white/15 p-6 sm:p-8 rounded min-w-[min(500px,calc(100vw-2rem))] shadow-2xl">
            <h2 className="text-monster font-pixel text-4xl mb-6 text-center uppercase tracking-widest border-b border-white/10 pb-4">
              Match Standings
            </h2>

            <div className="grid grid-cols-5 font-mono text-gray-500 font-bold mb-3 px-4 text-xs">
              <div className="col-span-2">PLAYER</div>
              <div className="text-right text-monster">KILLS</div>
              <div className="text-right text-red-500">DEATHS</div>
              <div className="text-right text-white/70">HP</div>
            </div>

            <div className="flex flex-col gap-2">
              {sortedPlayers.length === 0 && (
                <div className="text-center font-mono text-gray-400 py-4">Waiting for players...</div>
              )}
              {sortedPlayers.map((player, index) => {
                const isMe = player.id === socket.id;
                return (
                  <div
                    key={player.id}
                    className={`grid grid-cols-5 font-mono p-3 rounded items-center ${isMe ? 'bg-monster/10 border border-monster/40 text-white' : 'bg-white/[0.06] border border-transparent text-gray-300'}`}
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <span className="text-gray-500 w-4">{index + 1}.</span>
                      <span className="truncate" title={player.id}>
                        {isMe ? 'YOU' : `Player_${player.id.substring(0, 4)}`}
                      </span>
                    </div>
                    <div className="text-right font-bold text-monster">{player.kills}</div>
                    <div className="text-right font-bold text-red-400">{player.deaths}</div>
                    <div className="text-right font-bold text-white/80">{player.health}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center text-gray-500 font-mono text-xs">
              RELEASE [TAB] TO CLOSE
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-1.5 h-1.5 bg-monster rounded-full opacity-80 shadow-[0_0_5px_#82ff00]" />
        <div className="absolute top-1/2 left-1/2 w-8 h-8 border-2 border-monster/30 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className={`absolute left-1/2 top-8 h-1.5 w-28 -translate-x-1/2 overflow-hidden rounded-full border border-white/20 bg-black/55 transition-opacity ${throwCharge > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="h-full bg-monster shadow-[0_0_10px_rgba(130,255,0,0.85)]"
            style={{ width: `${Math.round(throwCharge * 100)}%` }}
          />
        </div>
      </div>

      <MobileControls />

      <div className="p-4 sm:p-6 text-center">
        <div className="mx-auto hidden rounded border border-white/10 bg-black/45 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 backdrop-blur-sm md:inline-flex">
          WASD MOVE / SPACE JUMP / HOLD CLICK THROW / TAB BOARD / ESC EXIT
        </div>
      </div>
    </div>
  );
}
