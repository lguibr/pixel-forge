
import { ZoneType, Archetype, CreatureSize } from '../types';

const GRID = 32;
const CENTER = 16;

// --- UTILS ---

const fill = (grid: ZoneType[][], x: number, y: number, w: number, h: number, type: ZoneType) => {
  const startY = Math.floor(Math.max(0, y));
  const startX = Math.floor(Math.max(0, x));
  const endY = Math.floor(Math.min(GRID, y + h));
  const endX = Math.floor(Math.min(GRID, x + w));

  for (let cy = startY; cy < endY; cy++) {
    for (let cx = startX; cx < endX; cx++) {
      grid[cy][cx] = type;
    }
  }
};

const drawSymmetrical = (grid: ZoneType[][], x: number, y: number, w: number, h: number, type: ZoneType) => {
  fill(grid, x, y, w, h, type); 
  const mirrorX = GRID - (x + w); 
  fill(grid, mirrorX, y, w, h, type); 
};

// --- SCALING LOGIC ---

// Returns the radius (half-size) in pixels for the bounding box
const getRadius = (s: CreatureSize): number => {
  switch(s) {
    case 'Fine': return 3;       // 6x6 box
    case 'Diminutive': return 5; // 10x10 box
    case 'Tiny': return 8;       // 16x16 box
    case 'Small': return 12;     // 24x24 box
    case 'Medium': return 15;    // 30x30 box (Standard)
    default: return 16;          // 32x32 box (Full)
  }
};

const getBounds = (s: CreatureSize) => {
  const r = getRadius(s);
  return {
    min: CENTER - r,
    max: CENTER + r,
    size: r * 2,
    c: CENTER
  };
};

// --- ITEM GENERATORS ---
// Updated to Center the 'Handle' (Core) at Y=0.5 (Middle of bounds) to prevent clipping when equipped

