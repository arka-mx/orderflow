'use client';

import React, { useEffect, useState } from 'react';
import { useBookStore } from '@/lib/store/useBookStore';
import { MetricsBar } from '@/components/MetricsBar';
import { OrderBookLadder } from '@/components/OrderBookLadder';
import { OrderEntryPanel } from '@/components/OrderEntryPanel';
import { TradeTape } from '@/components/TradeTape';

export default function DashboardPage() {
  const { connect, disconnect, userOrders, connected } = useBookStore();
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <main className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header bar */}
      <header className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-950/50">
            OF
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              OrderFlow
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-normal">
                Microstructure Simulator V1
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Price-Time Priority Limit Order Book · Synthetic Poisson Flow · Cont-Kukanov-Stoikov OFI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span>Engine: {connected ? 'Streaming Real-Time' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Top: Microstructure Metrics Bar */}
      <section aria-label="Microstructure Metrics">
        <MetricsBar />
      </section>

      {/* Main Grid: Depth Ladder + Order Entry + Trade Tape */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left: Depth Ladder (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col min-h-[520px]">
          <OrderBookLadder onSelectPrice={(p) => setSelectedPrice(p)} />
        </div>

        {/* Right: Order Entry & Tape (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <OrderEntryPanel selectedPrice={selectedPrice} />
          <TradeTape />
        </div>
      </div>

      {/* User Activity & Audit Trail */}
      <section className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <div className="px-4 py-3 bg-[#11192e] border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            User Order Audit Log (Active Session)
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {userOrders.length} submitted
          </span>
        </div>

        <div className="overflow-x-auto">
          {userOrders.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No orders submitted in this session yet. Submit an order above to observe FIFO matching and book impact.
            </div>
          ) : (
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0b101c] text-slate-400 border-b border-slate-800/60 font-sans">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Order ID</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Limit Price</th>
                  <th className="px-4 py-2 font-medium text-right">Order Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Filled Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Avg Price</th>
                  <th className="px-4 py-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {userOrders.map((ord) => {
                  const timeStr = new Date(ord.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const isBuy = ord.side === 'buy';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-slate-400">{timeStr}</td>
                      <td className="px-4 py-2 text-slate-400">{ord.id}</td>
                      <td className={`px-4 py-2 font-medium ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ord.side.toUpperCase()}
                      </td>
                      <td className="px-4 py-2">{ord.type}</td>
                      <td className="px-4 py-2 text-right">
                        {ord.price !== undefined ? `$${ord.price.toFixed(2)}` : 'MKT'}
                      </td>
                      <td className="px-4 py-2 text-right">{ord.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{ord.filledQuantity.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        {ord.averagePrice ? `$${ord.averagePrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                            ord.status === 'FILLED'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : ord.status === 'PARTIALLY_FILLED'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                              : ord.status === 'REJECTED' || ord.status === 'CANCELLED'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
