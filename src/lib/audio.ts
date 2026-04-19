// Procedural Retro Audio Synthesizer
// Fits the early-web meme game aesthetic perfectly without 404ing external audio files.

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export function playCanImpactSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  // Create a metallic "clank/clunk" sound using FM synthesis
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  // Route: oscillators -> filter -> gain -> out
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Settings for a metallic "tink"
  osc1.type = 'square';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);

  // Filter to cut off harsh highs
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

  // Envelope for sharp hit
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

  osc1.start();
  osc2.start();
  osc1.stop(audioCtx.currentTime + 0.2);
  osc2.stop(audioCtx.currentTime + 0.2);
}

export function playKillSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // Create a layered "Ka-ching" sound
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const osc3 = audioCtx.createOscillator();
  
  const gain1 = audioCtx.createGain();
  const gain2 = audioCtx.createGain();
  const gain3 = audioCtx.createGain();
  
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);

  // High metallic ping (the "Ting")
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(3000, audioCtx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
  osc1.connect(gain1);
  gain1.connect(masterGain);
  gain1.gain.setValueAtTime(0, audioCtx.currentTime);
  gain1.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.01);
  gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

  // Mid mechanical clack (the slide)
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  gain2.gain.setValueAtTime(0, audioCtx.currentTime);
  gain2.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  // Low clunk (the drawer opening)
  osc3.type = 'sawtooth';
  osc3.frequency.setValueAtTime(150, audioCtx.currentTime + 0.1);
  osc3.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
  osc3.connect(gain3);
  gain3.connect(masterGain);
  gain3.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
  gain3.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 0.12);
  gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

  osc1.start(audioCtx.currentTime);
  osc2.start(audioCtx.currentTime);
  osc3.start(audioCtx.currentTime + 0.1);
  
  osc1.stop(audioCtx.currentTime + 0.4);
  osc2.stop(audioCtx.currentTime + 0.2);
  osc3.stop(audioCtx.currentTime + 0.4);
}

export function playDeathBassSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  // Strong sub-bass kick
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.type = 'sine'; // Sine wave for clean sub punch
  
  // Pitch envelope: starts highish (punch) drops rapidly to very low (sub)
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
  
  // Gain envelope: instant peak, quick decay
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.6);
}

export function playThrowSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
  
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}
