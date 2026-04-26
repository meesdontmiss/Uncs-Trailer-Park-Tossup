export interface BlueprintSection {
  id: string;
  title: string;
  icon: string;
  content: string;
}

export const blueprintSections: BlueprintSection[] = [
  {
    id: "concept",
    title: "1. Core Match & Loop",
    icon: "Gamepad2",
    content: `
## HIGH-LEVEL GAME CONCEPT
**UNC'S TRAILER PARK TOSSUP** is a lightweight, lobby-based online multiplayer arena game. Players control "UNC"—a bald, sunglasses-wearing, cargo-shorts-sporting old-head—running around cursed regional maps throwing energy drink cans at each other. 

The game is fast, chaotic, and funny. It is not a tactical military shooter. It's a cursed internet-native meme shooter designed around quick movement, projectile prediction, and wager-based PvP.

## NEW ART DIRECTION: 2.5D SPRITE BILLBOARDS
Instead of fully 3D low-poly models, the game will use **2.5D Billboard Sprites** in a 3D environment (similar to Doom or classic Build Engine games), but played from a **Third-Person POV**.

- **The Look:** We use the actual $UNC meme images directly. Backgrounds are removed, and the raw 2D art is placed on flat planes (billboards) positioned in the 3D world.
- **Third-Person FPS:** The camera sits behind your player. You always see the **backside** of your own UNC sprite. 
- **Opponent Angles:** When looking at other players, a script calculates your camera's angle relative to their facing direction and displays the correct sprite frame (Front, Back, Side, Diagonal).
- **Animation:** Intentionally low frame rate. 2-4 frames for running, a single static frame for jumping, and a snappy 2-frame tossing animation. It will feel incredibly native to the 2D meme aesthetic—semi-shitty, charming, and highly addictive.

## CORE GAMEPLAY LOOP
1. **Connect:** Player lands on site and connects Solana wallet.
2. **Lobby:** Browse active wagers or create a private/public lobby.
3. **Escrow:** Select a wager tier and deposit SPL tokens into the Match Escrow.
4. **Play:** Spawn into the 3D arena as a 2D UNC sprite. Run, jump, and throw cans until the win condition is met.
5. **Resolve:** Match ends. Server validates the game state and winner.
6. **Payout:** Escrow automatically distributes the pot (minus optional platform rake) to the winner's wallet.
    `
  },
  {
    id: "art-pipeline",
    title: "2. Art Pipeline & Sprites",
    icon: "Image",
    content: `
## 2D-TO-3D CHARACTER PIPELINE
To capture the exact $UNC vibe from the reference images, we will build a sprite-sheet generator pipeline:

### 1. Asset Extraction
Take the raw $UNC art (UNC at a casino, UNC on a boat, UNC fishing) and isolate the character from the background. 

### 2. Generative Angle Creation
Use manual tracing or generative inpainting to create the missing directional angles of the exact same 2D drawings. We need:
- **Front** (Facing Camera)
- **Back** (Facing Away - What the local player sees)
- **Left Profile**
- **Right Profile** 
- *(Optional: 4 Diagonal angles for an 8-way directional system)*

### 3. Billboard Implementation (React Three Fiber)
Every player in the game is a flat 3D plane (\`PlaneGeometry\`).
- A custom shader or \`useFrame\` hook forces the plane to always face the local camera (\`Billboard\`).
- The script compares the opponent's rotation vector with the local camera's view vector to instantly snap the texture to the correct directional sprite.

### 4. Environmental Aesthetic
The 3D world (Trailer Park, Dock) will use a mix of flat-shaded low-poly geometry and photobashed 2D billboard props (e.g., a 2D picture of a lawn chair that always faces the camera). This creates a cursed, collage-like aesthetic that perfectly matches the meme.
    `
  },
  {
    id: "architecture",
    title: "3. Tech Architecture",
    icon: "Server",
    content: `
## RECOMMENDED TECH STACK
- **Frontend / Client:** React + React Three Fiber (R3F) for rendering the 3D world and 2.5D sprite billboards.
- **Backend / Game Server:** Node.js (Express) with WebSockets (Socket.IO / uWebSockets.js) for high-tickrate real-time sync.
- **Database:** PostgreSQL (via Supabase) for persisting user profiles, match history, transaction logs, and leaderboards.
- **Blockchain / Web3:** Solana Web3.js + Solana Wallet Adapter. Custom Rust Smart Contract (Anchor) for the wager escrow pool.

## SYSTEM ARCHITECTURE
- **Browser Client:** Handles rendering the 3D world, camera logic (Third Person), billboard orientation, and user input.
- **Authoritative Node Server:** Runs a headless version of the game physics. Processes inputs, validates hits, tracks scores, and dictates match lifecycle.
- **Escrow Smart Contract:** Holds funds statelessly during exactly the time a match is in progress. Can be called by an authoritative server wallet to disburse funds.
    `
  },
  {
    id: "wager-system",
    title: "4. Wager & Settlement",
    icon: "Coins",
    content: `
## WAGER ESCROW & PAYOUT FLOW
This is an SPL token-based wager system seamlessly integrated into the lobby flow.

1. **Pre-Match Lock-in:** Players join a lobby and click "Ready". They sign a transaction sending tokens to the Match Escrow Contract PDA.
2. **Verification:** The backend monitors the Solana chain. Once it confirms all deposits, Match State = \`IN_PROGRESS\`.
3. **Settlement:** When the game ends, the Node server signs a transaction calling the Escrow Contract's \`resolve_match\` instruction.
4. **Distribution:** The contract releases funds directly to the winner.

## FAILURE CASE HANDLING
- **Failed Deposit:** If a player rejects the Tx or it times out, lobby reverts and refunds any existing depositors.
- **Mid-Match Disconnect:** Standard mode: Dropping connection counts as a forfeit. Opponent instantly wins by default.
- **Server Crash:** If the server drops the match unexpectedly, it marks the match \`CANCELLED\`. The Escrow Contract refunds all participants 100%.
    `
  },
  {
    id: "gameplay",
    title: "5. Combat Mechanics",
    icon: "Crosshair",
    content: `
## PLAYER CONTROLLER (MOVEMENT)
- **Perspective:** Third-Person POV. Camera is locked behind the 2D back-facing sprite of UNC.
- **Base speed:** Fast, snappy, arcade-like. No acceleration curve.
- **Abilities:** Standard Jump, Crouch. 
- **Tech:** A tiny amount of air control to reward movement skill.

## COMBAT & WEAPON: ENERGY DRINK CAN
- **Mechanics:** Left-click to throw a 2D rotating sprite of a Monster-style can toward the crosshair.
- **Trajectory:** Fast projectile speed with minimal arc. 
- **Damage Math:** Base health is 100. Cans do 34 damage (requires 3 hits to kill).
- **Feedback:** Loud aluminum "BONK" sound, a 2D fizz sprite burst on hit, and a clear UI hit-marker.

## V1 MODES
1. **1v1 DUEL:** Fixed wager. Last player alive wins. High tension, easiest to settle.
2. **SMALL FFA:** 4-6 players. Last man standing takes first; most kills outside first earns the second-place bonus.
3. **PRIVATE FRIEND LOBBY:** Invite code based, custom wager setup.
    `
  },
  {
    id: "level-design",
    title: "6. Map Design",
    icon: "MapLayout",
    content: `
## LEVEL DESIGN PHILOSOPHY
Compact arenas, fast route comprehension, strong visual landmarks.

### MAP 1: TRAILER PARK (V1 Launch Map)
- **Vibe:** The iconic starter map. Compact, recognizable.
- **Features:** Flat-shaded 3D doublewide trailers bridging a small dirt courtyard. Chain-link fences marking the perimeter.
- **Cover Items (2D Billboards):** Lawn chairs, an above-ground pool, rusty satellite dishes—all rendered as flat 2D images scattered in the 3D space to match the characters.

### MAP 2: BAIT & TACKLE (Planned)
- **Vibe:** Southern old-head boat dock energy.
- **Cover Items:** Bait freezers, docks, 2D boats scattered around.

### MAP 3: GARAGE TRADING BUNKER (Planned)
- **Vibe:** UNC's command center.
- **Cover Items:** 2D CRT monitors, folding chairs, empty XL energy cans.
    `
  },
  {
    id: "build-plan",
    title: "7. Phased Build Plan",
    icon: "Rocket",
    content: `
## WHAT TO BUILD FIRST vs LATER

### Phase 1: The 2.5D Prototype (Local)
- Build the R3F 2.5D character controller (Third person camera following a flat plane).
- Implement the 8-way directional sprite swapping logic.
- Implement 2D can-throwing mechanics with 3D physics.
- *Goal: Make the mix of 2D memes and 3D gameplay feel right.*

### Phase 2: Authoritative Multiplayer
- Stand up Node.js WebSocket server.
- Sync 2.5D players locally. Ensure sprite rotations update correctly across the network.
- Add Trailer Park map geometry mixed with 2D props.

### Phase 3: Web3 Integration
- Integrate Solana Wallet Adapter to UI.
- Build the match lifecycle state machine.
- Deploy Escrow Smart Contract.

### Phase 4: Polish & Launch (V1)
- Add audio (footsteps, bonks).
- Deploy to Mainnet. 
    `
  }
];
