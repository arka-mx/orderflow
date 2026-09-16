'use client';

import React from 'react';
import { useBookStore } from '@/lib/store/useBookStore';

export const TradeTape: React.FC = () => {
  const { recentTrades } = useBookStore();

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/20 flex flex-col h-full">
      <div className="px-4 py-3 bg-[#11192e] border-b border-slate-800/80 flex items-center justify-between">
        <h2 className="text-base font-medium text-slate-200">
          Time & Sales (Trade Tape)
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          Last {recentTrades.length} Fills
        </span>
      </div>

      <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-slate-400 border-b border-slate-800/40 bg-[#0b101c]">
        <div className="text-left">Time</div>
        <div className="text-left">Side</div>
        <div className="text-right">Price</div>
        <div className="text-right">Quantity</div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[280px] font-mono text-xs">
        {recentTrades.length === 0 ? (
          <div className="p-6 text-center text-slate-500 font-sans text-xs">
            Waiting for matching engine trades...
          </div>
        ) : (
          recentTrades.map((trade) => {
            const timeStr = new Date(trade.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const isBuy = trade.takerSide === 'buy';

            return (
              <div
                key={trade.id}
                className="grid grid-cols-4 px-4 py-1.5 border-b border-slate-800/20 hover:bg-slate-800/30 transition-colors"
              >
                <div className="text-left text-slate-400">{timeStr}</div>
                <div className={`text-left font-medium ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {trade.takerSide.toUpperCase()}
                </div>
                <div className="text-right text-slate-200 font-medium">
                  {trade.price.toFixed(2)}
                </div>
                <div className="text-right text-slate-300">
                  {trade.quantity.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
