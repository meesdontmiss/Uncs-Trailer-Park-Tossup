interface MobileControlsState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  throwRequestId: number;
}

const state: MobileControlsState = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  jump: false,
  throwRequestId: 0,
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

export function requestMobileThrow() {
  state.throwRequestId += 1;
}

export function readMobileControls() {
  const snapshot = { ...state };
  state.lookX = 0;
  state.lookY = 0;
  return snapshot;
}
