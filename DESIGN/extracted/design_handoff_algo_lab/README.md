# Handoff: Algo Lab — Unified Trading Platform

## Overview

This is a unified trading dashboard that merges two previously separate apps:
- **Algo Lab** (Live/Paper Trading) — real-time bot trading with strategy config, watchlist, P&L tracking
- **Strategy Lab** (Backtesting) — historical backtesting with chart analysis, data history, trade results

The merged app allows traders to switch between **LIVE** and **BACKTEST** modes from a single interface, sharing configuration, watchlist, and chart views across both modes.

---

## About the Design Files

The file `Algo Lab Merged v2.html` is a **high-fidelity design reference** built as a React + Babel prototype. It is **not production code** — it is a visual and behavioral specification showing exactly how the UI should look and work.

Your task is to **recreate this design in your existing codebase** (Next.js, React, Vue, etc.) using its established patterns, component libraries, and state management. If no framework exists yet, **React + TypeScript with Tailwind CSS** is recommended.

**Fidelity: High-Fidelity (HiFi)**
All colors, spacing, typography, interactions, hover states, and animations are final and should be reproduced pixel-perfectly.

---

## App Architecture

```
App
├── Header (top bar, 48px height)
│   ├── Sidebar toggle (hamburger)
│   ├── Logo ("⚡ Algo Lab")
│   ├── Mode Toggle (LIVE | BACKTEST)
│   ├── Context info (tick timer / symbol)
│   ├── Paper/Live trading switch (live mode only)
│   ├── Chart toggle + Single/Dual toggle
│   ├── Run Tick Now button (live mode)
│   ├── BOT ON/OFF button (live mode)
│   └── Theme toggle (dark/light)
├── Body (flex row, fills remaining height)
│   ├── Sidebar (collapsible, 260px compact / 300px wide)
│   │   ├── LIVE MODE: 3 tabs — Config | Watchlist | Controls
│   │   └── BACKTEST MODE: Configuration panel
│   └── Main Content (flex, fills rest)
│       ├── LIVE MODE
│       │   ├── P&L Cards row (4 cards)
│       │   ├── Chart area (optional, toggle)
│       │   ├── Tab bar: Paper Orders | Live Orders | Latest Signals | OHLC Data
│       │   └── Tab content
│       └── BACKTEST MODE
│           ├── Chart area (optional, toggle)
│           ├── Tab bar: Configuration | Results | Data History | Sync Data | MTM | Pivots
│           └── Tab content
└── Fullscreen Chart Overlay (portal, z-index: 100)
```

---

## Design Tokens

### Colors (Dark Theme)

```css
--bg-base:        #0d1117   /* page background */
--bg-surface:     #161b22   /* header, sidebar */
--bg-card:        #1c2333   /* cards, table rows */
--bg-hover:       #21273a   /* hover states */
--bg-input:       #0d1117   /* input backgrounds */
--border:         #30363d   /* main borders */
--border-subtle:  #21273a   /* table row dividers */
--text-primary:   #e6edf3
--text-secondary: #8b949e
--text-muted:     #484f58
--accent-blue:    #58a6ff
--accent-green:   #3fb950
--accent-red:     #f85149
--accent-orange:  #d29922
--accent-purple:  #bc8cff
--btn-primary-bg: #238636   /* Save button */
--badge-buy:      rgba(63,185,80,0.15)
--badge-sell:     rgba(248,81,73,0.15)
--glow-green:     0 0 12px rgba(63,185,80,0.3)
--glow-red:       0 0 12px rgba(248,81,73,0.3)
```

### Colors (Light Theme)

```css
--bg-base:        #f0f2f5
--bg-surface:     #ffffff
--bg-card:        #ffffff
--bg-hover:       #f6f8fa
--bg-input:       #f6f8fa
--border:         #d0d7de
--border-subtle:  #e8ecf0
--text-primary:   #1f2328
--text-secondary: #57606a
--text-muted:     #9ba3ac
--accent-blue:    #0969da
--accent-green:   #1a7f37
--accent-red:     #cf222e
--accent-orange:  #9a6700
--btn-primary-bg: #1a7f37
```

