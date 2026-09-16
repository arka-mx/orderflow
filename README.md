# OrderFlow — Limit Order Book & Microstructure Simulator

A high-performance, real-time limit order book (LOB) and market microstructure simulation engine and analytics dashboard built with Next.js 14, TypeScript strict mode, Zustand, and Tailwind CSS.

## Overview

OrderFlow simulates an electronic exchange matching engine operating with strict **price-time priority (FIFO)**. It couples a synthetic Poisson order-arrival environment driven by a latent stochastic reference mid-price with real-time quantitative microstructure analytics:
- **Bid-Ask Spread & Mid-Price**
- **Microprice** (volume-weighted top-of-book fair value)
- **Order Book Imbalance (OBI)** across top $N$ depth levels
- **Order Flow Imbalance (OFI)** using the Cont-Kukanov-Stoikov (2014) event-based formulation

Users can submit Market, Limit, Immediate-or-Cancel (IOC), and Fill-or-Kill (FOK) orders into the active engine and observe deterministic order execution, depth replenishment, and microstructure shifts.

## Architecture

- **`lib/engine`**: Pure TypeScript matching engine and synthetic Poisson trader simulator with zero UI/framework dependencies.
- **`lib/metrics`**: Quantitative microstructure metrics calculators (Spread, Microprice, multi-level OBI, rolling event-based OFI).
- **`lib/store`**: High-frequency Zustand client store for low-latency L2 book snapshots and trades.
- **`app/api/stream`**: Server-Sent Events (SSE) streaming engine events directly to the UI.
- **`components`**: Financial terminal interface including interactive Order Book Ladder (depth visualization), Live Microstructure Metrics Bar, and Zod-validated Order Entry Panel.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