const generateItem = (grid: ZoneType[][], archetype: Archetype, size: CreatureSize) => {
  const b = getBounds(size);
  const { min, max, size: s } = b;

  // Helper for relative scaling within bounds
  const px = (percent: number) => Math.floor(min + (s * percent));
  const py = (percent: number) => Math.floor(min + (s * percent));
  const sw = (percent: number) => Math.max(1, Math.floor(s * percent));
  const sh = (percent: number) => Math.max(1, Math.floor(s * percent));

  switch (archetype) {
    case 'Sword':
      // Overlapping logic to prevent gaps
      // 1. Blade (Top to Mid)
      fill(grid, px(0.42), py(0.05), sw(0.16), sh(0.55), 'weapon');
      // 2. Guard (Mid) - Wide
      fill(grid, px(0.25), py(0.55), sw(0.5), sh(0.1), 'accessory');
      // 3. Handle (Mid to Bottom) - Centered under guard
      fill(grid, px(0.45), py(0.6), sw(0.1), sh(0.25), 'core');
      // 4. Pommel
      fill(grid, px(0.42), py(0.85), sw(0.16), sh(0.1), 'accessory');
      break;

    case 'Polearm':
      // 1. Shaft (Long, through center)
      fill(grid, px(0.46), py(0.1), sw(0.08), sh(0.85), 'core');
      // 2. Head (Top)
      if (size === 'Fine' || size === 'Diminutive') {
          fill(grid, px(0.35), py(0.05), sw(0.3), sh(0.25), 'weapon');
      } else {
          // Halberd style
          fill(grid, px(0.35), py(0.05), sw(0.3), sh(0.3), 'weapon');
          fill(grid, px(0.4), py(0.35), sw(0.2), sh(0.05), 'accessory'); // Collar
      }
      break;

    case 'Shield':
      // 1. Main Body
      fill(grid, px(0.2), py(0.2), sw(0.6), sh(0.6), 'core');
      // 2. Rim/Trim (Accessory)
      fill(grid, px(0.15), py(0.2), sw(0.05), sh(0.6), 'accessory');
      fill(grid, px(0.8), py(0.2), sw(0.05), sh(0.6), 'accessory');
      fill(grid, px(0.15), py(0.15), sw(0.7), sh(0.05), 'accessory');
      fill(grid, px(0.15), py(0.8), sw(0.7), sh(0.05), 'accessory');
      // 3. Boss (Center)
      fill(grid, px(0.4), py(0.4), sw(0.2), sh(0.2), 'weapon');
      break;

    case 'Headwear':
      // Dome/Top
      fill(grid, px(0.3), py(0.2), sw(0.4), sh(0.3), 'head');
      // Brim/Bottom
      fill(grid, px(0.2), py(0.5), sw(0.6), sh(0.1), 'accessory');
      // Decoration
      fill(grid, px(0.6), py(0.25), sw(0.1), sh(0.2), 'accessory');
      break;

    case 'Body Armor':
      // Main Plate
      fill(grid, px(0.2), py(0.15), sw(0.6), sh(0.6), 'core');
      // Shoulders
      fill(grid, px(0.1), py(0.15), sw(0.2), sh(0.25), 'accessory');
      fill(grid, px(0.7), py(0.15), sw(0.2), sh(0.25), 'accessory');
      // Trim
      fill(grid, px(0.35), py(0.25), sw(0.3), sh(0.4), 'accessory');
      break;

    case 'Legwear':
      // Belt/Waist
      fill(grid, px(0.25), py(0.1), sw(0.5), sh(0.2), 'core');
      // Legs
      fill(grid, px(0.25), py(0.3), sw(0.2), sh(0.6), 'legs');
      fill(grid, px(0.55), py(0.3), sw(0.2), sh(0.6), 'legs');
      break;
    
    case 'Handwear':
      // Left Gauntlet (Matches Humanoid Hand L)
      fill(grid, px(0.1), py(0.25), sw(0.15), sh(0.3), 'hand_l');
      fill(grid, px(0.12), py(0.55), sw(0.1), sh(0.1), 'accessory'); // Cuff

      // Right Gauntlet (Matches Humanoid Hand R)
      fill(grid, px(0.75), py(0.25), sw(0.2), sh(0.1), 'hand_r');
      fill(grid, px(0.7), py(0.25), sw(0.05), sh(0.1), 'accessory'); // Cuff
      break;

    case 'Footwear':
      // Left Boot (Matches Humanoid Leg L)
      fill(grid, px(0.3), py(0.7), sw(0.15), sh(0.2), 'legs'); // Shaft
      fill(grid, px(0.3), py(0.9), sw(0.15), sh(0.05), 'accessory'); // Sole

      // Right Boot (Matches Humanoid Leg R)
      fill(grid, px(0.55), py(0.7), sw(0.15), sh(0.2), 'legs'); // Shaft
      fill(grid, px(0.55), py(0.9), sw(0.15), sh(0.05), 'accessory'); // Sole
      break;

    case 'Accessory':
      // Generic Ring/Amulet
      fill(grid, px(0.35), py(0.3), sw(0.3), sh(0.3), 'accessory'); // Band/Chain
      fill(grid, px(0.4), py(0.35), sw(0.2), sh(0.2), 'weapon'); // Gem
      break;
      
    default:
      fill(grid, px(0.2), py(0.2), sw(0.6), sh(0.6), 'core');
      break;
  }
};


// --- CREATURE LOGIC (Strict Bounding Box) ---

