import { lazy, Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeDollarSign,
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Gamepad2,
  Lock,
  MapPinned,
  Play,
  RadioTower,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { HOUSE_FEE_RATE } from './gameTypes';
import {
  getMusicSettings,
  playLobbyJoinPing,
  playMatchStartAlert,
  setMusicMuted,
  setMusicVolume,
  startLobbyMusic,
  stopGameAmbience,
  subscribeMusicSettings,
} from './lib/audio';
import { disconnectSocket, ensureSocketConnected, socket } from './lib/socket';
import type { EntryPaymentResult, PaymentConfig } from './paymentTypes';
import { useGameStore } from './store';

const GameExperience = lazy(() => import('./components/game/GameExperience'));

const titleHero = '/assets/game/title-hero.png';
const blankParkSign = '/assets/game/blank-park-sign.png';
const navCanLogo = '/assets/game/nav-can-logo.png';
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

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signAndSendTransaction?: (transaction: unknown) => Promise<{ signature: string }>;
  signTransaction?: (transaction: unknown) => Promise<{ serialize: () => Uint8Array }>;
  disconnect?: () => Promise<void>;
};

type WalletProfile = {
  walletAddress: string | null;
  username: string;
  pfp: string;
};

const defaultProfile: WalletProfile = {
  walletAddress: null,
  username: 'Unc Rookie',
  pfp: '🥫',
};

const pfpOptions = ['🥫', '🐔', '🌲', '🪑', '🏚️', '💸'];

const wagerTiers = [
  { label: 'Free', value: 'FREE', caption: 'Practice room', buyIn: 'No stake', pace: 'Warmup', maxPlayers: 8 },
  { label: '100 UNC', value: '100 $UNC', caption: 'Low stakes', buyIn: '100 $UNC', pace: 'Casual', maxPlayers: 8 },
  { label: '500 UNC', value: '500 $UNC', caption: 'Standard', buyIn: '500 $UNC', pace: 'Serious', maxPlayers: 8 },
  { label: '1K UNC', value: '1,000 $UNC', caption: 'Hot table', buyIn: '1,000 $UNC', pace: 'High pressure', maxPlayers: 8 },
  { label: '5K UNC', value: '5,000 $UNC', caption: 'High stakes', buyIn: '5,000 $UNC', pace: 'Final table', maxPlayers: 8 },
];

