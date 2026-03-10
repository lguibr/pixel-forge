
import React, { useState, useCallback, useRef } from 'react';
import { ZoneType, Archetype, CreatureSize } from '../types';

interface BlueprintEditorProps {
  blueprint: ZoneType[][];
  onChange: (blueprint: ZoneType[][]) => void;
  archetype?: Archetype;
  size?: CreatureSize;
  onReset?: () => void;
}

const GRID_SIZE = 32;

const ZONES: { id: ZoneType; label: string; color: string; ring: string; short: string }[] = [
  { id: 'core', label: 'Core / Body', short: 'C', color: 'bg-amber-500', ring: 'ring-amber-500' },
  { id: 'head', label: 'Head', short: 'H', color: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'hand_l', label: 'L Hand', short: 'L', color: 'bg-cyan-500', ring: 'ring-cyan-500' },
  { id: 'hand_r', label: 'R Hand', short: 'R', color: 'bg-indigo-500', ring: 'ring-indigo-500' },
  { id: 'weapon', label: 'Weapon', short: 'W', color: 'bg-red-500', ring: 'ring-red-500' },
  { id: 'legs', label: 'Legs', short: 'LG', color: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'back', label: 'Back/Wings', short: 'B', color: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'accessory', label: 'Accessory', short: 'A', color: 'bg-orange-400', ring: 'ring-orange-400' },
  { id: 'none', label: 'Eraser', short: 'X', color: 'bg-zinc-800', ring: 'ring-zinc-500' },
];

const getSizeBounds = (size: CreatureSize) => {
  const center = 16;
  let halfSize = 16;
  
  switch(size) {
    case 'Fine': halfSize = 3; break;       
    case 'Diminutive': halfSize = 5; break; 
    case 'Tiny': halfSize = 8; break;       
    case 'Small': halfSize = 12; break;     
    case 'Medium': halfSize = 15; break;    
    default: halfSize = 16;                 
  }
  
  return {
    start: center - halfSize,
    end: center + halfSize,
    sizePx: halfSize * 2
  };
};

export const BlueprintEditor: React.FC<BlueprintEditorProps> = ({ blueprint, onChange, archetype, size = 'Medium', onReset }) => {
  const [activeZone, setActiveZone] = useState<ZoneType>('core');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ZoneType[][][]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const bounds = getSizeBounds(size as CreatureSize);

  const startDrawing = () => {
    setHistory(prev => [...prev.slice(-10), JSON.parse(JSON.stringify(blueprint))]);
    setIsDrawing(true);
  };

  const updateCell = useCallback((x: number, y: number, type: ZoneType) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
    if (blueprint[y][x] === type) return;
    
    const newGrid = blueprint.map((row, ry) => 
      ry === y ? row.map((cell, cx) => cx === x ? type : cell) : row
    );
    onChange(newGrid);
  }, [blueprint, onChange]);

  const handlePointerDown = (e: React.PointerEvent, x: number, y: number) => {
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    startDrawing();
    updateCell(x, y, activeZone);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    updateCell(x, y, activeZone);
  };

  const handlePointerUp = () => setIsDrawing(false);

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onChange(last);
  };

  const handleReset = () => {
    setHistory(prev => [...prev.slice(-10), JSON.parse(JSON.stringify(blueprint))]);
    if (onReset) onReset();
    else onChange(Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill('none')));
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex justify-between items-center p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
         <div className="flex gap-2">
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Editor Tools</span>
                <span className="text-[9px] text-zinc-600">Map out the structure</span>
            </div>
         </div>
         <div className="flex gap-2">
            <button 
                onClick={undo} 
                disabled={history.length === 0}
                className="px-3 py-1.5 text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-zinc-200 transition-colors"
            >
                Undo
            </button>
            <button 
                onClick={handleReset} 
                className="px-3 py-1.5 text-[10px] font-medium bg-zinc-800 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded transition-colors"
            >
                Reset
            </button>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Palette */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 overflow-y-auto lg:w-32 pr-1 custom-scrollbar shrink-0">
          {ZONES.map(z => (
            <button
              key={z.id}
              onClick={() => setActiveZone(z.id)}
              className={`
                group flex items-center gap-3 p-2 rounded-md border transition-all
                ${activeZone === z.id 
                  ? 'bg-zinc-800 border-zinc-600 shadow-md' 
                  : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'
                }
              `}
            >
              <div className={`w-4 h-4 rounded shadow-sm ${z.color} ${activeZone === z.id ? `ring-2 ring-offset-2 ring-offset-zinc-950 ${z.ring}` : ''}`} />
              <div className="flex flex-col items-start min-w-0">
                <span className={`text-[10px] font-bold leading-none ${activeZone === z.id ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{z.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 rounded-xl border border-zinc-900 p-4 relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            <div 
                ref={gridRef}
                className="relative aspect-square h-full max-h-[400px] border border-zinc-800 bg-black shadow-2xl cursor-crosshair touch-none"
                style={{ 
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` 
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {blueprint.map((row, y) => (
                row.map((cell, x) => (
                    <div 
                    key={`${x}-${y}`}
                    onPointerDown={(e) => handlePointerDown(e, x, y)}
                    className={`relative ${cell === 'none' ? '' : ZONES.find(z => z.id === cell)?.color}`}
                    style={{
                        opacity: cell === 'none' ? 0.05 : 0.9,
                        // Guide lines for center
                        borderRight: x === 15 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        borderBottom: y === 15 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                    >
                        {/* Render Bounds Overlay */}
                        {cell === 'none' && x >= bounds.start && x < bounds.end && y >= bounds.start && y < bounds.end && (
                            <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                        )}
                    </div>
                ))
                ))}
                
                {/* Visual Bounds Box */}
                <div 
                    className="absolute border border-amber-500/30 pointer-events-none transition-all duration-300"
                    style={{
                        left: `${(bounds.start / GRID_SIZE) * 100}%`,
                        top: `${(bounds.start / GRID_SIZE) * 100}%`,
                        width: `${(bounds.sizePx / GRID_SIZE) * 100}%`,
                        height: `${(bounds.sizePx / GRID_SIZE) * 100}%`,
                        boxShadow: '0 0 20px rgba(245,158,11,0.05)'
                    }}
                >
                     <div className="absolute -top-3 left-0 text-[8px] font-mono text-amber-500/50 bg-black px-1">
                        {size.toUpperCase()}
                     </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
