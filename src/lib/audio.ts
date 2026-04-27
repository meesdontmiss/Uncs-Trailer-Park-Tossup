let audioCtx: AudioContext | null = null;
let lobbyMusic: HTMLAudioElement | null = null;
let shouldPlayLobbyMusic = false;
let lobbyMusicPlayPending = false;
let lobbyMusicUnlockHandler: (() => void) | null = null;
let gameMusic: HTMLAudioElement | null = null;
let shouldPlayGameMusic = false;
let gameMusicPlayPending = false;
let gameMusicUnlockHandler: (() => void) | null = null;
let gameAmbience: { stop: () => void } | null = null;
let chargeLoop: { gain: GainNode; osc: OscillatorNode; lfo: OscillatorNode; stop: () => void } | null = null;

const lobbyMusicSrc = '/music/TRAILER PARK UNCS.mp3';
const gameMusicSrc = '/music/THE UNCTION.mp3';
const musicStorageKey = 'unc-tossup-music-settings';
const lobbyMusicBaseVolume = 0.46;
const gameMusicBaseVolume = 0.5;

type MusicSettings = {
  volume: number;
  muted: boolean;
};

const musicSubscribers = new Set<() => void>();
let musicSettings: MusicSettings = loadMusicSettings();

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

function loadMusicSettings(): MusicSettings {
  try {
    const stored = window.localStorage.getItem(musicStorageKey);
    if (!stored) {
      return { volume: 0.5, muted: false };
    }

    const parsed = JSON.parse(stored) as Partial<MusicSettings>;
    return {
      volume: clampVolume(typeof parsed.volume === 'number' ? parsed.volume : 0.5),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: 0.5, muted: false };
  }
}

function persistMusicSettings() {
  try {
    window.localStorage.setItem(musicStorageKey, JSON.stringify(musicSettings));
  } catch {
    // Local storage is optional; audio controls still work for this session.
  }
}

function notifyMusicSubscribers() {
  musicSubscribers.forEach((listener) => listener());
}

function applyMusicSettings() {
  const effectiveVolume = musicSettings.muted ? 0 : musicSettings.volume;

  if (lobbyMusic) {
    lobbyMusic.volume = lobbyMusicBaseVolume * effectiveVolume;
    lobbyMusic.muted = musicSettings.muted;
  }

  if (gameMusic) {
    gameMusic.volume = gameMusicBaseVolume * effectiveVolume;
    gameMusic.muted = musicSettings.muted;
  }
}

function updateMusicSettings(nextSettings: MusicSettings) {
  musicSettings = {
    volume: clampVolume(nextSettings.volume),
    muted: nextSettings.muted,
  };
  applyMusicSettings();
  persistMusicSettings();
  notifyMusicSubscribers();
}

export function getMusicSettings() {
  return musicSettings;
}

export function subscribeMusicSettings(listener: () => void) {
  musicSubscribers.add(listener);
  return () => {
    musicSubscribers.delete(listener);
  };
}

export function setMusicVolume(volume: number) {
  updateMusicSettings({
    volume,
    muted: volume <= 0,
  });
}

export function setMusicMuted(muted: boolean) {
  updateMusicSettings({ ...musicSettings, muted });
}

function removeUnlockHandler(handler: (() => void) | null) {
  if (!handler) {
    return;
  }

  window.removeEventListener('pointerdown', handler);
  window.removeEventListener('keydown', handler);
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  return audioCtx;
}

function envelopeGain(ctx: AudioContext, peak: number, attack: number, decay: number, startAt = ctx.currentTime) {
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(peak, startAt + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + attack + decay);
  return gainNode;
}

