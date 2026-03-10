
import React, { useState, useEffect, useRef } from 'react';
import { Asset, AssetType, Archetype, ZoneType, GenerationConfig, CreatureSize } from './types';
import { geminiService } from './services/geminiService';
import { AssetCard, PixelGrid, AssetMetadataView } from './components/AssetCard';
import { BlueprintEditor } from './components/BlueprintEditor';
import { getTemplate } from './utils/templates';
import { compositeLoadout } from './utils/compositor';

const ARCHETYPES: Archetype[] = [
    'Humanoid', 'Quadruped', 'Winged', 'Ethereal', 
    'Sword', 'Polearm', 'Shield', 'Headwear', 'Body Armor', 'Legwear', 'Handwear', 'Footwear', 'Accessory',
    'Solid Block', 'Landscape/Floor'
];
const ASSET_TYPES: AssetType[] = ['Monster', 'Item', 'Race', 'Environment', 'Terrain'];
const SIZES: CreatureSize[] = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];

const MODELS = [
    { id: 'gemini-3.1-flash-lite-preview', label: 'Flash 3.1 Lite', sub: 'Fastest', tier: 'Lite' },
    { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1', sub: 'Max Quality', tier: 'Max' },
];

// Equipment Slot Configuration
const EQUIP_SLOTS = [
    { key: 'main', label: 'Main Hand', types: ['Sword', 'Polearm'] },
    { key: 'off', label: 'Off Hand', types: ['Shield'] },
    { key: 'head', label: 'Head', types: ['Headwear'] },
    { key: 'body', label: 'Body', types: ['Body Armor'] },
    { key: 'legs', label: 'Legs', types: ['Legwear'] },
    { key: 'feet', label: 'Feet', types: ['Footwear'] },
    { key: 'hands', label: 'Hands', types: ['Handwear'] }
];

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('pixelforge_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('pixelforge_api_key', apiKey);
    geminiService.updateApiKey(apiKey);
  }, [apiKey]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [prompt, setPrompt] = useState('');
  
  const [selectedType, setSelectedType] = useState<AssetType>('Monster');
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype>('Humanoid');
  const [selectedSize, setSelectedSize] = useState<CreatureSize>('Medium');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-flash-preview');
  
  const [blueprint, setBlueprint] = useState<ZoneType[][]>(getTemplate('Humanoid', 'Medium'));
  const [error, setError] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [previewTab, setPreviewTab] = useState<'visual' | 'meta'>('visual');
  
  // Multi-slot Loadout State
  const [loadout, setLoadout] = useState<Record<string, Asset | null>>({
      main: null, off: null, head: null, body: null, legs: null, feet: null, hands: null
  });
  
  const [previewGrid, setPreviewGrid] = useState<string[][] | null>(null);
  const [equipStatus, setEquipStatus] = useState<string>('');

  // Queue Management
  const processingRef = useRef<Set<string>>(new Set());

  // Update blueprint when type, archetype or size changes
  useEffect(() => {
    if (selectedType === 'Item' && ['Humanoid', 'Quadruped', 'Winged', 'Ethereal'].includes(selectedArchetype)) {
       setSelectedArchetype('Sword');
       setBlueprint(getTemplate('Sword', selectedSize));
    } 
    else if (selectedType === 'Monster' && !['Humanoid', 'Quadruped', 'Winged', 'Ethereal'].includes(selectedArchetype)) {
        setSelectedArchetype('Humanoid');
        setBlueprint(getTemplate('Humanoid', selectedSize));
    }
    else {
       setBlueprint(getTemplate(selectedArchetype, selectedSize));
    }
  }, [selectedType, selectedArchetype, selectedSize]);

  // Handle Equipment Composition
  useEffect(() => {
    if (activeAsset) {
        const equippedAssets = Object.values(loadout).filter(item => item !== null) as Asset[];
        if (equippedAssets.length > 0) {
            const { grid, status } = compositeLoadout(activeAsset, equippedAssets);
            setPreviewGrid(grid);
            setEquipStatus(status);
        } else {
            setPreviewGrid(activeAsset.pixelData);
            setEquipStatus('');
        }
    }
  }, [activeAsset, loadout]);

  // Reset loadout when opening new asset
  useEffect(() => {
    setLoadout({ main: null, off: null, head: null, body: null, legs: null, feet: null, hands: null });
    setPreviewGrid(null);
    setEquipStatus('');
    setPreviewTab('visual');
  }, [activeAsset?.id]);

  // --- QUEUE PROCESSOR ---
  useEffect(() => {
    const processQueue = async () => {
        const processingCount = assets.filter(a => a.status === 'processing').length;
        const queuedAssets = assets.filter(a => a.status === 'queued');

        if (processingCount < 24 && queuedAssets.length > 0) {
            const nextAsset = queuedAssets[0];
            
            if (processingRef.current.has(nextAsset.id)) return;
            processingRef.current.add(nextAsset.id);

            setAssets(prev => prev.map(a => a.id === nextAsset.id ? { ...a, status: 'processing' } : a));

            try {
                const config: GenerationConfig = {
                    prompt: nextAsset.originalPrompt,
                    type: nextAsset.type,
                    archetype: nextAsset.archetype,
                    size: nextAsset.size,
                    blueprint: nextAsset.blueprint,
                    model: nextAsset.model,
                };

                const result = await geminiService.generatePixelData(config);

                setAssets(prev => prev.map(a => a.id === nextAsset.id ? { 
                    ...a, 
                    status: 'ready', 
                    pixelData: result.pixelData,
                    prompt: result.enhancedPrompt,
                    executionTime: result.metrics.executionTime,
                    usage: {
                        inputTokens: result.metrics.inputTokens,
                        outputTokens: result.metrics.outputTokens,
                        cost: result.metrics.cost
                    }
                } : a));
                
                if (activeAsset?.id === nextAsset.id) {
                    setActiveAsset(prev => prev ? { 
                        ...prev, 
                        status: 'ready', 
                        pixelData: result.pixelData,
                        prompt: result.enhancedPrompt,
                        executionTime: result.metrics.executionTime,
                        usage: {
                            inputTokens: result.metrics.inputTokens,
                            outputTokens: result.metrics.outputTokens,
                            cost: result.metrics.cost
                        }
                    } : null);
                }

            } catch (err) {
                console.error(`Failed to generate ${nextAsset.id}`, err);
                setAssets(prev => prev.map(a => a.id === nextAsset.id ? { ...a, status: 'error' } : a));
            } finally {
                processingRef.current.delete(nextAsset.id);
            }
        }
    };

    processQueue();
  }, [assets]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      setError("Please describe your asset.");
      return;
    }
    setError(null);

    const newAsset: Asset = {
        id: Math.random().toString(36).substr(2, 5).toUpperCase(),
        name: prompt.split(' ').slice(0, 2).join(' ') || 'Artifact',
        type: selectedType,
        archetype: selectedArchetype,
        size: selectedSize,
        pixelData: Array(32).fill(Array(32).fill('transparent')),
        blueprint: JSON.parse(JSON.stringify(blueprint)), 
        prompt: '',
        originalPrompt: prompt,
        model: selectedModel,
        timestamp: Date.now(),
        executionTime: 0,
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
        status: 'queued'
    };

    setAssets(prev => [newAsset, ...prev]);
  };

  const exportAsSVG = (asset: Asset, gridOverride?: string[][]) => {
    if (asset.status !== 'ready') return;

    const dataToUse = gridOverride || asset.pixelData;
    let rects = '';
    
    dataToUse.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color && color !== 'transparent' && color !== 'none' && !color.includes('undefined')) {
          rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" />`;
        }
      });
    });

    const svgContent = `
      <svg width="1024" height="1024" viewBox="0 0 32 32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        ${rects}
      </svg>
    `.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${asset.name.replace(/\s+/g, '_')}_${asset.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateSlot = (slotKey: string, assetId: string) => {
      const asset = assets.find(a => a.id === assetId) || null;
      setLoadout(prev => ({ ...prev, [slotKey]: asset }));
  };
  
  const processingCount = assets.filter(a => a.status === 'processing').length;
  const queuedCount = assets.filter(a => a.status === 'queued').length;

  return (
    <div className="h-screen w-screen bg-black text-zinc-300 font-sans flex flex-col overflow-hidden">
      
      {/* --- HEADER --- */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PixelForge Logo" className="h-8 w-auto object-contain" />
          <h1 className="text-sm font-bold tracking-widest text-zinc-100 uppercase">Pixel<span className="text-amber-500">Forge</span> AI</h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => setShowSettings(true)} className="p-1.5 text-zinc-400 hover:text-amber-500 transition-colors" title="Settings">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <span className="text-xs text-zinc-500 font-mono hidden sm:block">v3.1.0_WORKBENCH</span>
            <div className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider flex items-center gap-2 ${processingCount > 0 ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                {processingCount > 0 && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />}
                {processingCount > 0 ? `Forging ${processingCount}` : 'System Ready'}
                {queuedCount > 0 && <span className="opacity-50 border-l border-amber-500/30 pl-2">+{queuedCount} Queue</span>}
            </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* --- COLUMN 1: MANIFESTATION (SETTINGS & PROMPT) --- */}
        <div className="flex-1 border-r border-zinc-800 bg-zinc-950/50 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
             <div className="p-6 space-y-8 animate-in slide-in-from-left-4 duration-300">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">01. Prompt</span>
                        <div className="h-px bg-zinc-800 flex-1" />
                    </div>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the aesthetic (e.g., 'Obsidian greatsword glowing with violet void energy')"
                        className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-zinc-600 resize-none leading-relaxed"
                    />
                        <button
                        onClick={handleGenerate}
                        className={`
                            w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
                            bg-amber-600 text-black hover:bg-amber-500 shadow-lg shadow-amber-900/20 active:scale-[0.98]
                        `}
                    >
                        Forge Asset
                    </button>
                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">02. Parameters</span>
                        <div className="h-px bg-zinc-800 flex-1" />
                    </div>

                        {/* Model Selector */}
                    <div className="space-y-2">
                            <label className="text-[10px] text-zinc-400 font-medium uppercase">Model Intelligence</label>
                            <div className="grid grid-cols-1 gap-2">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setSelectedModel(m.id)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${selectedModel === m.id ? 'bg-zinc-800 border-amber-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`text-[11px] font-bold ${selectedModel === m.id ? 'text-amber-500' : 'text-zinc-300'}`}>{m.label}</span>
                                        <span className="text-[9px] text-zinc-500">{m.sub}</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-600 border border-zinc-800 px-1 rounded">{m.tier}</span>
                                </button>
                            ))}
                            </div>
                    </div>

                    {/* Type & Size Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 font-medium uppercase">Type</label>
                            <select 
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as AssetType)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 font-medium uppercase">Size</label>
                            <select 
                                value={selectedSize}
                                onChange={(e) => setSelectedSize(e.target.value as CreatureSize)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Archetype Grid */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 font-medium uppercase">Archetype</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-900/30 rounded-lg border border-zinc-900">
                            {ARCHETYPES.map(arch => (
                                <button
                                    key={arch}
                                    onClick={() => setSelectedArchetype(arch)}
                                    className={`
                                        text-[10px] py-1 px-2.5 rounded-md border transition-all
                                        ${selectedArchetype === arch 
                                            ? 'bg-amber-500 text-black border-amber-600 font-bold shadow-lg shadow-amber-900/20' 
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                                        }
                                    `}
                                >
                                    {arch}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- COLUMN 2: BLUEPRINT EDITOR --- */}
        <div className="flex-1 border-r border-zinc-800 bg-zinc-950 flex flex-col min-w-0 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">03. Blueprint</span>
                    <div className="h-px bg-zinc-800 flex-1" />
                </div>
            </div>
            <div className="flex-1 p-4 bg-zinc-900/10 overflow-y-auto custom-scrollbar">
                <BlueprintEditor 
                    blueprint={blueprint} 
                    onChange={setBlueprint} 
                    archetype={selectedArchetype}
                    size={selectedSize}
                    onReset={() => setBlueprint(getTemplate(selectedArchetype, selectedSize))}
                />
            </div>
        </div>

        {/* --- COLUMN 3: GALLERY --- */}
        <main className="flex-1 bg-black relative flex flex-col min-w-0">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-black/50 backdrop-blur-md sticky top-0 z-10">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Library</h2>
                <div className="flex gap-4">
                    <span className="text-[10px] text-zinc-600">{assets.length} Items</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start custom-scrollbar">
                {assets.length === 0 ? (
                    <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-20">
                        <div className="w-16 h-16 border-2 border-dashed border-zinc-500 rounded-full animate-spin-slow mb-4" />
                        <p className="text-xs tracking-widest uppercase">Waiting for Input</p>
                    </div>
                ) : (
                    assets.map(asset => (
                        <AssetCard 
                            key={asset.id} 
                            asset={asset} 
                            onSelect={(a) => { setActiveAsset(a); setPreviewTab('visual'); }}
                            isActive={activeAsset?.id === asset.id}
                        />
                    ))
                )}
            </div>
        </main>
      </div>

      {/* --- PREVIEW MODAL --- */}
      {activeAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setActiveAsset(null)} />
            
            <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl flex flex-col lg:flex-row h-[700px] animate-in zoom-in-95 duration-300">
                
                {/* Visual Preview Column */}
                <div className="flex-1 bg-zinc-900/30 flex flex-col relative border-r border-zinc-800">
                    <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    
                    {/* View Toggle Tabs */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-zinc-950 border border-zinc-800 p-1 rounded-full shadow-xl">
                        <button 
                            onClick={() => setPreviewTab('visual')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${previewTab === 'visual' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Visual
                        </button>
                        <button 
                            onClick={() => setPreviewTab('meta')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${previewTab === 'meta' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Metadata
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="w-full max-w-[450px] aspect-square relative shadow-2xl">
                             {previewTab === 'visual' ? (
                                activeAsset.status === 'ready' ? (
                                    <PixelGrid 
                                        data={previewGrid || activeAsset.pixelData} 
                                        blueprint={activeAsset.blueprint}
                                        showZones={showAnatomy}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center border border-zinc-800 bg-zinc-950/50 rounded-lg">
                                        <div className="w-8 h-8 border-2 border-amber-500/50 border-t-amber-500 rounded-full animate-spin mb-4" />
                                        <div className="text-amber-500 text-xs font-bold uppercase tracking-widest animate-pulse">Forging...</div>
                                    </div>
                                )
                             ) : (
                                <AssetMetadataView asset={activeAsset} />
                             )}
                        </div>
                    </div>
                    
                    {/* Anatomy Toggle (Only visible in visual mode) */}
                    {activeAsset.status === 'ready' && previewTab === 'visual' && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
                            <button 
                                onClick={() => setShowAnatomy(!showAnatomy)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border
                                    ${showAnatomy 
                                        ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-900/30' 
                                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                                    }
                                `}
                            >
                                <span className={`w-2 h-2 rounded-full ${showAnatomy ? 'bg-white' : 'bg-zinc-500'}`} />
                                {showAnatomy ? 'Hide Anatomy' : 'Show Anatomy'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Sidebar Controls */}
                <div className="w-full lg:w-80 bg-zinc-950 p-8 flex flex-col">
                    <div className="mb-6 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-amber-500 font-mono">#{activeAsset.id}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{activeAsset.size}</span>
                        </div>
                        <h2 className="text-xl font-bold text-zinc-100 mb-1 leading-none truncate" title={activeAsset.name}>{activeAsset.name}</h2>
                        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{activeAsset.type} // {activeAsset.archetype}</span>
                    </div>
                    
                    {/* EQUIPMENT LOADOUT SECTION */}
                    {(activeAsset.type === 'Monster' || activeAsset.type === 'Race') && activeAsset.status === 'ready' && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 pr-2">
                             <div className="bg-zinc-900/20 rounded-xl p-4 border border-zinc-900">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Equipment Loadout</span>
                                    {equipStatus && <span className="text-[9px] text-emerald-600">Active</span>}
                                </div>
                                <div className="space-y-3">
                                    {EQUIP_SLOTS.map(slot => (
                                        <div key={slot.key} className="flex flex-col gap-1">
                                            <label className="text-[9px] uppercase text-zinc-500 font-bold">{slot.label}</label>
                                            <select 
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-amber-500"
                                                onChange={(e) => updateSlot(slot.key, e.target.value)}
                                                value={loadout[slot.key]?.id || ''}
                                            >
                                                <option value="">(Empty)</option>
                                                {assets.filter(a => slot.types.includes(a.archetype) && a.status === 'ready').map(item => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Actions */}
                    <div className="mt-auto space-y-3 shrink-0">
                        <button 
                            onClick={() => exportAsSVG(activeAsset, previewGrid || undefined)}
                            disabled={activeAsset.status !== 'ready'}
                            className={`
                                w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2
                                ${activeAsset.status === 'ready' ? 'bg-zinc-100 hover:bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}
                            `}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download SVG
                        </button>
                        <button 
                            onClick={() => setActiveAsset(null)}
                            className="w-full py-3 bg-transparent border border-zinc-800 text-zinc-400 hover:bg-zinc-900 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                            Close Preview
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
            <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden w-full max-w-md p-6 animate-in zoom-in-95 duration-300">
                <h2 className="text-lg font-bold text-zinc-100 mb-4 uppercase tracking-widest">Settings</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Gemini API Key</label>
                        <input 
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                        />
                        <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                            Your API key is stored safely in your browser's LocalStorage. If left empty, PixelForge will fall back to the environment variable.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs uppercase tracking-widest rounded-lg transition-colors"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