const generateCreature = (grid: ZoneType[][], archetype: Archetype, size: CreatureSize) => {
  const b = getBounds(size);
  const { min, max, size: s } = b;

  const px = (p: number) => Math.floor(min + (s * p));
  const py = (p: number) => Math.floor(min + (s * p));
  const sw = (p: number) => Math.max(1, Math.floor(s * p));
  const sh = (p: number) => Math.max(1, Math.floor(s * p));

  switch (archetype) {
    case 'Humanoid':
        if (['Fine', 'Diminutive'].includes(size)) {
            // Stick figure logic for Micro
            fill(grid, px(0.4), py(0.0), sw(0.2), sh(0.3), 'head');
            fill(grid, px(0.4), py(0.3), sw(0.2), sh(0.4), 'core');
            fill(grid, px(0.2), py(0.3), sw(0.2), sh(0.1), 'hand_l');
            fill(grid, px(0.6), py(0.3), sw(0.2), sh(0.1), 'hand_r');
            fill(grid, px(0.4), py(0.7), sw(0.1), sh(0.3), 'legs');
            fill(grid, px(0.5), py(0.7), sw(0.1), sh(0.3), 'legs');
        } else if (['Tiny', 'Small'].includes(size)) {
            // Chibi / Halfling Proportions (Big Head, Big Feet)
            fill(grid, px(0.2), py(0.0), sw(0.6), sh(0.45), 'head'); 
            fill(grid, px(0.3), py(0.45), sw(0.4), sh(0.3), 'core'); 
            
            fill(grid, px(0.25), py(0.85), sw(0.2), sh(0.15), 'legs');
            fill(grid, px(0.55), py(0.85), sw(0.2), sh(0.15), 'legs');
            fill(grid, px(0.3), py(0.75), sw(0.15), sh(0.1), 'legs');
            fill(grid, px(0.55), py(0.75), sw(0.15), sh(0.1), 'legs');

            // Arms
            fill(grid, px(0.15), py(0.5), sw(0.15), sh(0.2), 'hand_l');
            // Weapon Hand (Extended to side)
            fill(grid, px(0.7), py(0.5), sw(0.2), sh(0.1), 'hand_r');
        } else {
            // Standard
            fill(grid, px(0.35), py(0.05), sw(0.3), sh(0.2), 'head');
            fill(grid, px(0.25), py(0.25), sw(0.5), sh(0.4), 'core');
            
            fill(grid, px(0.3), py(0.65), sw(0.15), sh(0.35), 'legs');
            fill(grid, px(0.55), py(0.65), sw(0.15), sh(0.35), 'legs');

            fill(grid, px(0.1), py(0.25), sw(0.15), sh(0.3), 'hand_l');
            // Weapon Hand
            fill(grid, px(0.75), py(0.25), sw(0.2), sh(0.1), 'hand_r'); 
            fill(grid, px(0.95), py(0.2), sw(0.1), sh(0.1), 'hand_r'); // Tip
        }
        break;

    case 'Quadruped':
        fill(grid, px(0.1), py(0.2), sw(0.3), sh(0.3), 'head');
        fill(grid, px(0.3), py(0.3), sw(0.6), sh(0.4), 'core');
        fill(grid, px(0.3), py(0.7), sw(0.1), sh(0.3), 'legs');
        fill(grid, px(0.8), py(0.7), sw(0.1), sh(0.3), 'legs');
        fill(grid, px(0.9), py(0.4), sw(0.1), sh(0.2), 'accessory');
        break;

    case 'Winged':
        fill(grid, px(0.4), py(0.1), sw(0.2), sh(0.2), 'head');
        fill(grid, px(0.35), py(0.3), sw(0.3), sh(0.4), 'core');
        fill(grid, px(0.0), py(0.1), sw(0.35), sh(0.5), 'back');
        fill(grid, px(0.65), py(0.1), sw(0.35), sh(0.5), 'back');
        fill(grid, px(0.4), py(0.7), sw(0.2), sh(0.3), 'legs');
        break;

    case 'Ethereal':
        fill(grid, px(0.3), py(0.2), sw(0.4), sh(0.3), 'head');
        fill(grid, px(0.35), py(0.5), sw(0.3), sh(0.5), 'core');
        fill(grid, px(0.1), py(0.1), sw(0.2), sh(0.8), 'accessory');
        fill(grid, px(0.7), py(0.1), sw(0.2), sh(0.8), 'accessory');
        break;

    default:
        fill(grid, px(0.2), py(0.2), sw(0.6), sh(0.6), 'core');
  }
};

export const getTemplate = (archetype: Archetype, size: CreatureSize = 'Medium'): ZoneType[][] => {
  const grid: ZoneType[][] = Array(GRID).fill(0).map(() => Array(GRID).fill('none'));

  const itemArchetypes = [
    'Sword', 'Polearm', 'Shield', 'Headwear', 'Body Armor', 
    'Legwear', 'Handwear', 'Footwear', 'Accessory'
  ];

  if (itemArchetypes.includes(archetype)) {
    generateItem(grid, archetype, size);
  } else if (archetype === 'Solid Block') {
    fill(grid, 2, 2, 28, 28, 'core');
  } else if (archetype === 'Landscape/Floor') {
    fill(grid, 0, 0, 32, 32, 'core');
  } else {
    generateCreature(grid, archetype, size);
  }

  return grid;
};
