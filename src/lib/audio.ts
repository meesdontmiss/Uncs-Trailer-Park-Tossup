// Procedural audio keeps the game self-contained and avoids missing media files.

let audioCtx: AudioContext | null = null;
let lobbyMusic: { stop: () => void } | null = null;
let gameAmbience: { stop: () => void } | null = null;
let chargeLoop: { gain: GainNode; osc: OscillatorNode; lfo: OscillatorNode; stop: () => void } | null = null;

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
  if (lobbyMusic) {
    return;
  }

  const ctx = getAudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  const delay = ctx.createDelay(0.32);
  const feedback = ctx.createGain();
  delay.delayTime.value = 0.22;
  feedback.gain.value = 0.18;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);

  const notes = [82.41, 98, 110, 123.47, 110, 98, 92.5, 73.42];
  let step = 0;

  const playStep = () => {
    const now = ctx.currentTime;
    const bass = ctx.createOscillator();
    const bassGain = envelopeGain(ctx, 0.36, 0.015, 0.34);
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(notes[step % notes.length], now);
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start(now);
    bass.stop(now + 0.42);

    if (step % 2 === 0) {
      const lead = ctx.createOscillator();
      const leadGain = envelopeGain(ctx, 0.1, 0.01, 0.18);
      lead.type = 'square';
      lead.frequency.setValueAtTime(notes[(step + 3) % notes.length] * 4, now + 0.05);
      lead.connect(leadGain);
      leadGain.connect(delay);
      lead.start(now + 0.05);
      lead.stop(now + 0.24);
    }

    step += 1;
  };

  playStep();
  const intervalId = window.setInterval(playStep, 360);

  lobbyMusic = {
    stop: () => {
      window.clearInterval(intervalId);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      window.setTimeout(() => master.disconnect(), 250);
    },
  };
}

export function stopLobbyMusic() {
  lobbyMusic?.stop();
  lobbyMusic = null;
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