function parseBuyInUnc(value: string) {
  if (value === 'FREE') {
    return 0;
  }

  const numeric = Number(value.replace(/[$,UNC\s]/gi, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatUnc(value: number) {
  return value === 0 ? '0 $UNC' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} $UNC`;
}

function uncToBaseUnits(value: number, decimals: number) {
  const fixed = value.toFixed(decimals);
  const [whole, fraction = ''] = fixed.split('.');
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
}

function socketEmitWithAck<T>(event: string, payload?: unknown) {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function profileStorageKey(walletAddress: string | null) {
  return `unc-tossup-profile:${walletAddress ?? 'guest'}`;
}

function getSolanaProvider() {
  return (window as typeof window & { solana?: SolanaProvider }).solana;
}

type MenuView = 'START' | 'LOBBY';
type LobbyNotice = { tone: 'info' | 'warning' | 'success'; message: string } | null;

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img src={navCanLogo} alt="" className="h-12 w-12 object-contain drop-shadow-[0_0_18px_rgba(130,255,0,0.45)]" />
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
  profile,
  onConnectWallet,
}: {
  currentView: MenuView | 'GAME' | 'RESULT';
  onStart?: () => void;
  onLobby?: () => void;
  profile: WalletProfile;
  onConnectWallet: () => void;
}) {
  return (
    <header className="relative z-30 w-full border-b border-white/12 bg-black/80 shadow-[0_10px_32px_rgba(0,0,0,0.38)] backdrop-blur-md">
      <div className="relative mx-auto flex min-h-[5rem] w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
        <BrandMark />
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onConnectWallet}
            className="inline-flex max-w-[11rem] items-center justify-center gap-2 rounded border border-monster/35 bg-monster/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-monster transition hover:bg-monster/20"
            title={profile.walletAddress ?? 'Connect Solana wallet'}
          >
            <Wallet size={15} />
            <span className="hidden sm:inline">{profile.walletAddress ? `${profile.walletAddress.slice(0, 4)}...${profile.walletAddress.slice(-4)}` : 'Connect'}</span>
          </button>
          <div className="hidden items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 md:flex">
            <span className="text-lg leading-none">{profile.pfp}</span>
            <span className="max-w-28 truncate font-mono text-xs uppercase tracking-[0.12em] text-white/65">{profile.username}</span>
          </div>
          <div className="hidden items-center gap-2 rounded border border-monster/25 bg-monster/10 px-3 py-2 font-mono text-xs uppercase text-monster lg:flex">
            <RadioTower size={15} />
            Online
          </div>
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-1.5 sm:flex">
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
        <img src={navCanLogo} alt="" className="h-20 w-20 object-contain drop-shadow-[0_0_20px_rgba(130,255,0,0.65)]" />
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

function StartScreen({
  onEnterLobby,
  profile,
  onConnectWallet,
}: {
  onEnterLobby: () => void;
  profile: WalletProfile;
  onConnectWallet: () => void;
}) {
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
      <div className="relative z-20 flex min-h-screen flex-col">
        <UniversalNav currentView="START" onLobby={onEnterLobby} profile={profile} onConnectWallet={onConnectWallet} />

        <main className="flex w-full flex-1 flex-col justify-between px-5 sm:px-8 lg:px-12">
          <section className="w-full max-w-full pb-12 pt-16 sm:pb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded border border-white/15 bg-black/35 px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur">
              <Crosshair size={14} className="text-monster" />
              Last man standing takes the park
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
            <div className="mt-8 grid w-full items-end gap-4 lg:grid-cols-[minmax(0,39rem)_minmax(20rem,28rem)] lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
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
              <div className="hidden lg:block">
                <TokenStrip compact />
              </div>
            </div>
            <div className="mt-4 max-w-xl lg:hidden">
              <TokenStrip compact />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function MusicControl() {
  const [settings, setSettings] = useState(getMusicSettings);
  const volumePercent = Math.round(settings.volume * 100);
  const isMuted = settings.muted || volumePercent === 0;

  useEffect(() => {
    return subscribeMusicSettings(() => setSettings({ ...getMusicSettings() }));
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded border border-white/12 bg-black/65 px-1.5 py-1.5 shadow-2xl backdrop-blur-md sm:px-2.5 sm:py-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setMusicMuted(!isMuted)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded border transition ${
          isMuted
            ? 'border-white/15 bg-white/[0.06] text-white/65 hover:bg-white/10 hover:text-white'
            : 'border-monster/40 bg-monster/15 text-monster hover:bg-monster/25'
        }`}
        aria-label={isMuted ? 'Unmute music' : 'Mute music'}
        title={isMuted ? 'Unmute music' : 'Mute music'}
      >
        {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
      <label className="sr-only" htmlFor="music-volume">Music volume</label>
      <input
        id="music-volume"
        type="range"
        min="0"
        max="100"
        value={volumePercent}
        onChange={(event) => setMusicVolume(Number(event.currentTarget.value) / 100)}
        className="hidden h-2 w-24 accent-monster sm:block sm:w-28"
        aria-label="Music volume"
      />
      <div className="hidden w-8 text-right font-mono text-[10px] uppercase text-white/45 sm:block">
        {isMuted ? 'Off' : volumePercent}
      </div>
    </div>
  );
}

function LobbyBillboard() {
  return (
    <div className="relative w-full max-w-[30rem] overflow-visible lg:ml-6">
      <div className="relative aspect-square w-full">
        <img
          src={blankParkSign}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,0.62)]"
          draggable={false}
        />
        <div className="absolute left-[15%] top-[16%] flex h-[38%] w-[70%] flex-col items-center justify-center px-4 text-center">
          <h1 className="font-pixel text-[clamp(2.9rem,5vw,4.9rem)] uppercase leading-[0.82] text-[#16120d] drop-shadow-[0_2px_0_rgba(255,255,255,0.28)]">
            Trailer Park
            <span className="block text-monster drop-shadow-[0_2px_0_rgba(20,35,0,0.85)]">Throwdown</span>
          </h1>
        </div>
      </div>
      <p className="-mt-5 max-w-md font-mono text-sm leading-7 text-white/78 sm:-mt-6 lg:ml-7">
        Pick a free table or load a $UNC wager room before you step into the park.
      </p>
    </div>
  );
}

