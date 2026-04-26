import { lazy, Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeDollarSign,
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Gamepad2,
  MapPinned,
  Play,
  RadioTower,
  Trophy,
  Users,
} from 'lucide-react';
import { KILLS_TO_WIN } from './gameTypes';
import { disconnectSocket, ensureSocketConnected, socket } from './lib/socket';
import { useGameStore } from './store';

const GameExperience = lazy(() => import('./components/game/GameExperience'));

const titleHero = '/assets/game/title-hero.png';
const parkSign = '/assets/game/blank-park-sign.png';
const canSprite = '/assets/game/can-projectile.png';
const uncTokenAddress = 'ACtfUWtgvaXrQGNMiohTusi5jcx5RJf5zwu9aAxkpump';
const uncDexscreenerUrl = 'https://dexscreener.com/solana/bwfzkx1pmpvwxammwtrizvowzzzgifeyuyw6ee51shly';

const uncSprites = [
  '/UNC-FRONT 0 .png',
  '/UNC-25-degree-turn.png',
  '/UNC-side-view.png',
  '/UNC-backside-slightly right turn view.png',
  '/UNC-direct-backside-view.png',
  '/UNC-backside-slightly-left-turn-view.png',
  '/UNC-opposite-side-view.png',
  '/UNC-270-degree-turn.png',
];

const wagerTiers = [
  { label: 'Free', value: 'FREE', caption: 'Practice room' },
  { label: '100 UNC', value: '100 $UNC', caption: 'Low stakes' },
  { label: '500 UNC', value: '500 $UNC', caption: 'Standard' },
  { label: '1K UNC', value: '1,000 $UNC', caption: 'Hot table' },
  { label: '5K UNC', value: '5,000 $UNC', caption: 'High stakes' },
];

type MenuView = 'START' | 'LOBBY';

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img src={canSprite} alt="" className="h-12 w-12 object-contain drop-shadow-[0_0_18px_rgba(130,255,0,0.45)]" />
      <div>
        <div className="font-pixel text-3xl uppercase leading-none text-monster">Unc's Tossup</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/50">Multiplayer Can Duel</div>
      </div>
    </div>
  );
}

