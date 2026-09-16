'use client';

import React from 'react';
import { useBookStore } from '@/lib/store/useBookStore';

interface OrderBookLadderProps {
  onSelectPrice?: (price: number) => void;
}

export const OrderBookLadder: React.FC<OrderBookLadderProps> = ({ onSelectPrice }) => {
  const { bids, asks, metrics } = useBookStore();

  // Top 10 asks and bids for display
  const displayAsks = asks.slice(0, 10);
  const displayBids = bids.slice(0, 10);

  // For visual depth bars: compute maximum quantity across top book
  const allQtys = [...displayAsks.map((a) => a.quantity), ...displayBids.map((b) => b.quantity)];
  const maxQty = Math.max(...allQtys, 100);

  // Cumulative depth sums
  let askCum = 0;
  const asksWithCum = displayAsks.map((a) => {
    askCum += a.quantity;
    return { ...a, cumulative: askCum };
  });

  let bidCum = 0;
  const bidsWithCum = displayBids.map((b) => {
    bidCum += b.quantity;
    return { ...b, cumulative: bidCum };
  });

  // Display asks in descending order so Best Ask (lowest ask) sits right above spread
  const reversedAsks = [...asksWithCum].reverse();

  const bestBidPrice = displayBids[0]?.price;
  const bestAskPrice = displayAsks[0]?.price;

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/20 flex flex-col h-full">
      {/* Ladder Header */}
      <div className="px-4 py-3 bg-[#11192e] border-b border-slate-800/80 flex items-center justify-between">
        <h2 className="text-base font-medium text-slate-200">
          L2 Depth Ladder
        </h2>
        <span className="text-xs text-slate-400">
          Click row to load price
        </span>
      </div>

      {/* Table Column Labels */}
      <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-slate-400 border-b border-slate-800/40 bg-[#0b101c]">
        <div className="text-left">Price (USD)</div>
        <div className="text-right">Size</div>
        <div className="text-right">Cumulative</div>
        <div className="text-right">Orders</div>
      </div>

      {/* Scrollable Depth Rows */}
      <div className="flex-1 overflow-y-auto font-mono text-sm select-none">
        {/* ASKS (Reversed: highest price at top, Best Ask at bottom) */}
        <div className="flex flex-col justify-end">
          {reversedAsks.map((ask) => {
            const isBestAsk = ask.price === bestAskPrice;
            const barWidth = Math.min(100, Math.round((ask.quantity / maxQty) * 100));

            return (
              <div
                key={`ask-${ask.price}`}
                onClick={() => onSelectPrice?.(ask.price)}
                className={`relative grid grid-cols-4 px-4 py-1.5 cursor-pointer transition-colors duration-100 group hover:bg-slate-800/40 ${
                  isBestAsk ? 'bg-rose-950/20 font-medium' : ''
                }`}
              >
                {/* Horizontal Depth Volume Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none transition-all duration-150"
                  style={{ width: `${barWidth}%` }}
                />

                <div className="relative text-left text-rose-400 font-medium flex items-center gap-1.5">
                  {ask.price.toFixed(2)}
                  {isBestAsk && (
                    <span className="text-[10px] text-rose-300/80 bg-rose-900/40 px-1 py-0.2 rounded">
                      ASK₁
                    </span>
                  )}
                </div>
                <div className="relative text-right text-slate-300">
                  {ask.quantity.toLocaleString()}
                </div>
                <div className="relative text-right text-slate-500 text-xs flex items-center justify-end">
                  {ask.cumulative.toLocaleString()}
                </div>
                <div className="relative text-right text-slate-500 text-xs flex items-center justify-end">
                  {ask.orderCount}
                </div>
              </div>
            );
          })}
        </div>

        {/* SPREAD DIVIDER */}
        <div className="grid grid-cols-4 px-4 py-2.5 my-0.5 bg-[#121b30] border-y border-slate-700/60 items-center text-xs font-sans">
          <div className="text-left font-medium text-slate-300 flex items-center gap-2">
            <span>Spread:</span>
            <span className="font-mono text-slate-100 font-semibold">
              {metrics?.spread !== null && metrics?.spread !== undefined
                ? metrics.spread.toFixed(2)
                : '—'}
            </span>
          </div>
          <div className="text-center col-span-2 text-slate-400 flex items-center justify-center gap-2">
            <span>Mid:</span>
            <span className="font-mono text-slate-200 font-medium">
              ${metrics?.midPrice !== null && metrics?.midPrice !== undefined
                ? metrics.midPrice.toFixed(2)
                : '—'}
            </span>
            <span className="text-slate-600">|</span>
            <span>Micro:</span>
            <span className="font-mono text-amber-300 font-medium">
              ${metrics?.microprice !== null && metrics?.microprice !== undefined
                ? metrics.microprice.toFixed(2)
                : '—'}
            </span>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            {metrics?.obi !== null && metrics?.obi !== undefined && (
              <span
                className={
                  metrics.obi > 0
                    ? 'text-emerald-400'
                    : metrics.obi < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }
              >
                OBI {metrics.obi > 0 ? `+${(metrics.obi * 100).toFixed(0)}%` : `${(metrics.obi * 100).toFixed(0)}%`}
              </span>
            )}
          </div>
        </div>

        {/* BIDS (Best Bid at top, lowest at bottom) */}
        <div>
          {bidsWithCum.map((bid) => {
            const isBestBid = bid.price === bestBidPrice;
            const barWidth = Math.min(100, Math.round((bid.quantity / maxQty) * 100));

            return (
              <div
                key={`bid-${bid.price}`}
                onClick={() => onSelectPrice?.(bid.price)}
                className={`relative grid grid-cols-4 px-4 py-1.5 cursor-pointer transition-colors duration-100 group hover:bg-slate-800/40 ${
                  isBestBid ? 'bg-emerald-950/20 font-medium' : ''
                }`}
              >
                {/* Horizontal Depth Volume Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none transition-all duration-150"
                  style={{ width: `${barWidth}%` }}
                />

                <div className="relative text-left text-emerald-400 font-medium flex items-center gap-1.5">
                  {bid.price.toFixed(2)}
                  {isBestBid && (
                    <span className="text-[10px] text-emerald-300/80 bg-emerald-900/40 px-1 py-0.2 rounded">
                      BID₁
                    </span>
                  )}
                </div>
                <div className="relative text-right text-slate-300">
                  {bid.quantity.toLocaleString()}
                </div>
                <div className="relative text-right text-slate-500 text-xs flex items-center justify-end">
                  {bid.cumulative.toLocaleString()}
                </div>
                <div className="relative text-right text-slate-500 text-xs flex items-center justify-end">
                  {bid.orderCount}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