function playTone({
  type,
  frequency,
  endFrequency,
  duration,
  gain,
  delay = 0,
}: {
  type: OscillatorType;
  frequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  delay?: number;
}) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const startAt = ctx.currentTime + delay;
  const gainNode = envelopeGain(ctx, gain, 0.01, Math.max(0.03, duration - 0.01), startAt);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
  }

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function startLobbyMusic() {
  shouldPlayLobbyMusic = true;

  if (!lobbyMusic) {
    lobbyMusic = new Audio(lobbyMusicSrc);
    lobbyMusic.loop = true;
    lobbyMusic.preload = 'auto';
    applyMusicSettings();
  }

  if (!lobbyMusic.paused || lobbyMusicPlayPending) {
    return;
  }

  removeUnlockHandler(lobbyMusicUnlockHandler);
  lobbyMusicUnlockHandler = null;
  lobbyMusicPlayPending = true;
  const playPromise = lobbyMusic.play();
  if (!playPromise) {
    lobbyMusicPlayPending = false;
    return;
  }

  playPromise
    .then(() => {
      lobbyMusicPlayPending = false;
    })
    .catch(() => {
      lobbyMusicPlayPending = false;
      if (!shouldPlayLobbyMusic || lobbyMusicUnlockHandler) {
        return;
      }

      lobbyMusicUnlockHandler = () => {
        const handler = lobbyMusicUnlockHandler;
        lobbyMusicUnlockHandler = null;
        removeUnlockHandler(handler);

        if (!shouldPlayLobbyMusic || !lobbyMusic?.paused) {
          return;
        }

        startLobbyMusic();
      };

      window.addEventListener('pointerdown', lobbyMusicUnlockHandler, { once: true });
      window.addEventListener('keydown', lobbyMusicUnlockHandler, { once: true });
    });
}

export function stopLobbyMusic() {
  shouldPlayLobbyMusic = false;
  removeUnlockHandler(lobbyMusicUnlockHandler);
  lobbyMusicUnlockHandler = null;

  if (!lobbyMusic || lobbyMusic.paused) {
    return;
  }

  lobbyMusic.pause();
}

export function startGameMusic() {
  shouldPlayGameMusic = true;

  if (!gameMusic) {
    gameMusic = new Audio(gameMusicSrc);
    gameMusic.loop = true;
    gameMusic.preload = 'auto';
    applyMusicSettings();
  }

  if (!gameMusic.paused || gameMusicPlayPending) {
    return;
  }

  removeUnlockHandler(gameMusicUnlockHandler);
  gameMusicUnlockHandler = null;
  gameMusicPlayPending = true;
  const playPromise = gameMusic.play();
  if (!playPromise) {
    gameMusicPlayPending = false;
    return;
  }

  playPromise
    .then(() => {
      gameMusicPlayPending = false;
    })
    .catch(() => {
      gameMusicPlayPending = false;
      if (!shouldPlayGameMusic || gameMusicUnlockHandler) {
        return;
      }

      gameMusicUnlockHandler = () => {
        const handler = gameMusicUnlockHandler;
        gameMusicUnlockHandler = null;
        removeUnlockHandler(handler);

        if (!shouldPlayGameMusic || !gameMusic?.paused) {
          return;
        }

        startGameMusic();
      };

      window.addEventListener('pointerdown', gameMusicUnlockHandler, { once: true });
      window.addEventListener('keydown', gameMusicUnlockHandler, { once: true });
    });
}

export function stopGameMusic() {
  shouldPlayGameMusic = false;
  removeUnlockHandler(gameMusicUnlockHandler);
  gameMusicUnlockHandler = null;

  if (!gameMusic || gameMusic.paused) {
    return;
  }

  gameMusic.pause();
}

export function startGameAmbience() {
  if (gameAmbience) {
    return;
  }

  const ctx = getAudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.08;
  master.connect(ctx.destination);

  const lowDrone = ctx.createOscillator();
  const grit = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  lowDrone.type = 'sine';
  lowDrone.frequency.value = 55;
  grit.type = 'triangle';
  grit.frequency.value = 110;
  lowDrone.connect(filter);
  grit.connect(filter);
  filter.connect(master);
  lowDrone.start();
  grit.start();

  const intervalId = window.setInterval(() => {
    if (Math.random() > 0.56) {
      playTone({
        type: 'triangle',
        frequency: 420 + (Math.random() * 220),
        endFrequency: 260 + (Math.random() * 80),
        duration: 0.18,
        gain: 0.035,
      });
    }
  }, 900);

  gameAmbience = {
    stop: () => {
      window.clearInterval(intervalId);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
      lowDrone.stop(ctx.currentTime + 0.18);
      grit.stop(ctx.currentTime + 0.18);
      window.setTimeout(() => master.disconnect(), 280);
    },
  };
}

