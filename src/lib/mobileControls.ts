interface MobileControlsState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  throwHeld: boolean;
}

const state: MobileControlsState = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  jump: false,
  throwHeld: false,
};

export function setMobileMove(x: number, y: number) {
  state.moveX = Math.max(-1, Math.min(1, x));
  state.moveY = Math.max(-1, Math.min(1, y));
}

export function setMobileLookDelta(x: number, y: number) {
  state.lookX += x;
  state.lookY += y;
}

export function setMobileJump(active: boolean) {
  state.jump = active;
}

export function setMobileThrowHeld(active: boolean) {
  state.throwHeld = active;
}

export function readMobileControls() {
  const snapshot = { ...state };
  state.lookX = 0;
  state.lookY = 0;
  return snapshot;
}
