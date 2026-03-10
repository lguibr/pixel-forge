
import React, { useState } from 'react';
import { Asset, ZoneType } from '../types';

interface AssetCardProps {
  asset: Asset;
  onSelect: (asset: Asset) => void;
  isActive?: boolean;
}

interface PixelGridProps {
  data: string[][];
  blueprint?: ZoneType[][];
  showZones?: boolean;
  size?: string;
}

const ZONE_COLORS: Record<string, string> = {
  'core': 'rgba(245, 158, 11, 0.4)',      // Amber
  'head': 'rgba(244, 63, 94, 0.4)',       // Rose
  'hand_l': 'rgba(6, 182, 212, 0.4)',     // Cyan
  'hand_r': 'rgba(99, 102, 241, 0.4)',    // Indigo
  'weapon': 'rgba(239, 68, 68, 0.4)',     // Red
  'legs': 'rgba(16, 185, 129, 0.4)',      // Emerald
  'back': 'rgba(168, 85, 247, 0.4)',      // Purple
  'accessory': 'rgba(251, 146, 60, 0.4)', // Orange
};

export const PixelGrid: React.FC<PixelGridProps> = ({ data, blueprint, showZones = false, size = "w-full h-full" }) => {
  return (
    <div 
      className={`relative ${size}`}
      style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(32, 1fr)',
        gridTemplateRows: 'repeat(32, 1fr)',
        aspectRatio: '1/1',
        imageRendering: 'pixelated'
      }}
    >
      {data.map((row, y) => 
        row.map((color, x) => {
          const zone = blueprint ? blueprint[y][x] : 'none';
          const isZoneVisible = showZones && zone !== 'none';
          
          return (
            <div 
              key={`${x}-${y}`} 
              className="w-full h-full relative"
              style={{ 
                backgroundColor: color === 'transparent' ? 'transparent' : color,
                boxShadow: color !== 'transparent' && color !== 'none' && !color.endsWith('00') ? `0 0 1px ${color}` : 'none'
              }} 
            >
              {/* Overlay for Anatomy/Zone Metadata */}
              {isZoneVisible && (
                <div 
                  className="absolute inset-0 z-10 border-[0.5px] border-white/20"
                  style={{ backgroundColor: ZONE_COLORS[zone] || 'rgba(255,255,255,0.2)' }}
                  title={zone}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onSelect, isActive }) => {
  const isReady = asset.status === 'ready';
  const isError = asset.status === 'error';
  const isLoading = asset.status === 'processing' || asset.status === 'queued';

  return (
    <div 
      onClick={() => onSelect(asset)}
      className={`
        group relative cursor-pointer transition-all duration-300 rounded-xl overflow-hidden
        border bg-zinc-950
        ${isActive 
          ? 'border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] ring-1 ring-amber-500/20' 
          : isError 
            ? 'border-red-900/50 opacity-80'
            : isLoading 
                ? 'border-amber-500/30' 
                : 'border-zinc-800 hover:border-zinc-700 hover:shadow-lg hover:-translate-y-1'
        }
      `}
    >
      {/* Status Overlay for Loading */}
      {isLoading && (
        <div className="absolute top-2 right-2 z-20 flex gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${asset.status === 'processing' ? 'bg-amber-500 animate-ping' : 'bg-zinc-600 animate-pulse'}`} />
        </div>
      )}

      {/* Image Container */}
      <div 
        className="aspect-square w-full relative bg-zinc-900/50 flex items-center justify-center p-4 overflow-hidden"
        style={{
            backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)',
            backgroundSize: '12px 12px'
        }}
      >
        <div className="w-full h-full drop-shadow-2xl">
            {isReady ? (
                <PixelGrid data={asset.pixelData} size="w-full h-full" />
            ) : isError ? (
                <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-red-500/50">
                    <div className="w-8 h-8 border-2 border-red-900 rounded-full flex items-center justify-center font-mono text-xs">!</div>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center opacity-30">
                     {asset.status === 'processing' ? (
                         <div className="w-8 h-8 border-2 border-t-amber-500 border-zinc-800 rounded-full animate-spin" />
                     ) : (
                         <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">In Queue</div>
                     )}
                </div>
            )}
        </div>
      </div>

      {/* Footer Content */}
      <div className="p-3 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-1">
          <h4 className={`text-[11px] font-semibold truncate pr-2 uppercase tracking-wide font-sans ${isError ? 'text-red-400' : 'text-zinc-100'}`}>
            {asset.name}
          </h4>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
            {asset.size.substring(0,1)}
          </span>
        </div>
        <div className="flex justify-between items-center">
            <span className="text-[9px] text-zinc-500 uppercase font-medium tracking-wider">
                {asset.archetype.split('/')[0]}
            </span>
            <div className="flex flex-col items-end">
                <span className={`text-[9px] font-mono leading-none ${isLoading ? 'text-amber-500/70' : 'text-zinc-600'}`}>
                    {isLoading 
                        ? (asset.status === 'processing' ? 'FORGING' : 'QUEUED') 
                        : `${(asset.executionTime / 1000).toFixed(1)}s`
                    }
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export const AssetMetadataView: React.FC<{ asset: Asset }> = ({ asset }) => {
    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800">
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">Model</span>
                    <span className="text-[10px] text-zinc-200 font-mono truncate block" title={asset.model}>
                        {asset.model.replace('gemini-', '').replace('-preview', '')}
                    </span>
                </div>
                <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800">
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">Time</span>
                    <span className="text-[10px] text-amber-500 font-mono">
                        {asset.executionTime}ms
                    </span>
                </div>
                <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800">
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">Tokens</span>
                    <span className="text-[10px] text-zinc-200 font-mono" title={`In: ${asset.usage?.inputTokens} / Out: ${asset.usage?.outputTokens}`}>
                        {asset.usage ? (asset.usage.inputTokens + asset.usage.outputTokens).toLocaleString() : '-'}
                    </span>
                </div>
                <div className="bg-zinc-900/30 p-2 rounded border border-zinc-800">
                    <span className="text-[9px] uppercase text-zinc-500 font-bold block">Est. Cost</span>
                    <span className="text-[10px] text-emerald-500 font-mono">
                         ${asset.usage?.cost?.toFixed(6) || '0.00'}
                    </span>
                </div>
            </div>

            {/* Prompts Comparison */}
            <div className="flex-1 min-h-0 flex flex-col gap-4">
                 <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Raw User Prompt</span>
                    </div>
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 flex-1 overflow-y-auto custom-scrollbar">
                         <p className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{asset.originalPrompt}</p>
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">AI Enhanced Prompt</span>
                    </div>
                    <div className="bg-zinc-900/50 p-3 rounded-lg border border-amber-900/20 flex-1 overflow-y-auto custom-scrollbar">
                         <p className="text-xs text-amber-100/80 whitespace-pre-wrap font-mono">{asset.prompt}</p>
                    </div>
                 </div>
            </div>
        </div>
    )
}