### Typography

```
Font 1: 'DM Sans' — UI labels, buttons, body text
Font 2: 'JetBrains Mono' — numbers, prices, symbols, code-like data

Font scale used:
  10px — labels, badges, table headers
  11px — secondary text, tab labels, chip text
  12px — table body, input text, form rows
  13px — section headings, Run Backtest button
  14px — overlay headings
  15px — app logo
  18px — stat values in backtest results
  22px — P&L card values
```

### Spacing & Shape

```
Border radius:
  4px  — badges, small chips
  5px  — small buttons
  6px  — inputs, dropdowns, small cards
  7px  — medium buttons
  8px  — cards, primary buttons
  10px — large panels (fullscreen overlay only)

Sidebar width: 260px (compact) / 300px (wide), 0px collapsed
Header height: 48px
Scrollbar: 4px width, no track background
```

---

## Screens / Views

### 1. Header (Always Visible)

**Layout:** `display: flex; align-items: center; height: 48px; padding: 0 16px; gap: 12px; background: var(--bg-surface); border-bottom: 1px solid var(--border)`

**Left group:**
- Hamburger icon button (18px SVG) — toggles sidebar open/closed
- Logo: ⚡ icon (16px, accent-orange) + "Algo Lab" text (700 weight, 15px, tracking -0.02em)
- Mode toggle pill: `background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 3px; gap: 2px`
  - LIVE button: active = `background: #238636; color: #fff`; inactive = transparent
  - BACKTEST button: active = `background: var(--accent-blue); color: #fff`; inactive = transparent
  - Button text: 11px, 700 weight, letter-spacing: 0.04em
- Context info (live mode): "Last tick: HH:MM:SS | Next in: Ns" — 11px mono, orange for countdown
- Context info (backtest mode): symbol name + date — 11px mono

**Right group (marginLeft: auto):**
- Paper/Live switch (live mode only): pill with PAPER | LIVE
  - LIVE active: `background: var(--accent-red); color: #fff`
  - PAPER active: `background: rgba(88,166,255,0.2); color: var(--accent-blue)`
- Chart toggle + view selector: compound button group with border
  - Eye/EyeOff icon + "Chart" text
  - When chart visible: ▣ (single) and ⧉ (dual) toggle buttons appear inline
- "Run Tick Now" button (live mode): outlined, 11px
- BOT ON/OFF button (live mode):
  - ON: `background: rgba(63,185,80,0.15); border: 1px solid rgba(63,185,80,0.4); color: var(--accent-green); box-shadow: var(--glow-green)`
  - OFF: same with red values
  - Animated pulsing dot (8px circle, `animation: pulse 1.5s infinite`) when ON
- Theme toggle: 32x32px square button, sun/moon icon (14px)
- "— Home" text link

---

### 2. Sidebar — LIVE Mode (3 tabs)

**Container:** `width: 260px; background: var(--bg-surface); border-right: 1px solid var(--border); display: flex; flex-direction: column`

**Tab strip:** `display: flex; border-bottom: 1px solid var(--border)`
- 3 equal tabs: Config | Watchlist | Controls
- Active: `color: var(--accent-blue); border-bottom: 2px solid var(--accent-blue)`
- Inactive: `color: var(--text-secondary); border-bottom: 2px solid transparent`
- Font: 10px, weight changes 700 active / 500 inactive

#### Tab: Config