function UniversalNav({
  currentView,
  onStart,
  onLobby,
}: {
  currentView: MenuView | 'GAME' | 'RESULT';
  onStart?: () => void;
  onLobby?: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <BrandMark />
      <nav className="hidden items-center gap-2 rounded border border-white/10 bg-black/35 px-2 py-2 backdrop-blur sm:flex">
        <button
          onClick={onStart}
          disabled={!onStart}
          className={`rounded px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] transition ${currentView === 'START' ? 'bg-monster text-black' : 'text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-35'}`}
        >
          Start
        </button>
        <button
          onClick={onLobby}
          disabled={!onLobby}
          className={`rounded px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] transition ${currentView === 'LOBBY' ? 'bg-monster text-black' : 'text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-35'}`}
        >
          Lobby
        </button>
        <a
          href={uncDexscreenerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-white/65 transition hover:bg-white/10 hover:text-monster"
        >
          $UNC
          <ExternalLink size={13} />
        </a>
      </nav>
      <div className="hidden items-center gap-2 rounded border border-monster/25 bg-black/35 px-3 py-2 font-mono text-xs uppercase text-monster backdrop-blur md:flex">
        <RadioTower size={15} />
        Online Arena
      </div>
    </header>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-monster">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-monster/20" />
        <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-monster border-r-monster shadow-[0_0_22px_rgba(130,255,0,0.45)]" />
        <img src={canSprite} alt="" className="h-20 w-20 object-contain drop-shadow-[0_0_20px_rgba(130,255,0,0.65)]" />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-white/15 bg-black/35 px-3 py-2 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">{label}</div>
      <div className="break-words font-pixel text-xl uppercase leading-none text-white sm:text-2xl">{value}</div>
    </div>
  );
}

function TokenStrip({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uncTokenAddress);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = uncTokenAddress;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCopy();
        }
      }}
      className={`group w-full rounded border text-left backdrop-blur transition ${copied ? 'border-monster bg-monster/15 shadow-[0_0_22px_rgba(130,255,0,0.25)]' : 'border-monster/25 bg-black/40 hover:border-monster/60 hover:bg-black/55'} ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
      title="Copy $UNC token address"
    >
      <div className="mb-1 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 font-mono text-[10px] uppercase tracking-[0.22em] text-monster">$UNC Token</div>
        <span className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] transition ${copied ? 'text-monster' : 'text-white/55 group-hover:text-white'}`}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </span>
      </div>
      <div className="break-all font-mono text-[11px] leading-5 text-white/60">{uncTokenAddress}</div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
          Tap to copy
        </span>
        <a
          href={uncDexscreenerUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="pointer-events-auto inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:text-monster"
        >
          {compact ? 'DEX' : 'View on Dexscreener'}
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function LandingSpriteShowcase() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState({ octant: 0, tiltX: 0, tiltY: 0 });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const angle = Math.atan2(dx, dy);
      const octant = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
      const tiltY = Math.max(-14, Math.min(14, (dx / Math.max(1, rect.width / 2)) * 14));
      const tiltX = Math.max(-9, Math.min(9, (-dy / Math.max(1, rect.height / 2)) * 9));

      setPose({ octant, tiltX, tiltY });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute left-1/2 top-[47%] z-10 hidden h-[31rem] w-[23rem] -translate-x-1/2 -translate-y-1/2 lg:block"
      style={{ perspective: '900px' }}
    >
      <div className="absolute bottom-16 left-1/2 h-20 w-56 -translate-x-1/2 rounded-full bg-black/55 blur-xl" />
      <div
        className="absolute inset-0 flex items-end justify-center transition-transform duration-100 ease-out"
        style={{
          transform: `rotateX(${pose.tiltX}deg) rotateY(${pose.tiltY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <img
          src={uncSprites[pose.octant]}
          alt=""
          className="h-full max-h-[31rem] w-auto object-contain drop-shadow-[0_16px_18px_rgba(0,0,0,0.75)]"
          draggable={false}
        />
      </div>
    </div>
  );
}

function StartScreen({ onEnterLobby }: { onEnterLobby: () => void }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(7,8,6,0.88) 0%, rgba(7,8,6,0.48) 42%, rgba(7,8,6,0.2) 100%), url("${titleHero}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_25%_45%,rgba(130,255,0,0.16),transparent_34%),linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.72)_100%)]" />
      <LandingSpriteShowcase />
      <main className="relative z-20 flex min-h-screen max-w-7xl flex-col justify-between px-5 py-5 sm:px-8 lg:px-12">
        <UniversalNav currentView="START" onLobby={onEnterLobby} />

        <section className="w-full max-w-full pb-12 pt-16 sm:max-w-3xl sm:pb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded border border-white/15 bg-black/35 px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur">
            <Crosshair size={14} className="text-monster" />
            First to {KILLS_TO_WIN} kills takes the park
          </div>
          <h1 className="font-pixel text-[4.55rem] uppercase leading-[0.78] text-white drop-shadow-[0_5px_0_rgba(0,0,0,0.75)] sm:text-[7rem] lg:text-[9rem]">
            Unc's
            <span className="block text-monster">Tossup</span>
          </h1>
          <p className="mt-6 w-full max-w-full break-words font-mono text-sm leading-7 text-white/72 sm:max-w-xl sm:text-base">
            <span className="block">Load into the trailer park.</span>
            <span className="block">Dodge the crossfire.</span>
            <span className="block">Settle the match with a pocket full of cans.</span>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onEnterLobby}
              className="inline-flex items-center justify-center gap-3 rounded bg-monster px-6 py-4 font-pixel text-3xl uppercase leading-none text-black transition hover:bg-monster-dark"
            >
              <Play fill="currentColor" size={24} />
              Enter Lobby
            </button>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:w-[22rem]">
              <StatPill label="Mode" value="FFA" />
              <StatPill label="Token" value="$UNC" />
              <StatPill label="Build" value="V1" />
            </div>
          </div>
          <div className="mt-4 max-w-xl lg:hidden">
            <TokenStrip compact />
          </div>
        </section>
        <div className="absolute bottom-[5.25rem] right-12 hidden w-[28rem] lg:block">
          <TokenStrip compact />
        </div>
      </main>
    </div>
  );
}

function LobbyScreen({ onBack, onStartGame }: { onBack: () => void; onStartGame: () => void }) {
  const playersInfo = useGameStore((state) => state.playersInfo);
  const wager = useGameStore((state) => state.wager);
  const setWager = useGameStore((state) => state.setWager);
  const players = useMemo(() => Object.values(playersInfo), [playersInfo]);

  return (
    <div className="min-h-screen bg-[#15120f] text-white">
      <div
        className="min-h-screen bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,8,6,0.82), rgba(10,8,6,0.95)), url("${titleHero}")`,
        }}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-12">
          <UniversalNav currentView="LOBBY" onStart={onBack} />

          <main className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="relative isolate max-w-xl py-8 lg:px-10">
                <img
                  src={parkSign}
                  alt=""
                  className="pointer-events-none absolute -left-10 -top-16 z-0 hidden w-[34rem] rotate-[-2deg] opacity-95 lg:block"
                />
                <h1 className="relative z-10 font-pixel text-6xl uppercase leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.65)] sm:text-8xl">
                  Trailer Park
                  <span className="block text-monster">Throwdown</span>
                </h1>
                <p className="relative z-10 mt-5 max-w-md font-mono text-sm leading-7 text-white/78">
                  Pick a free table or load a $UNC wager room before you step into the park.
                </p>
              </div>

              <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-3">
                <div className="rounded border border-white/12 bg-white/[0.06] p-4">
                  <MapPinned className="mb-3 text-monster" size={22} />
                  <div className="font-pixel text-3xl uppercase">Trailer Lane</div>
                  <div className="font-mono text-xs text-white/45">150m fenced arena</div>
                </div>
                <div className="rounded border border-white/12 bg-white/[0.06] p-4">
                  <BadgeDollarSign className="mb-3 text-yellow-300" size={22} />
                  <div className="font-pixel text-3xl uppercase">$UNC</div>
                  <div className="font-mono text-xs text-white/45">Free to high-stakes rooms</div>
                </div>
                <div className="rounded border border-white/12 bg-white/[0.06] p-4">
                  <Trophy className="mb-3 text-monster" size={22} />
                  <div className="font-pixel text-3xl uppercase">{KILLS_TO_WIN} Kills</div>
                  <div className="font-mono text-xs text-white/45">Win condition</div>
                </div>
              </div>

              <div className="mt-3 max-w-2xl">
                <TokenStrip />
              </div>
            </section>

            <aside className="rounded border border-white/12 bg-black/45 p-5 shadow-2xl backdrop-blur-md">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="font-pixel text-4xl uppercase text-white">Ready Room</div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Players sync after connect</div>
                </div>
                <Users className="text-monster" size={28} />
              </div>

              <div className="space-y-2">
                {players.length === 0 && (
                  <div className="rounded border border-dashed border-white/15 bg-white/[0.04] px-4 py-5 text-center font-mono text-sm text-white/45">
                    No active players yet
                  </div>
                )}
                {players.slice(0, 6).map((player) => (
                  <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded border border-white/10 bg-white/[0.06] px-4 py-3 font-mono text-sm">
                    <span className="truncate">{player.id === socket.id ? 'YOU' : `Player_${player.id.slice(0, 4)}`}</span>
                    <span className="text-monster">K {player.kills}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-pixel text-3xl uppercase text-white">Wager Room</div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Betting token: $UNC</div>
                  </div>
                  <BadgeDollarSign className="text-yellow-300" size={26} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {wagerTiers.map((tier) => {
                    const selected = tier.value === wager;
                    return (
                      <button
                        key={tier.value}
                        onClick={() => setWager(tier.value)}
                        className={`rounded border px-3 py-3 text-left transition ${selected ? 'border-monster bg-monster/15 text-white' : 'border-white/10 bg-white/[0.05] text-white/70 hover:border-white/25 hover:text-white'}`}
                      >
                        <div className="font-pixel text-2xl uppercase leading-none">{tier.label}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{tier.caption}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={onStartGame}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded bg-monster px-6 py-4 font-pixel text-3xl uppercase leading-none text-black transition hover:bg-monster-dark"
              >
                <Gamepad2 size={24} />
                Play {wager === 'FREE' ? 'Free' : wager}
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
                <div className="rounded border border-white/10 px-3 py-2">WASD Move</div>
                <div className="rounded border border-white/10 px-3 py-2">Click Throw</div>
                <div className="rounded border border-white/10 px-3 py-2">Tab Board</div>
                <div className="rounded border border-white/10 px-3 py-2">Esc Exit</div>
              </div>
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}

function ResultScreen() {
  const playersInfo = useGameStore((state) => state.playersInfo);
  const result = useGameStore((state) => state.matchResult);
  const reset = useGameStore((state) => state.reset);

  const sortedPlayers = useMemo(
    () => Object.values(playersInfo).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths)),
    [playersInfo],
  );
  const winner = result?.winnerId ? playersInfo[result.winnerId] : null;

  const handleReturnToLobby = () => {
    disconnectSocket();
    reset();
  };

  return (
    <div
      className="min-h-screen bg-black bg-cover bg-center px-5 py-8 text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.82), rgba(0,0,0,0.92)), url("${titleHero}")`,
      }}
    >
      <div className="mx-auto max-w-7xl">
        <UniversalNav currentView="RESULT" onLobby={handleReturnToLobby} />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <div className="w-full rounded border border-white/12 bg-black/60 p-6 shadow-2xl backdrop-blur-md md:p-10">
          <div className="mb-6 flex items-center gap-3 text-monster">
            <Trophy size={36} />
            <h1 className="font-pixel text-5xl uppercase leading-none">Match Result</h1>
          </div>

          <div className="mb-2 font-mono text-lg text-white">
            {winner ? `${winner.id === socket.id ? 'You' : `Player_${winner.id.slice(0, 4)}`} won the toss-up.` : 'Match ended.'}
          </div>
          <div className="mb-8 font-mono text-sm uppercase tracking-widest text-white/45">
            {result?.reason ?? 'escape'} - first to {KILLS_TO_WIN} kills
          </div>

          <div className="mb-8 space-y-3">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`grid grid-cols-4 gap-4 rounded border px-4 py-3 font-mono ${player.id === result?.winnerId ? 'border-monster/50 bg-monster/10' : 'border-white/10 bg-white/[0.05]'}`}
              >
                <div>{index + 1}. {player.id === socket.id ? 'YOU' : `Player_${player.id.slice(0, 4)}`}</div>
                <div className="text-right">K {player.kills}</div>
                <div className="text-right">D {player.deaths}</div>
                <div className="text-right">HP {player.health}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleReturnToLobby}
            className="inline-flex items-center justify-center rounded bg-monster px-6 py-3 font-pixel text-2xl uppercase text-black transition hover:bg-monster-dark"
          >
            Back To Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [menuView, setMenuView] = useState<MenuView>('START');
  const status = useGameStore((state) => state.status);
  const startGame = useGameStore((state) => state.startGame);
  const endGame = useGameStore((state) => state.endGame);

  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && useGameStore.getState().status === 'PLAYING') {
        disconnectSocket();
        endGame({
          winnerId: null,
          reason: 'escape',
          endedAt: Date.now(),
        });
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [endGame]);

  const handleStartGame = () => {
    ensureSocketConnected();
    startTransition(() => {
      startGame();
    });

    setTimeout(() => {
      document.body.requestPointerLock?.();
    }, 100);
  };

  if (status === 'PLAYING') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <GameExperience />
      </Suspense>
    );
  }

  if (status === 'RESULT') {
    return <ResultScreen />;
  }

  if (menuView === 'START') {
    return <StartScreen onEnterLobby={() => setMenuView('LOBBY')} />;
  }

  return <LobbyScreen onBack={() => setMenuView('START')} onStartGame={handleStartGame} />;
}
