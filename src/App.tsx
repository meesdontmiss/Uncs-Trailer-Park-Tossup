import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Gamepad2, Server, Coins, Crosshair, Map as MapIcon, Image as ImageIcon, Rocket, Terminal, Menu, X, Camera, RotateCcw, Play } from 'lucide-react';
import { blueprintSections } from './blueprintData';
import { useGameStore } from './store';
import { GameWorld } from './components/game/GameWorld';
import { HUD } from './components/game/HUD';
import { Player } from './components/game/Player'; // We import this just to ensure it compiles, not rendered here.

// Map icons to the blueprint sections
const iconMap: Record<string, React.ReactNode> = {
  Gamepad2: <Gamepad2 size={18} />,
  Server: <Server size={18} />,
  Coins: <Coins size={18} />,
  Crosshair: <Crosshair size={18} />,
  MapLayout: <MapIcon size={18} />,
  Image: <ImageIcon size={18} />,
  Rocket: <Rocket size={18} />
};

function SpriteDemo() {
  const [angle, setAngle] = useState(0);
  // (SpriteDemo logic remains unchanged here - removed interval for stability initially if desired, but we can leave it simple for manual rotation)
  const getSpriteIndex = () => {
    if (angle >= 337.5 || angle < 22.5) return 'FRONT';
    if (angle >= 22.5 && angle < 67.5) return 'FRONT-RIGHT';
    if (angle >= 67.5 && angle < 112.5) return 'RIGHT';
    if (angle >= 112.5 && angle < 157.5) return 'BACK-RIGHT';
    if (angle >= 157.5 && angle < 202.5) return 'BACK';
    if (angle >= 202.5 && angle < 247.5) return 'BACK-LEFT';
    if (angle >= 247.5 && angle < 292.5) return 'LEFT';
    if (angle >= 292.5 && angle < 337.5) return 'FRONT-LEFT';
    return 'FRONT';
  };

  return (
    <div className="mt-8 border border-monster/50 rounded-lg p-6 bg-ps-gray">
      <div className="flex items-center gap-2 mb-4 text-monster font-pixel text-xl uppercase">
        <Camera size={20} />
        <h2>2.5D Billboard Sprite Engine Demo</h2>
      </div>
      <p className="font-mono text-sm text-gray-400 mb-6">
        Click to rotate the camera. Notice how the Sprite Sheet Index updates to always show the correct angle relative to the viewer.
      </p>
      
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center p-8 border border-dashed border-gray-700 rounded bg-black/40">
        <div className="relative w-48 h-48 flex items-center justify-center border border-gray-800 rounded-full bg-ps-panel">
          <div className="absolute inset-0 border-2 border-dashed border-gray-700 rounded-full" style={{ transform: `rotate(${angle}deg)` }}></div>
          <div className="absolute top-2 text-xs font-mono text-gray-500">N</div>
          <div className="absolute bottom-2 text-xs font-mono text-gray-500">S</div>
          <div className="text-center z-10 flex flex-col items-center">
            <span className="font-pixel text-3xl text-white">{getSpriteIndex()}</span>
            <div className="bg-monster text-black font-bold font-mono text-xs px-2 py-1 mt-2 rounded">
              SPRITE_{Math.floor(angle/45)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 font-mono text-xs text-gray-400 max-w-xs">
          <div className="flex justify-between border-b border-gray-800 pb-2">
            <span>Camera Angle:</span><span className="text-white">{angle}°</span>
          </div>
          <button 
            onClick={() => setAngle(a => (a + 45) % 360)}
            className="mt-4 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded transition-colors"
          >
            <RotateCcw size={14} /> Manually Rotate Camera
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(blueprintSections[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { status, startGame, endGame } = useGameStore();

  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && useGameStore.getState().status === 'PLAYING') {
        endGame();
      }
    };
    
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, [endGame]);

  const handleStartGame = () => {
    startGame();
    // Use setTimeout to ensure DOM is ready before locking pointer
    setTimeout(() => {
      document.body.requestPointerLock();
    }, 100);
  };
  
  const activeContent = blueprintSections.find(s => s.id === activeTab)?.content || '';

  if (status === 'PLAYING') {
    return (
      <div className="w-full h-screen bg-black relative">
        <GameWorld />
        <HUD />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-ps-gray overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 w-full h-16 bg-ps-panel border-b border-gray-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <Terminal className="text-monster" size={24} />
          <h1 className="font-pixel text-2xl text-monster uppercase h-full flex items-center pt-2">UNC'S TOSSUP</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Sidebar Desktop & Mobile */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-200 ease-in-out
        absolute md:relative z-40 top-0 left-0 h-full w-72 bg-ps-panel border-r border-gray-800 flex flex-col pt-16 md:pt-0
      `}>
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-gray-800">
          <Terminal className="text-monster" size={32} />
          <h1 className="font-pixel text-3xl text-monster uppercase leading-none mt-2 drop-shadow-[0_2px_2px_rgba(130,255,0,0.3)]">UNC'S TOSSUP</h1>
        </div>

        <div className="p-4 border-b border-gray-800">
          <button 
            onClick={handleStartGame}
            className="w-full bg-monster hover:bg-monster-dark text-black font-pixel text-xl py-3 rounded uppercase transition-colors flex items-center justify-center gap-2"
          >
            <Play fill="currentColor" size={20} />
            Connect & Play V1 Prototype
          </button>
        </div>
        
        <div className="px-6 py-4 overflow-y-auto">
          <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-4 font-bold border-b border-gray-800 pb-2">SYS_BLUEPRINT_v1.0</p>
          <nav className="flex flex-col gap-2">
            {blueprintSections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveTab(section.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded text-left font-mono text-sm transition-colors
                  ${activeTab === section.id 
                    ? 'bg-monster/10 text-monster border border-monster/30 drop-shadow-[0_0_8px_rgba(130,255,0,0.15)]' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white border border-transparent'}
                `}
              >
                <div className={`${activeTab === section.id ? 'text-monster' : 'text-gray-500'}`}>
                  {iconMap[section.icon]}
                </div>
                <span className="font-medium pt-0.5">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 text-xs text-gray-600 font-mono">
          <p>AUTHOR: DEV</p>
          <p>STATUS: DRAFT</p>
          <p>DATE: 2026</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative pt-16 md:pt-0">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ backgroundImage: 'linear-gradient(var(--color-monster) 1px, transparent 1px), linear-gradient(90deg, var(--color-monster) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12 relative z-10">
          <div className="bg-ps-panel/50 backdrop-blur-sm border border-gray-800 rounded-lg p-6 md:p-10 shadow-2xl">
            <div className="markdown-body">
              <ReactMarkdown>{activeContent}</ReactMarkdown>
            </div>
            {activeTab === 'art-pipeline' && <SpriteDemo />}
          </div>
        </div>
      </main>
    </div>
  );
}