function LobbyScreen({
  onBack,
  onStartGame,
  profile,
  setProfile,
  onConnectWallet,
}: {
  onBack: () => void;
  onStartGame: () => void;
  profile: WalletProfile;
  setProfile: (profile: WalletProfile) => void;
  onConnectWallet: () => void;
}) {
  const lobbyRooms = useGameStore((state) => state.lobbyRooms);
  const setLobbyRooms = useGameStore((state) => state.setLobbyRooms);
  const wager = useGameStore((state) => state.wager);
  const setWager = useGameStore((state) => state.setWager);
  const [profileDraft, setProfileDraft] = useState(defaultProfile);
  const [paidWagers, setPaidWagers] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<LobbyNotice>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const selectedPlayerCountRef = useRef(0);
  const selectedRoom = lobbyRooms.find((room) => room.wager === wager);
  const selectedPlayers = selectedRoom?.players ?? [];
  const selectedReadyCount = selectedRoom?.readyCount ?? 0;
  const selectedCountdownEndsAt = selectedRoom?.countdownEndsAt ?? null;
  const countdownSeconds = selectedCountdownEndsAt ? Math.max(0, Math.ceil((selectedCountdownEndsAt - clock) / 1000)) : 0;
  const myLobbyEntry = selectedPlayers.find((player) => player.id === socket.id);
  const isReady = Boolean(myLobbyEntry?.ready);
  const selectedTier = wagerTiers.find((tier) => tier.value === wager) ?? wagerTiers[0];
  const selectedBuyInUnc = parseBuyInUnc(selectedTier.value);
  const selectedGrossPotUnc = selectedBuyInUnc * selectedPlayers.length;
  const selectedHouseFeeUnc = selectedGrossPotUnc * HOUSE_FEE_RATE;
  const selectedPayoutPoolUnc = selectedGrossPotUnc - selectedHouseFeeUnc;
  const isPaidRoom = selectedBuyInUnc > 0;
  const hasWallet = Boolean(profile.walletAddress);
  const hasPaidSelectedEntry = !isPaidRoom || Boolean(paidWagers[wager]);

  useEffect(() => {
    setProfileDraft(profile);
    socket.emit('saveProfile', profile);
  }, [profile]);

  useEffect(() => {
    ensureSocketConnected();

    const handleMatchStarting = ({ wager: startingWager }: { wager: string }) => {
      if (startingWager !== wager) {
        return;
      }

      setNotice({ tone: 'success', message: 'Match is starting. Loading into the park.' });
      onStartGame();
    };

    socket.on('lobbyRooms', setLobbyRooms);
    socket.on('paymentConfig', setPaymentConfig);
    socket.on('matchStarting', handleMatchStarting);
    socket.emit('selectLobby', wager);
    socket.emit('saveProfile', profile);
    socket.emit('getPaymentConfig', setPaymentConfig);

    return () => {
      socket.off('lobbyRooms', setLobbyRooms);
      socket.off('paymentConfig', setPaymentConfig);
      socket.off('matchStarting', handleMatchStarting);
    };
  }, [onStartGame, profile, setLobbyRooms, wager]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedPlayers.length > selectedPlayerCountRef.current) {
      playLobbyJoinPing();
    }

    selectedPlayerCountRef.current = selectedPlayers.length;
  }, [selectedPlayers.length, wager]);

  useEffect(() => {
    if (myLobbyEntry?.entryPaid) {
      setPaidWagers((current) => ({ ...current, [wager]: true }));
    }
  }, [myLobbyEntry?.entryPaid, wager]);

  const handleSaveProfile = () => {
    const nextProfile = {
      walletAddress: profile.walletAddress,
      username: profileDraft.username.trim().slice(0, 18) || defaultProfile.username,
      pfp: profileDraft.pfp.trim().slice(0, 80) || defaultProfile.pfp,
    };

    window.localStorage.setItem(profileStorageKey(nextProfile.walletAddress), JSON.stringify(nextProfile));
    setProfile(nextProfile);
    socket.emit('saveProfile', nextProfile);
  };

  const handleSelectWager = (value: string) => {
    const buyInUnc = parseBuyInUnc(value);
    playLobbyJoinPing();
    setWager(value);
    setNotice(buyInUnc > 0
      ? { tone: 'warning', message: `Connect a wallet and confirm ${formatUnc(buyInUnc)} before readying in this room.` }
      : { tone: 'success', message: 'Free room selected. No wallet or entry fee required.' });
    ensureSocketConnected();
    socket.emit('selectLobby', value);
  };

  const handleUseFreeRoom = () => {
    handleSelectWager('FREE');
  };

  const handleConfirmEntry = async () => {
    if (!hasWallet) {
      setNotice({ tone: 'warning', message: 'Connect your wallet before paying an entry fee.' });
      void onConnectWallet();
      return;
    }

    if (!paymentConfig?.enabled || !paymentConfig.tokenMint || !paymentConfig.hotWalletAddress || !paymentConfig.rpcUrl) {
      setNotice({ tone: 'warning', message: 'Wager payments are not configured yet. Use the free room for now.' });
      return;
    }

    const provider = getSolanaProvider();
    if (!provider?.publicKey || (!provider.signAndSendTransaction && !provider.signTransaction)) {
      setNotice({ tone: 'warning', message: 'Your wallet does not support signing the entry transaction.' });
      return;
    }

    setPaymentPending(true);
    setNotice({ tone: 'info', message: `Approve the ${selectedTier.buyIn} entry transfer in your wallet.` });

    try {
      const [
        { Connection, PublicKey, Transaction },
        {
          createAssociatedTokenAccountIdempotentInstruction,
          createTransferCheckedInstruction,
          getAssociatedTokenAddress,
        },
      ] = await Promise.all([
        import('@solana/web3.js'),
        import('@solana/spl-token'),
      ]);
      const connection = new Connection(paymentConfig.rpcUrl, 'confirmed');
      const payer = new PublicKey(provider.publicKey.toString());
      const mint = new PublicKey(paymentConfig.tokenMint);
      const hotWallet = new PublicKey(paymentConfig.hotWalletAddress);
      const sourceAta = await getAssociatedTokenAddress(mint, payer);
      const destinationAta = await getAssociatedTokenAddress(mint, hotWallet, true);
      const amount = uncToBaseUnits(selectedBuyInUnc, paymentConfig.tokenDecimals);
      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(payer, destinationAta, hotWallet, mint),
        createTransferCheckedInstruction(sourceAta, mint, destinationAta, payer, amount, paymentConfig.tokenDecimals),
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.feePayer = payer;
      transaction.recentBlockhash = blockhash;

      const signature = provider.signAndSendTransaction
        ? (await provider.signAndSendTransaction(transaction)).signature
        : await connection.sendRawTransaction((await provider.signTransaction!(transaction)).serialize());

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      const result = await socketEmitWithAck<EntryPaymentResult>('verifyEntryPayment', {
        signature,
        wager,
        walletAddress: payer.toBase58(),
        amountUnc: selectedBuyInUnc,
      });

      if (!result.ok) {
        setNotice({ tone: 'warning', message: result.message });
        return;
      }

      setPaidWagers((current) => ({ ...current, [wager]: true }));
      setNotice({ tone: 'success', message: `${selectedTier.buyIn} entry verified on-chain. You can ready up now.` });
      playLobbyJoinPing();
    } catch (error) {
      setNotice({
        tone: 'warning',
        message: error instanceof Error ? error.message : 'Entry payment failed. Try again or use the free room.',
      });
    } finally {
      setPaymentPending(false);
    }
  };

  const handleReadyUp = () => {
    if (isPaidRoom && !hasWallet) {
      setNotice({ tone: 'warning', message: 'Paid rooms require a connected wallet. You can connect or jump into the free room.' });
      return;
    }

    if (isPaidRoom && !hasPaidSelectedEntry) {
      setNotice({ tone: 'warning', message: `Pay the ${selectedTier.buyIn} entry fee before readying up, or use the free room.` });
      return;
    }

    const nextReady = !isReady;
    socket.emit('setReady', nextReady);
    setNotice(nextReady
      ? { tone: 'success', message: selectedPlayers.length >= 2 ? 'Ready locked. Match starts when everyone is ready.' : 'Ready locked. Waiting for another player.' }
      : { tone: 'info', message: 'You are no longer ready.' });
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-[#15120f] text-white lg:h-screen lg:overflow-hidden">
      <div
        className="min-h-screen bg-cover bg-center lg:h-screen"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,8,6,0.82), rgba(10,8,6,0.95)), url("${titleHero}")`,
        }}
      >
        <div className="flex min-h-screen w-full flex-col lg:h-screen">
          <UniversalNav currentView="LOBBY" onStart={onBack} profile={profile} onConnectWallet={onConnectWallet} />

          <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 items-start gap-5 px-5 pb-6 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:pt-10">
            <section className="min-w-0">
              <LobbyBillboard />

              <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-3 lg:mt-7">
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
                  <div className="font-pixel text-3xl uppercase">LMS</div>
                  <div className="font-mono text-xs text-white/45">Most kills bonus</div>
                </div>
              </div>

              <div className="mt-3 max-w-2xl">
                <TokenStrip />
              </div>
            </section>

            <aside className="rounded border border-white/12 bg-black/45 p-4 shadow-2xl backdrop-blur-md lg:mt-12">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="font-pixel text-4xl uppercase text-white">Match Rooms</div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Click a card to view players</div>
                </div>
                <Users className="text-monster" size={28} />
              </div>

              {notice && (
                <div className={`mb-3 rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] ${
                  notice.tone === 'success'
                    ? 'border-monster/40 bg-monster/10 text-monster'
                    : notice.tone === 'warning'
                      ? 'border-yellow-300/35 bg-yellow-300/10 text-yellow-100'
                      : 'border-white/15 bg-white/[0.06] text-white/70'
                }`}
                >
                  {notice.message}
                </div>
              )}

              <div className="mb-3 grid gap-3 rounded border border-white/10 bg-black/35 p-3 md:grid-cols-[auto_1fr_auto]">
                <div className="flex h-14 w-14 items-center justify-center rounded border border-monster/35 bg-monster/10 text-3xl">
                  {profileDraft.pfp}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={profileDraft.username}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))}
                    className="min-w-0 rounded border border-white/10 bg-black/45 px-3 py-2 font-mono text-sm text-white outline-none transition focus:border-monster"
                    maxLength={18}
                    aria-label="Username"
                  />
                  <div className="flex gap-1">
                    {pfpOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setProfileDraft((current) => ({ ...current, pfp: option }))}
                        className={`h-9 w-9 rounded border text-lg transition ${profileDraft.pfp === option ? 'border-monster bg-monster/20' : 'border-white/10 bg-white/[0.04] hover:border-white/30'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 sm:col-span-2">
                    {profile.walletAddress ? `Saved to ${profile.walletAddress.slice(0, 4)}...${profile.walletAddress.slice(-4)}` : 'Guest profile saves locally until wallet connect'}
                  </div>
                </div>
                <div className="grid content-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="rounded bg-monster px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-black transition hover:bg-monster-dark"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="mb-3 rounded border border-white/10 bg-black/35 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-pixel text-3xl uppercase text-white">{wager === 'FREE' ? 'Free Room' : wager}</div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">
                      {countdownSeconds > 0
                        ? `Match starts in ${countdownSeconds}`
                        : `${selectedReadyCount}/${Math.max(2, selectedPlayers.length)} ready`}
                    </div>
                  </div>
                  <BadgeDollarSign className="text-yellow-300" size={26} />
                </div>

                <div className="mb-3 grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
                  <div className="rounded bg-black/25 px-2 py-2">
                    <span className="block text-white/35">Buy In</span>
                    <span className="text-yellow-200">{selectedTier.buyIn}</span>
                  </div>
                  <div className="rounded bg-black/25 px-2 py-2">
                    <span className="block text-white/35">Pot</span>
                    <span>{formatUnc(selectedGrossPotUnc)}</span>
                  </div>
                  <div className="rounded bg-black/25 px-2 py-2">
                    <span className="block text-white/35">Fee</span>
                    <span className="text-yellow-200">{selectedBuyInUnc === 0 ? 'Free' : formatUnc(selectedHouseFeeUnc)}</span>
                  </div>
                  <div className="rounded bg-black/25 px-2 py-2">
                    <span className="block text-white/35">Payout</span>
                    <span className="text-monster">{formatUnc(selectedPayoutPoolUnc)}</span>
                  </div>
                </div>

                <div className={`mb-3 rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  countdownSeconds > 0
                    ? 'border-monster/45 bg-monster/15 text-monster'
                    : selectedPlayers.length < 2
                      ? 'border-yellow-300/30 bg-yellow-300/10 text-yellow-100'
                      : 'border-white/12 bg-white/[0.05] text-white/60'
                }`}>
                  {countdownSeconds > 0
                    ? `Everyone is ready. Drop-in starts in ${countdownSeconds}.`
                    : selectedPlayers.length < 2
                      ? 'Ready up now. A second player starts the countdown.'
                      : 'Match starts automatically when every player in this room is ready.'}
                </div>

                <div className={`mb-3 rounded border p-3 ${isPaidRoom ? 'border-yellow-300/25 bg-yellow-300/10' : 'border-monster/25 bg-monster/10'}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-pixel text-2xl uppercase text-white">{isPaidRoom ? 'Wager Gate' : 'Open Practice'}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                        {isPaidRoom ? 'Wallet and entry fee required to ready' : 'No wallet required'}
                      </div>
                    </div>
                    {isPaidRoom ? <Lock className="text-yellow-300" size={22} /> : <Check className="text-monster" size={22} />}
                  </div>
                  {isPaidRoom ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <div className="rounded border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-white/70">
                        {hasWallet
                          ? `${profile.walletAddress?.slice(0, 4)}...${profile.walletAddress?.slice(-4)} connected`
                          : 'Connect wallet before paying'}
                      </div>
                      <button
                        type="button"
                        onClick={hasWallet ? handleConfirmEntry : onConnectWallet}
                        disabled={paymentPending || (hasWallet && !paymentConfig?.enabled)}
                        className="inline-flex items-center justify-center gap-2 rounded border border-yellow-300/35 bg-yellow-300/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-yellow-100 transition hover:bg-yellow-300/25 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Wallet size={14} />
                        {hasWallet
                          ? (hasPaidSelectedEntry ? 'Paid' : paymentPending ? 'Paying' : paymentConfig?.enabled ? `Pay ${selectedTier.buyIn}` : 'Not Live')
                          : 'Connect'}
                      </button>
                      <button
                        type="button"
                        onClick={handleUseFreeRoom}
                        className="rounded border border-white/15 bg-white/[0.05] px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        Free Room
                      </button>
                    </div>
                  ) : (
                    <div className="font-mono text-xs uppercase tracking-[0.12em] text-white/65">
                      Ready up any time, or connect a wallet first if you want your profile tied to an address.
                    </div>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedPlayers.length === 0 && (
                    <div className="rounded border border-dashed border-white/15 bg-white/[0.04] px-4 py-3 text-center font-mono text-sm text-white/45 sm:col-span-2">
                      No players in this room yet
                    </div>
                  )}
                  {selectedPlayers.slice(0, 4).map((player, index) => (
                    <div key={player.id} className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded border px-3 py-2 font-mono text-xs ${
                      player.ready
                        ? 'border-monster/35 bg-monster/10'
                        : 'border-white/10 bg-white/[0.06]'
                    }`}>
                      <span className="text-white/35">{index + 1}.</span>
                      <span>{player.pfp}</span>
                      <span className="truncate">{player.id === socket.id ? `${player.username} (YOU)` : player.username}</span>
                      <span className={`rounded border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${
                        player.ready
                          ? 'border-monster/35 bg-monster/15 text-monster'
                          : 'border-white/10 bg-black/25 text-white/35'
                      }`}>
                        {player.ready ? 'Ready' : 'Idle'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {wagerTiers.map((tier) => {
                  const selected = tier.value === wager;
                  const room = lobbyRooms.find((entry) => entry.wager === tier.value);
                  const roomCount = room?.players.length ?? 0;
                  const buyInUnc = parseBuyInUnc(tier.value);

                  return (
                    <button
                      key={tier.value}
                      onClick={() => handleSelectWager(tier.value)}
                      className={`rounded border p-2 text-left transition ${selected ? 'border-monster bg-monster/15 text-white shadow-[0_0_24px_rgba(130,255,0,0.16)]' : 'border-white/10 bg-white/[0.05] text-white/75 hover:border-white/25 hover:bg-white/[0.08] hover:text-white'}`}
                    >
                      <div className="font-pixel text-xl uppercase leading-none">{tier.label}</div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">{tier.caption}</div>
                      <div className="mt-2 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-monster">
                        {roomCount}/{tier.maxPlayers}
                      </div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">{buyInUnc === 0 ? 'Practice' : 'Paid'}</div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleReadyUp}
                className={`mt-6 inline-flex w-full items-center justify-center gap-3 rounded px-6 py-4 font-pixel text-3xl uppercase leading-none transition ${
                  isPaidRoom && !hasPaidSelectedEntry
                    ? 'bg-yellow-300 text-black hover:bg-yellow-200'
                    : isReady
                      ? 'border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.12]'
                    : 'bg-monster text-black hover:bg-monster-dark'
                }`}
              >
                <Gamepad2 size={24} />
                {isPaidRoom && !hasPaidSelectedEntry
                  ? `Ready Requires ${selectedTier.buyIn}`
                  : isReady
                    ? 'Unready'
                    : `Ready ${wager === 'FREE' ? 'Free' : wager}`}
              </button>
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  profile,
  onConnectWallet,
}: {
  profile: WalletProfile;
  onConnectWallet: () => void;
}) {
  const playersInfo = useGameStore((state) => state.playersInfo);
  const result = useGameStore((state) => state.matchResult);
  const reset = useGameStore((state) => state.reset);

  const sortedPlayers = useMemo(
    () => Object.values(playersInfo).sort((a, b) => {
      if (a.id === result?.winnerId) return -1;
      if (b.id === result?.winnerId) return 1;
      return (b.kills - a.kills) || (a.deaths - b.deaths);
    }),
    [playersInfo, result?.winnerId],
  );
  const winner = result?.winnerId ? playersInfo[result.winnerId] : null;
  const secondPlaceBonus = result?.secondPlaceBonusId ? playersInfo[result.secondPlaceBonusId] : null;
  const resultLabel = result?.reason === 'lastStanding'
    ? 'Last man standing'
    : (result?.reason ?? 'escape');

  const handleReturnToLobby = () => {
    disconnectSocket();
    reset();
  };

  return (
    <div
      className="min-h-screen bg-black bg-cover bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.82), rgba(0,0,0,0.92)), url("${titleHero}")`,
      }}
    >
      <UniversalNav currentView="RESULT" onLobby={handleReturnToLobby} profile={profile} onConnectWallet={onConnectWallet} />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-5">
        <div className="w-full rounded border border-white/12 bg-black/60 p-6 shadow-2xl backdrop-blur-md md:p-10">
          <div className="mb-6 flex items-center gap-3 text-monster">
            <Trophy size={36} />
            <h1 className="font-pixel text-5xl uppercase leading-none">Match Result</h1>
          </div>

          <div className="mb-2 font-mono text-lg text-white">
            {winner ? `${winner.id === socket.id ? 'You' : `Player_${winner.id.slice(0, 4)}`} won the toss-up.` : 'Match ended.'}
          </div>
          <div className="mb-8 font-mono text-sm uppercase tracking-widest text-white/45">
            {resultLabel} - most kills earns the second-place bonus
          </div>

          {secondPlaceBonus && (
            <div className="mb-6 rounded border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 font-mono text-sm text-yellow-100">
              <span className="font-pixel text-2xl uppercase text-yellow-300">Second Place Bonus:</span>{' '}
              {secondPlaceBonus.id === socket.id ? 'You' : `Player_${secondPlaceBonus.id.slice(0, 4)}`} had the most kills outside first.
            </div>
          )}

          {result && result.buyInUnc > 0 && (
            <div className="mb-6 grid gap-2 rounded border border-white/10 bg-white/[0.05] p-4 font-mono text-xs uppercase tracking-[0.14em] text-white/60 sm:grid-cols-4">
              <div>
                <span className="block text-white/35">Buy In</span>
                <span className="text-yellow-200">{formatUnc(result.buyInUnc)}</span>
              </div>
              <div>
                <span className="block text-white/35">Gross Pot</span>
                <span>{formatUnc(result.grossPotUnc)}</span>
              </div>
              <div>
                <span className="block text-white/35">House Fee</span>
                <span className="text-yellow-200">{formatUnc(result.houseFeeUnc)} (2%)</span>
              </div>
              <div>
                <span className="block text-white/35">Payout Pool</span>
                <span className="text-monster">{formatUnc(result.payoutPoolUnc)}</span>
              </div>
            </div>
          )}

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
  const [profile, setProfile] = useState<WalletProfile>(() => {
    try {
      const stored = window.localStorage.getItem(profileStorageKey(null));
      return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });
  const status = useGameStore((state) => state.status);
  const startGame = useGameStore((state) => state.startGame);
  const endGame = useGameStore((state) => state.endGame);

  useEffect(() => {
    if (status === 'LOBBY') {
      startLobbyMusic();
    }
  }, [status]);

  const handleConnectWallet = async () => {
    const provider = getSolanaProvider();
    if (!provider) {
      window.open('https://phantom.app/', '_blank', 'noopener,noreferrer');
      return;
    }

    const response = await provider.connect();
    const walletAddress = response.publicKey.toString();
    const stored = window.localStorage.getItem(profileStorageKey(walletAddress));
    const nextProfile = stored
      ? { ...defaultProfile, ...JSON.parse(stored), walletAddress }
      : { ...profile, walletAddress };

    window.localStorage.setItem(profileStorageKey(walletAddress), JSON.stringify(nextProfile));
    setProfile(nextProfile);
  };

  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && useGameStore.getState().status === 'PLAYING') {
        disconnectSocket();
        endGame({
          winnerId: null,
          secondPlaceBonusId: null,
          wager: 'FREE',
          playerCount: 0,
          buyInUnc: 0,
          grossPotUnc: 0,
          houseFeeUnc: 0,
          payoutPoolUnc: 0,
          reason: 'escape',
          endedAt: Date.now(),
        });
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [endGame]);

  const handleStartGame = () => {
    playMatchStartAlert();
    stopGameAmbience();
    ensureSocketConnected();
    startTransition(() => {
      startGame();
    });

    setTimeout(() => {
      document.body.requestPointerLock?.();
    }, 100);
  };

  const handleEnterLobby = () => {
    startLobbyMusic();
    setMenuView('LOBBY');
  };

  const handleBackToStart = () => {
    setMenuView('START');
  };

  if (status === 'PLAYING') {
    return (
      <>
        <Suspense fallback={<LoadingScreen />}>
          <GameExperience />
        </Suspense>
        <MusicControl />
      </>
    );
  }

  if (status === 'RESULT') {
    return (
      <>
        <ResultScreen profile={profile} onConnectWallet={handleConnectWallet} />
        <MusicControl />
      </>
    );
  }

  if (menuView === 'START') {
    return (
      <>
        <StartScreen onEnterLobby={handleEnterLobby} profile={profile} onConnectWallet={handleConnectWallet} />
        <MusicControl />
      </>
    );
  }

  return (
    <>
      <LobbyScreen
        onBack={handleBackToStart}
        onStartGame={handleStartGame}
        profile={profile}
        setProfile={setProfile}
        onConnectWallet={handleConnectWallet}
      />
      <MusicControl />
    </>
  );
}