export function stopGameAmbience() {
  gameAmbience?.stop();
  gameAmbience = null;
}

export function playCanImpactSound() {
  const ctx = getAudioContext();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = envelopeGain(ctx, 0.32, 0.008, 0.16);
  const filter = ctx.createBiquadFilter();

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.type = 'square';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(840, ctx.currentTime);
  osc2.frequency.setValueAtTime(1250, ctx.currentTime);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1120, ctx.currentTime);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.2);
  osc2.stop(ctx.currentTime + 0.2);
}

export function playLobbyJoinPing() {
  playTone({ type: 'sine', frequency: 740, endFrequency: 980, duration: 0.09, gain: 0.08 });
  playTone({ type: 'triangle', frequency: 1240, duration: 0.08, gain: 0.045, delay: 0.045 });
}

export function playMatchStartAlert() {
  playTone({ type: 'square', frequency: 880, duration: 0.16, gain: 0.18 });
  playTone({ type: 'square', frequency: 880, duration: 0.16, gain: 0.18, delay: 0.24 });
  playTone({ type: 'triangle', frequency: 1320, endFrequency: 660, duration: 0.34, gain: 0.16, delay: 0.5 });
}

export function playKillSound() {
  playTone({ type: 'triangle', frequency: 3000, endFrequency: 1000, duration: 0.32, gain: 0.38 });
  playTone({ type: 'square', frequency: 420, endFrequency: 105, duration: 0.12, gain: 0.18 });
  playTone({ type: 'sawtooth', frequency: 150, endFrequency: 50, duration: 0.3, gain: 0.3, delay: 0.1 });
}

export function playDeathBassSound() {
  playTone({ type: 'sine', frequency: 150, endFrequency: 16, duration: 0.55, gain: 0.72 });
}

export function playThrowChargeStartSound() {
  const ctx = getAudioContext();
  if (chargeLoop) {
    return;
  }

  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.value = 130;
  lfo.frequency.value = 5;
  lfoGain.gain.value = 20;
  gain.gain.value = 0.0001;

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  lfo.start();
  gain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.04);

  chargeLoop = {
    gain,
    osc,
    lfo,
    stop: () => {
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      osc.stop(ctx.currentTime + 0.12);
      lfo.stop(ctx.currentTime + 0.12);
    },
  };
}

export function updateThrowChargeSound(charge: number) {
  if (!chargeLoop || !audioCtx) {
    return;
  }

  const clamped = Math.max(0, Math.min(1, charge));
  chargeLoop.osc.frequency.setTargetAtTime(130 + (clamped * 180), audioCtx.currentTime, 0.04);
  chargeLoop.gain.gain.setTargetAtTime(0.05 + (clamped * 0.08), audioCtx.currentTime, 0.05);
}

export function stopThrowChargeSound() {
  chargeLoop?.stop();
  chargeLoop = null;
}

export function playThrowSound(power = 1) {
  const clamped = Math.max(0, Math.min(1, power));
  playTone({
    type: 'sine',
    frequency: 260 + (clamped * 260),
    endFrequency: 90 + (clamped * 40),
    duration: 0.14 + (clamped * 0.08),
    gain: 0.08 + (clamped * 0.12),
  });
  playTone({
    type: 'triangle',
    frequency: 700 + (clamped * 180),
    endFrequency: 360,
    duration: 0.08,
    gain: 0.04 + (clamped * 0.06),
  });
}

export function playJumpSound() {
  playTone({ type: 'triangle', frequency: 180, endFrequency: 320, duration: 0.12, gain: 0.08 });
}
