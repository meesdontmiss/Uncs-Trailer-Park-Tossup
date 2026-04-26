import { GameWorld } from './GameWorld';
import { HUD } from './HUD';

export default function GameExperience() {
  return (
    <div className="w-full h-screen bg-black relative">
      <GameWorld />
      <HUD />
    </div>
  );
}
