'use client';

import React from 'react';
import { useBookStore } from '@/lib/store/useBookStore';

export const MetricsBar: React.FC = () => {
  const { metrics, connected } = useBookStore();

  const spread = metrics?.spread !== null && metrics?.spread !== undefined ? metrics.spread.toFixed(2) : '—';
  const midPrice = metrics?.midPrice !== null && metrics?.midPrice !== undefined ? metrics.midPrice.toFixed(2) : '—';
  const microprice = metrics?.microprice !== null && metrics?.microprice !== undefined ? metrics.microprice.toFixed(2) : '—';
  const refPrice = metrics?.referencePrice !== undefined ? metrics.referencePrice.toFixed(2) : '—';
  const obi = metrics?.obi !== null && metrics?.obi !== undefined ? metrics.obi : null;
  const ofi = metrics?.ofi !== undefined ? metrics.ofi : 0;

  // Format OBI as percentage or decimal
  const obiDisplay = obi !== null ? (obi >= 0 ? `+${(obi * 100).toFixed(1)}%` : `${(obi * 100).toFixed(1)}%`) : '—';
  const ofiDisplay = ofi >= 0 ? `+${ofi}` : `${ofi}`;

  // Microprice skew relative to mid
  const microSkew =
    metrics?.microprice && metrics?.midPrice
      ? metrics.microprice - metrics.midPrice
      : null;

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl p-4 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/60 mb-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-slate-300">
              {connected ? 'LIVE FEED (SIMULATOR)' : 'CONNECTING...'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            Instrument: <span className="text-slate-200 font-medium">SIM-USD</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            Tick Size: <span className="text-slate-200 font-mono">0.01</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Latent Ref Mid:</span>
          <span className="font-mono font-medium text-slate-200 text-sm bg-slate-800/60 px-2 py-0.5 rounded">
            ${refPrice}
          </span>
        </div>
      </div>

      {/* Grid of Microstructure Readouts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Spread */}
        <div className="bg-[#11192e] border border-slate-800/60 rounded-lg p-3">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Spread
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-semibold text-slate-100">
              {spread}
            </span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
        </div>

        {/* Mid Price */}
        <div className="bg-[#11192e] border border-slate-800/60 rounded-lg p-3">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Mid Price
          </div>
          <div className="font-mono text-xl font-semibold text-slate-100">
            ${midPrice}
          </div>
        </div>

        {/* Microprice */}
        <div className="bg-[#11192e] border border-slate-800/60 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            <span>Microprice</span>
            {microSkew !== null && (
              <span
                className={`text-[11px] font-mono ${
                  microSkew > 0
                    ? 'text-emerald-400'
                    : microSkew < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {microSkew > 0 ? `+${microSkew.toFixed(2)}` : microSkew.toFixed(2)}
              </span>
            )}
          </div>
          <div className="font-mono text-xl font-semibold text-amber-300">
            ${microprice}
          </div>
        </div>

        {/* Order Book Imbalance (OBI) */}
        <div className="bg-[#11192e] border border-slate-800/60 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            <span>OBI (Top 5)</span>
            <span className="text-[10px] text-slate-500">[-1, +1]</span>
          </div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span
              className={`font-mono text-xl font-semibold ${
                obi !== null && obi > 0
                  ? 'text-emerald-400'
                  : obi !== null && obi < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {obiDisplay}
            </span>
          </div>
          {/* Visual Balance Bar */}
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-rose-500/80 h-full transition-all duration-150"
              style={{
                width: `${obi !== null ? Math.max(0, -obi) * 50 : 0}%`,
                marginLeft: `${obi !== null && obi < 0 ? (1 + obi) * 50 : 50}%`,
              }}
            />
            <div
              className="bg-emerald-500/80 h-full transition-all duration-150"
              style={{
                width: `${obi !== null ? Math.max(0, obi) * 50 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Order Flow Imbalance (OFI) */}
        <div className="bg-[#11192e] border border-slate-800/60 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            <span>OFI (Cont et al.)</span>
            <span className="text-[10px] text-slate-500">K=50</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-mono text-xl font-semibold ${
                ofi > 0
                  ? 'text-emerald-400'
                  : ofi < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {ofiDisplay}
            </span>
            <span className="text-xs text-slate-400">contracts</span>
          </div>
        </div>
      </div>
    </div>
  );
};