**Strategy dropdown** (full width):
- Blue text (#58a6ff), 600 weight when selected
- Options: Arsalan X2 | Zone Breakout | EMA Crossover | RSI Reversal | Hawa Me

**Strategy flags preview** (appears below strategy dropdown):
```
background: var(--bg-hover); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 6px 8px
```
- 4 flag chips: Fresh Zone | SL Fib | Zone Exit | ATR Exit
- Active flag: `background: rgba(63,185,80,0.12); color: var(--accent-green); border: 1px solid rgba(63,185,80,0.25)`
- Inactive flag: `background: rgba(248,81,73,0.08); color: var(--text-muted)`

**Config fields** (each as: label on top, input below — `flex-direction: column; gap: 4px; margin-bottom: 10px`):
- Hawa Me Zone: `<select>` Off | On
- Use Fresh Zone: `<select>` On | Off
- Timeframe (min): `<input type="number">` default 1
- Entry Mode: `<select>` Candle Close | Market
- SL Type: `<select>` Crossover | Fixed | ATR
- Daily Loss ₹: `<input type="number">` default 100
- Qty: `<input type="number">` default 1

**Input/Select style:**
```css
background: var(--bg-input); border: 1px solid var(--border);
border-radius: 6px; padding: 5px 8px; font-size: 12px;
font-family: 'JetBrains Mono'; color: var(--text-primary); width: 100%
```

**Save Config button:** `background: #238636; border-radius: 8px; padding: 9px; color: #fff; font-weight: 700; font-size: 13px; width: 100%`

#### Tab: Watchlist

- Header: "WATCHLIST" label (11px, uppercase, letter-spacing 0.08em) + "Resolve & Save" button (blue, 10px)
- Chip grid: `display: flex; flex-wrap: wrap; gap: 4px`
- Each chip: `font-size: 10px; font-family: mono; padding: 3px 8px; border-radius: 5px`
  - Active: `border-color: var(--accent-blue); background: rgba(88,166,255,0.12); color: var(--accent-blue)`
  - Inactive: `border-color: var(--border); background: var(--bg-input); color: var(--text-secondary)`
- Stocks: APOLLOHOSP, TATACONSUM, SHREECEM, BAJAJ-AUTO, HDFCLIFE, SBILIFE, WIPRO, HDFCBANK, ICICIBANK, INDUSINDBK, GRASIM, DRREDDY, TECHM, CIPLA, RELIANCE, TCS, INFY

#### Tab: Controls

- "Clear Orders & Reset P&L" button: `background: var(--accent-red); width: 100%; border-radius: 8px; padding: 8px; font-weight: 700`
- Saved OHLC section: refresh button, auto-fetch status (green dot + text), file count

---

### 3. Sidebar — BACKTEST Mode

Single scrollable panel with these stacked fields:

| Field | Type | Options |
|---|---|---|
| Symbol | text input + "↺ Index" button | e.g. NIFTY26APR24100CE |
| Data Source | select | Dhan Local (CSV), Live API |
| Strategy | select | Arsalan X2, Zone Breakout, EMA Crossover, RSI Reversal, Hawa Me |
| Strategy Logic (PINE) | 4 checkboxes | Use Fresh Zone Only, SL Below Fib, Zone Exit, Atr Exit |
| Timeframe | select | 1m, 3m, 5m, 15m, 30m, 1h |
| Date Range | 2x date inputs | from / to |
| Market Time | 2x time inputs | 09:15 / 15:30 |
| Run Backtest | primary blue button | — |

---

### 4. Main Area — LIVE Mode

#### P&L Cards Row
`display: flex; gap: 10px; padding: 12px 16px 0; flex-wrap: wrap`

4 cards, each: `flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px`

| Card | Value | Color |
|---|---|---|
| Realized P&L | −₹43.15 | var(--accent-red) |
| Unrealized P&L | ₹196.18 | var(--accent-green) + green border + glow |
| Total P&L | ₹153.03 | var(--accent-green) |
| Open Positions | 23 | var(--text-primary) |

Label: 10px uppercase, letter-spacing 0.08em, color: var(--text-secondary)
Value: 22px, 700 weight, JetBrains Mono, letter-spacing -0.02em

#### Chart Area (when visible)
`padding: 12px 16px 0`

**Single view:** full-width chart placeholder, height 220px
**Dual view:** `display: grid; grid-template-columns: 1fr 1fr; gap: 10px`
- Left: "NIFTY 50 (INDEX)"
- Right: "NIFTY26APR24100CE"

Each chart card:
- Header: symbol name + timeframe buttons (1m, 3m, 6m) + fullscreen icon button
- Body: TradingView widget embed area (or placeholder with candlestick SVG)
- Active timeframe button: `background: var(--accent-blue); color: #fff`

#### Tab Bar (Live Mode)
- 📋 Paper Orders / 🟢 Live Orders (label changes with trading mode)
- Latest Signals
- OHLC Data

Active tab: `color: var(--text-primary); border-bottom: 2px solid var(--accent-blue); font-weight: 700`

#### Paper/Live Order Book Table

Columns: # | Symbol | Side | Entry | Time | CMP | Exit (live only) | P&L | Status

Header: `font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; background: var(--bg-surface); border-bottom: 1px solid var(--border)`
Row: `font-size: 12px; font-family: mono; padding: 8px; border-bottom: 1px solid var(--border-subtle)`
Open rows: `background: var(--bg-card)`
Closed rows: transparent background

Side badge:
- BUY: `background: var(--badge-buy); color: var(--accent-green); font-weight: 700`
- SELL: `background: var(--badge-sell); color: var(--accent-red)`
- `padding: 2px 8px; border-radius: 4px; font-size: 11px`

CMP cell: price on top + diff below (green if positive, red if negative, 10px)
Status: "OPEN" in accent-blue / "CLOSED" in text-muted

#### Latest Signals

Chips: `display: flex; flex-wrap: wrap; gap: 8px`
Each chip: `border-radius: 6px; padding: 4px 10px; font-size: 11px; font-family: mono`
- Warning: `background: rgba(210,153,34,0.12); border: 1px solid rgba(210,153,34,0.3)`
- OK: `background: var(--badge-buy); border: 1px solid rgba(63,185,80,0.3)`
- Symbol text: orange (warning) / green (ok), 600 weight
- Message text: var(--text-muted), 10px

---

### 5. Main Area — BACKTEST Mode

#### Tab Bar
Configuration | Results | Data History | Sync Data | MTM | Pivots | [Batch Export button right-aligned]

#### Results Tab

Stats grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px`

8 stat cards:
| Stat | Value | Color |
|---|---|---|
| Total Trades | 47 | neutral |
| Win Rate | 63.8% | green |
| Total P&L | ₹12,450 | green |
| Max Drawdown | ₹2,100 | red |
| Avg Win | ₹640 | green |
| Avg Loss | ₹380 | red |
| Profit Factor | 2.84 | green |
| Sharpe Ratio | 1.42 | neutral |

Equity Curve: SVG area chart below stats, green gradient fill + green line stroke

#### Data History Tab

Header: "Downloaded Data History" title + search input

**Search input:** `background: var(--bg-input); border: 1px solid var(--border); border-radius: 7px; padding: 5px 10px; font-family: mono; font-size: 12px` with magnifier icon

**Column headers:** DATE / TRADE DETAILS | DATA (M-F) | DUR | PT | AMT/PL
Grid: `grid-template-columns: 1fr 100px 60px 50px 80px`

**Date group row:** `background: var(--bg-hover); border-radius: 6px`
- Calendar icon (blue) + bold date (mono 13px) + "(N Trades | 1m)" (text-muted)
- Total P&L right-aligned, green/red, bold mono

**Trade row** (indented 20px left):
- Time range: `[09:50–10:17]` in text-muted mono 10px
- Status icon: ✓ (green) or ✗ (red), 13px
- Symbol parts: `NIFTY | 26 | APR | 24000 | CE` — pipe-separated
  - CE/PE: accent-orange
  - Strike price (5 digits): accent-blue
  - Others: text-secondary
- Qty badge: `background: var(--bg-hover); border: 1px solid var(--border); border-radius: 4px; font-size: 10px mono`
- ⇄ SYNC button: `background: rgba(88,166,255,0.12); border: 1px solid rgba(88,166,255,0.3); color: var(--accent-blue); font-size: 9px; font-weight: 700`
- Data dots: 5 circles (8px each), green if filled, var(--border) if empty
- DUR: e.g. "27m" in text-secondary mono 12px
- PT: e.g. "+30.4" green / "-4.3" red, mono 12px 600 weight
- AMT/PL: e.g. "+5,823" green / "-934" red, right-aligned, mono 12px bold

#### MTM Tab

3 stat cards in `grid-template-columns: repeat(3,1fr)`:
- Today MTM: ₹153.03 (green)
- Week MTM: ₹892.40 (green)
- Month MTM: −₹234.50 (red)

#### Pivots Tab

7 level rows: R3, R2, R1, PP, S1, S2, S3
- R levels: accent-red
- PP: text-primary
- S levels: accent-green
Each row: `padding: 7px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px`
Level label: 700 weight mono, width 24px
Price: mono 14px, text-primary

---

### 6. Fullscreen Chart Overlay

**Trigger:** fullscreen icon (⤢) in any chart header
**Container:** `position: fixed; inset: 0; z-index: 100; background: var(--bg-base); display: flex; flex-direction: column`

**Overlay header (44px):**
- Logo icon + symbol name
- Timeframe selector (1m, 3m, 5m, 15m)
- Single/Dual view toggle
- "Exit Fullscreen" button with ✕ icon (right-aligned)

**Chart body:** `flex: 1; padding: 12px`
- Single: one chart filling full height
- Dual: `grid-template-columns: 1fr 1fr; gap: 10px; height: 100%`

**Dismiss:** clicking "Exit Fullscreen" removes overlay

---

## Interactions & Behavior

### Mode Switch (LIVE ↔ BACKTEST)
- Clicking LIVE/BACKTEST in header instantly switches all content
- Sidebar content changes: 3-tab sidebar ↔ config panel
- Main content changes: P&L cards + orders ↔ chart + backtest tabs
- Chart auto-shows when switching to BACKTEST (optional, toggle-able)

### Paper/Live Trading Switch
- Toggle in header (live mode only): PAPER | LIVE
- Changes order book label: "📋 Paper Orders" ↔ "🟢 Live Orders"
- Changes order data: paper orders vs live orders with exit columns

### Chart Toggle
- Eye/EyeOff button shows/hides chart area
- Single/Dual buttons appear inline when chart is visible
- Single: shows one chart (index)
- Dual: shows two charts side by side

### Fullscreen Chart
- ⤢ button in chart header → fullscreen overlay
- Single/Dual toggle works inside fullscreen too
- ESC key or "Exit Fullscreen" button dismisses

### BOT Toggle
- Green pulsing dot when ON (CSS animation: pulse 1.5s infinite, opacity 1→0.4)
- Glow effect: `box-shadow: 0 0 12px rgba(63,185,80,0.3)` when ON
- Red glow when OFF

### Tick Countdown
- "Next in: Ns" counts down from 60 to 1, resets (1 second interval)
- Updates via setInterval in useEffect

### Theme Toggle
- Switches `data-theme` attribute between "dark" and "light" on root div
- All colors update via CSS custom properties

### Sidebar Collapse
- Hamburger toggles sidebar width: 260px → 0
- `transition: width 0.25s ease` for smooth animation
- Content hidden when width = 0

### Strategy Flags Preview
- Selecting different strategy in dropdown updates flag chips instantly
- Each strategy has different flag combinations (see data table in design file)

---

## State Variables

```typescript
// App-level state
mode: 'live' | 'backtest'           // main mode toggle
tradingMode: 'paper' | 'live'       // paper vs live trading (live mode only)
botOn: boolean                       // bot running state
showChart: boolean                   // chart visibility
chartView: 'single' | 'dual'        // chart layout
fullscreenChart: null | 'index' | 'option'  // fullscreen state
sidebarOpen: boolean                 // sidebar collapsed/expanded
theme: 'dark' | 'light'             // color theme

// Live mode tabs
activeTab: 'orders' | 'signals' | 'ohlc'

// Backtest mode tabs
backtestTab: 'config' | 'results' | 'data' | 'sync' | 'mtm' | 'pivots'

// Sidebar tab (live mode)
sidebarTab: 'config' | 'watchlist' | 'controls'

// Config state
selectedStrategy: string             // one of STRATEGIES array
watchlistSelected: Set<string>       // selected symbols

// Tick timer
nextTick: number                     // countdown seconds (60→1)
```

---

## Data Structures

```typescript
// Strategy
const STRATEGIES = ['Arsalan X2', 'Zone Breakout', 'EMA Crossover', 'RSI Reversal', 'Hawa Me'];

// Strategy flags per strategy
type StrategyFlags = {
  freshZone: boolean;
  slBelowFib: boolean;
  zoneExit: boolean;
  atrExit: boolean;
}

// Order (paper/live)
type Order = {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  entryTime: string;       // "HH:MM"
  cmp: number;
  cmpDiff: number;
  exitPrice: number | null; // null = open
  exitTime: string | null;
  pnl: number | null;
  status: 'OPEN' | 'CLOSED';
}

// Signal
type Signal = {
  symbol: string;
  status: 'ok' | 'warning';
  msg: string;
}

// Data History
type TradeRow = {
  time: string;            // "HH:MM–HH:MM"
  status: 'ok' | 'error';
  symbol: string;
  parts: string[];         // e.g. ['26', 'APR', '24000', 'CE']
  qty: string;             // e.g. "3L"
  dots: number;            // 1–5 data quality
  dur: string;             // e.g. "27m"
  pt: string;              // e.g. "+30.4" or "-4.3"
  amt: number;             // e.g. 5823 or -934
  synced: boolean;
}

type DayHistory = {
  date: string;            // "YYYY-MM-DD"
  trades: number;
  tf: string;              // "1m"
  rows: TradeRow[];
}
```

---

## Assets & Fonts

**Fonts (Google Fonts):**
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

**Icons:** All icons are inline SVG (24x24 viewBox, stroke-based, strokeWidth 2, linecap/linejoin round). No icon library dependency — can be replaced with Lucide React or Heroicons using same names:
- menu, close, zap, sun, moon, eye, eyeOff, settings, chart, refresh, barChart, database, trendUp, trendDown, clock, target, home, chevronDown, chevronRight

**Chart:** Currently placeholder SVG with fake candlesticks. In production, embed **TradingView Lightweight Charts** (`lightweight-charts` npm package) or TradingView widget iframe.

---

## Integration Notes

### TradingView Charts
Replace `<ChartPlaceholder>` with real chart:
```tsx
import { createChart } from 'lightweight-charts';
// or use TradingView widget iframe:
<iframe src="https://www.tradingview.com/widgetembed/..." />
```

### Backend API Endpoints Needed
```
GET  /api/pnl                    → { realized, unrealized, total, openPositions }
GET  /api/orders?mode=paper|live → Order[]
GET  /api/signals                → Signal[]
GET  /api/data-history           → DayHistory[]
POST /api/strategy/config        → save strategy config
POST /api/backtest/run           → trigger backtest, returns results
GET  /api/backtest/results/:id   → BacktestResults
POST /api/bot/toggle             → { on: boolean }
POST /api/tick/run               → trigger manual tick
```

### Dhan API
The app uses Dhan broker API for live trading. Token management UI is included (sync paused warning, Update Dhan Token button).

---

## Files in This Package

| File | Description |
|---|---|
| `Algo Lab Merged v2.html` | Full HiFi prototype — React + Babel, self-contained, open in browser |
| `README.md` | This document — full design spec for developer implementation |

---

## Quick Start for Developer

1. Open `Algo Lab Merged v2.html` in Chrome/Firefox to see the full interactive prototype
2. Toggle between LIVE and BACKTEST mode using the header toggle
3. In LIVE mode: switch sidebar tabs (Config / Watchlist / Controls), toggle PAPER/LIVE
4. In BACKTEST mode: explore all 6 tabs — Results has equity curve, Data History has trade table
5. Click Chart button to show charts, try Single/Dual toggle, click ⤢ for fullscreen
6. Click sun/moon to toggle light/dark theme
7. Refer to this README for exact measurements, colors, and state logic

---

*Design created May 2026. Prototype built with React 18 + Babel + DM Sans + JetBrains Mono.*
