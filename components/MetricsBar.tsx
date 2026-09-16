'use client';

import React, { useState, useEffect } from 'react';
import { useBookStore } from '@/lib/store/useBookStore';

const POPULAR_SYMBOLS = [
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'QQQ', name: 'Invesco QQQ' },
];

export const MetricsBar: React.FC = () => {
  const { metrics, connected, stockQuote, activeSymbol, switchSymbol } = useBookStore();
  const [countdown, setCountdown] = useState<number>(10);

  // 10s countdown visual indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset countdown when new quote arrives
  useEffect(() => {
    if (stockQuote?.lastUpdated) {
      setCountdown(10);
    }
  }, [stockQuote?.lastUpdated]);

  const spread = metrics?.spread !== null && metrics?.spread !== undefined ? metrics.spread.toFixed(2) : '—';
  const midPrice = metrics?.midPrice !== null && metrics?.midPrice !== undefined ? metrics.midPrice.toFixed(2) : '—';
  const microprice = metrics?.microprice !== null && metrics?.microprice !== undefined ? metrics.microprice.toFixed(2) : '—';
  const obi = metrics?.obi !== null && metrics?.obi !== undefined ? metrics.obi : null;
  const ofi = metrics?.ofi !== undefined ? metrics.ofi : 0;

  const obiDisplay = obi !== null ? (obi >= 0 ? `+${(obi * 100).toFixed(1)}%` : `${(obi * 100).toFixed(1)}%`) : '—';
  const ofiDisplay = ofi >= 0 ? `+${ofi}` : `${ofi}`;

  const microSkew =
    metrics?.microprice && metrics?.midPrice
      ? metrics.microprice - metrics.midPrice
      : null;

  const quotePrice = stockQuote ? stockQuote.price.toFixed(2) : '—';
  const quoteChange = stockQuote ? (stockQuote.change >= 0 ? `+$${stockQuote.change.toFixed(2)}` : `-$${Math.abs(stockQuote.change).toFixed(2)}`) : '—';
  const quotePercent = stockQuote ? (stockQuote.changePercent >= 0 ? `+${stockQuote.changePercent.toFixed(2)}%` : `${stockQuote.changePercent.toFixed(2)}%`) : '';
  const isPositive = stockQuote ? stockQuote.change >= 0 : true;

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl p-4 shadow-xl shadow-black/20">
      {/* Top Bar: Yahoo Finance Live Stock Source & Ticker Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/60 mb-3 text-sm">
        {/* Left: Active Stock & Live Yahoo Finance Price */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
              <span>{stockQuote?.symbol || activeSymbol}</span>
              <span className="text-xs font-normal text-slate-400">· Yahoo Finance Live</span>
            </span>
          </div>

          <div className="flex items-baseline gap-2 bg-[#141d33] px-3 py-1 rounded-lg border border-slate-700/60">
            <span className="text-xs text-slate-400">Live Mkt:</span>
            <span className="font-mono text-base font-semibold text-slate-100">
              ${quotePrice}
            </span>
            {stockQuote && (
              <span
                className={`font-mono text-xs font-medium ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {quoteChange} ({quotePercent})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Updates every 10s (next in {countdown}s)</span>
          </div>
        </div>

        {/* Right: Quick Stock Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">Switch Stock:</span>
          {POPULAR_SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              type="button"
              onClick={() => switchSymbol(s.symbol)}
              className={`px-2.5 py-1 rounded text-xs font-medium font-mono transition-all duration-100 ${
                activeSymbol === s.symbol
                  ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-950/50'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title={s.name}
            >
              {s.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Microstructure Readouts (Recalculated dynamically around the live stock price) */}
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
