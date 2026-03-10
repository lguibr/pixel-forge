
import { GoogleGenAI, Type } from "@google/genai";
import { GenerationConfig, ZoneType, AssetType, Archetype } from "../types";

const FALLBACK_COLORS: Record<string, string> = {
    'core': '#5D4037',      // Wood/Leather/Dark Body
    'head': '#FFCC80',      // Skin/Helmet
    'hand_l': '#FFCC80',    // Skin
    'hand_r': '#FFCC80',    // Skin
    'weapon': '#CFD8DC',    // Steel
    'legs': '#3E2723',      // Dark Leather
    'back': '#90A4AE',      // Cloak/Wings
    'accessory': '#FFD700', // Gold
    'none': 'transparent'
};

const TERRAIN_ARCHETYPES = ['Solid Block', 'Landscape/Floor'];
const ITEM_ARCHETYPES = ['Sword', 'Polearm', 'Shield', 'Headwear', 'Body Armor', 'Legwear', 'Handwear', 'Footwear', 'Accessory'];

// Estimated Pricing (Per 1M Tokens)
const PRICING = {
    'gemini-flash-lite-latest': { input: 0.075, output: 0.30 },
    'gemini-flash-latest': { input: 0.10, output: 0.40 },
    'gemini-3-flash-preview': { input: 0.15, output: 0.60 }, // Estimated
    'gemini-3-pro-preview': { input: 1.25, output: 5.00 },
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  // Converts the blueprint into a visual ASCII grid for the AI to "see"
  private gridToAscii(blueprint: ZoneType[][]): string {
    const map: Record<ZoneType, string> = {
        'none': '.',
        'core': '#',
        'head': 'O',
        'hand_l': 'l',
        'hand_r': 'r',
        'weapon': 'X',
        'legs': 'L',
        'back': 'B',
        'accessory': '+'
    };

    return blueprint.map(row => row.map(cell => map[cell] || '.').join('')).join('\n');
  }

  // Safety net: Fills gaps where the AI returned transparency but the blueprint demanded structure
  private postProcessPixelData(generated: string[][], blueprint: ZoneType[][]): string[][] {
    return generated.map((row, y) => 
        row.map((color, x) => {
            const zone = blueprint[y]?.[x] || 'none';
            const isTransparent = !color || color === 'transparent' || color === 'none';
            
            // If the AI gave us a valid color, keep it
            if (!isTransparent) return color;

            // If the AI gave transparency, but the blueprint says there SHOULD be something here,
            // we enforce a fallback color so the asset is not invisible.
            if (zone !== 'none') {
                return FALLBACK_COLORS[zone] || '#808080';
            }

            return 'transparent';
        })
    );
  }

  private cleanJson(text: string): string {
    if (!text) return "[]";
    // 1. Remove markdown code blocks
    let clean = text.replace(/```json/g, '').replace(/```/g, '');
    
    // 2. Extract JSON array if embedded in text
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      clean = clean.substring(start, end + 1);
    } else {
        // Fallback: Check if it's wrapped in an object like { "data": [...] }
        const objStart = clean.indexOf('{');
        const objEnd = clean.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1) {
             clean = clean.substring(objStart, objEnd + 1);
        }
    }

    // 3. Fix potential single quotes (Python style) to double quotes for valid JSON
    // Note: This is safe because hex codes and 'transparent' don't contain internal quotes.
    clean = clean.replace(/'/g, '"');

    return clean;
  }

  private validateAndRepairGrid(data: any): string[][] {
      let grid = data;

      // Case 1: Wrapped in object (e.g. { grid: [...] })
      if (!Array.isArray(grid) && typeof grid === 'object' && grid !== null) {
          const possibleArray = Object.values(grid).find(val => Array.isArray(val) && val.length > 0);
          if (possibleArray) {
              grid = possibleArray;
          }
      }

      // Case 2: 1D Array (Flattened)
      if (Array.isArray(grid) && grid.length > 32 && !Array.isArray(grid[0])) {
          // Assume it's a flattened 32x32 (1024) or similar
          const newGrid = [];
          const chunkSize = 32;
          for (let i = 0; i < grid.length; i += chunkSize) {
              if (newGrid.length >= 32) break;
              newGrid.push(grid.slice(i, i + chunkSize));
          }
          grid = newGrid;
      }

      // Case 3: Ensure 2D Array
      if (!Array.isArray(grid)) {
          console.warn("Parsed data is not an array, resetting to empty.");
          grid = [];
      }

      // Repair Dimensions to 32x32
      // 1. Fix Rows
      if (grid.length > 32) {
          grid = grid.slice(0, 32);
      }
      while (grid.length < 32) {
          grid.push(Array(32).fill('transparent'));
      }

      // 2. Fix Columns
      grid = grid.map((row: any) => {
          if (!Array.isArray(row)) return Array(32).fill('transparent');
          
          let newRow = [...row]; // Copy to avoid mutation issues
          if (newRow.length > 32) {
              newRow = newRow.slice(0, 32);
          }
          while (newRow.length < 32) {
              newRow.push('transparent');
          }
          // Ensure String Strings
          return newRow.map((cell: any) => (typeof cell === 'string' ? cell : 'transparent'));
      });

      return grid;
  }

  // --- PROMPT ENGINEERING ENGINE ---
  private enhancePrompt(rawPrompt: string, type: AssetType, archetype: Archetype): string {
    const baseStyle = "Style: Masterpiece 16-bit pixel art, fantasy D&D RPG aesthetic, vibrant colors, high contrast, clean distinct pixels.";
    
    // 1. TERRAIN / LANDSCAPE
    if (TERRAIN_ARCHETYPES.includes(archetype) || type === 'Terrain' || type === 'Environment') {
        return `
        Task: Create a seamless, tiling texture for a "${rawPrompt}".
        Context: Top-down RPG map tile (floor/ground/wall).
        Details: The pattern MUST be seamless and repeatable (tiling). No isolated objects. Fill the entire surface with the texture.
        ${baseStyle}
        `.trim();
    }
    
    // 2. ITEMS / GEAR
    if (ITEM_ARCHETYPES.includes(archetype) || type === 'Item') {
        return `
        Task: Create an iconic inventory sprite of a "${rawPrompt}".
        Context: Legendary RPG item.
        Details: Centered, fits within 32x32. Emphasize material properties (metallic shine, magical glow, rough leather).
        Structure: Handle/Grip at the bottom/center, functional part at the top.
        ${baseStyle}
        `.trim();
    }
    
    // 3. CREATURES / MONSTERS
    if (type === 'Monster' || type === 'Race') {
        return `
        Task: Create a character sprite of a "${rawPrompt}".
        Context: RPG Battle Sprite.
        Details: Dynamic idle stance. 2.5D perspective (facing slightly forward/side). Strong silhouette. expressive face/mask.
        Anatomy: Distinct head, torso, and limbs as defined by the blueprint.
        ${baseStyle}
        `.trim();
    }

    // Default
    return `Create a pixel art asset: "${rawPrompt}". ${baseStyle}`;
  }

  async generatePixelData(config: GenerationConfig): Promise<{ 
      pixelData: string[][], 
      enhancedPrompt: string,
      metrics: { executionTime: number, inputTokens: number, outputTokens: number, cost: number } 
  }> {
    const startTime = performance.now();
    
    const isTerrain = TERRAIN_ARCHETYPES.includes(config.archetype) || config.type === 'Terrain' || config.type === 'Environment';
    const isItem = ITEM_ARCHETYPES.includes(config.archetype) || config.type === 'Item';
    
    const enhancedPrompt = this.enhancePrompt(config.prompt, config.type, config.archetype);

    let specificInstruction = "";
    if (isTerrain) {
        specificInstruction = `
        MODE: TERRAIN / TEXTURE GENERATION
        - The ASCII Grid below represents the surface area.
        - '#' = Surface (Ground, Wall, Floor, Grass, Water)
        
        CRITICAL: 
        1. Fill the area marked with '#' completely with a texture matching the description.
        2. Create a top-down or consistent surface tile.
        3. NO TRANSPARENCY inside the '#' zones.
        `;
    } else if (isItem) {
        specificInstruction = `
        MODE: ITEM / OBJECT GENERATION
        - The ASCII Grid below represents the object's shape.
        - '#' = Handle/Shaft (Wood/Metal)
        - 'X' = Blade/Head (Metal/Energy)
        - '+' = Guard/Decoration (Gold/Gem)
        - 'O' = Top/Head
        - 'L' = Bottom/Base
        
        CRITICAL: FILL EVERY '#' 'X' '+' 'O' 'L' symbol in the grid with a non-transparent color.
        DO NOT leave the object transparent.
        `;
    } else {
        specificInstruction = `
        MODE: CREATURE GENERATION
        - The ASCII Grid below represents the creature's anatomy.
        - 'O' = Head
        - '#' = Torso
        - 'r'/'l' = Hands
        - 'L' = Legs
        
        CRITICAL: FILL the anatomy with colors matching the description.
        `;
    }

    const asciiBlueprint = this.gridToAscii(config.blueprint);

    const systemInstruction = `
      You are a Pixel Art Engine. 
      Your goal is to fill a 32x32 grid with hex colors based on an ASCII structural map.
      
      RULES:
      1. OUTPUT: JSON array of 32 arrays (rows). Each row contains 32 hex strings.
      2. BACKGROUND: Use "transparent" for '.' (dots) in the ASCII map.
      3. FOREGROUND: You MUST provide a hex color (e.g., "#FF0000") for every non-dot character in the map.
      4. STYLE: High contrast, vivid fantasy RPG style. 32x32 resolution.
      
      ${specificInstruction}
    `;

    const fullPrompt = `
      ${enhancedPrompt}
      
      ASCII BLUEPRINT MAP (32x32):
      ${asciiBlueprint}
      
      COMMAND: Translate this ASCII map into colored pixels. 
      If the map has a symbol like '#', 'X', or 'O', THAT PIXEL MUST BE COLORED.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: config.model, // Use selected model
        contents: fullPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        },
      });

      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      // Parse safely using the robust cleaning logic
      const safeJson = this.cleanJson(response.text || "");
      let rawData;
      
      try {
          rawData = JSON.parse(safeJson);
      } catch (parseError) {
          console.warn("JSON Parse failed, attempting fallback recovery...", safeJson);
          throw new Error("Failed to parse pixel grid from model response.");
      }
      
      // Fix: Use validateAndRepairGrid instead of hard throwing on length
      const validatedData = this.validateAndRepairGrid(rawData);
      
      // Run the safety net
      const cleanData = this.postProcessPixelData(validatedData, config.blueprint);

      // --- CALCULATE METRICS ---
      // Estimate Tokens: 4 chars ~= 1 token
      const inputChars = fullPrompt.length + systemInstruction.length;
      const outputChars = safeJson.length;
      
      const inputTokens = Math.ceil(inputChars / 4);
      const outputTokens = Math.ceil(outputChars / 4);
      
      // Calculate Cost
      // @ts-ignore
      const price = PRICING[config.model] || PRICING['gemini-flash-latest'];
      const cost = ((inputTokens / 1_000_000) * price.input) + ((outputTokens / 1_000_000) * price.output);

      return { 
          pixelData: cleanData, 
          enhancedPrompt,
          metrics: {
              executionTime,
              inputTokens,
              outputTokens,
              cost
          }
      };

    } catch (error: any) {
      console.error("Gemini Forge Error:", error);
      if (error.status === 404 || (error.message && error.message.includes('404'))) {
          throw new Error(`Model ${config.model} not found or not available in this region.`);
      }
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
