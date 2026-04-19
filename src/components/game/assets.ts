// Fallback 2D placeholder for the Monster Can until we generate a final asset with Nano Banana
const svgCan = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
  <defs>
    <linearGradient id="canGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2a2a2a"/>
      <stop offset="50%" stop-color="#111"/>
      <stop offset="100%" stop-color="#2a2a2a"/>
    </linearGradient>
  </defs>
  <rect x="25" y="30" width="50" height="140" rx="5" fill="url(#canGrad)" stroke="#555" stroke-width="2"/>
  <path d="M 25 35 Q 50 25 75 35" fill="none" stroke="#ccc" stroke-width="4"/>
  <path d="M 25 165 Q 50 175 75 165" fill="none" stroke="#ccc" stroke-width="4"/>
  <path d="M 35 60 L 40 100 L 45 70 L 50 110 L 55 70 L 60 100 L 65 60" fill="none" stroke="#7eff00" stroke-width="5" stroke-linejoin="miter"/>
  <rect x="35" y="130" width="30" height="4" fill="#7eff00"/>
  <rect x="40" y="140" width="20" height="3" fill="#fff"/>
</svg>`);

const svgImpact = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 50 10 L 60 40 L 90 50 L 60 60 L 50 90 L 40 60 L 10 50 L 40 40 Z" fill="#7eff00" stroke="#fff" stroke-width="2"/>
  <circle cx="50" cy="50" r="15" fill="#fff"/>
</svg>`);

export const assets = {
  sprites: {
    unc: [
      '/UNC-FRONT 0 .png',
      '/UNC-25-degree-turn.png',
      '/UNC-side-view.png',
      '/UNC-backside-slightly right turn view.png',
      '/UNC-direct-backside-view.png',
      '/UNC-backside-slightly-left-turn-view.png',
      '/UNC-opposite-side-view.png',
      '/UNC-270-degree-turn.png',
    ],
    UNC_BACK: '/UNC-direct-backside-view.png',
    UNC_SHOOT_BACK: '/UNC-SHOOT-direct-backside-view.png',
    CAN: `data:image/svg+xml;utf8,${svgCan}`,
    IMPACT: `data:image/svg+xml;utf8,${svgImpact}`,
  }
};
