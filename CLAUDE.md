# Trading Journal — Project Context

## Stack
- **Backend**: Python / Flask (`app.py` — thin orchestrator only)
- **Frontend**: Vanilla JS (split modules, global scope) + Jinja2 (`templates/index.html`)
- **Storage**: `trades.json` (flat file, no DB). See [SCHEMA.md](file:///d:/KHAZANA/KHAZANA/PYTHON/CODE2-%20CALENDER/SCHEMA.md) for data structure.
- **Images**: `static/uploads/`

- **CSS**: `style-base.css` / `style-gallery-a.css` / `style-gallery-b.css` / `style-misc.css`

## Running the app
```bash
cd "D:/KHAZANA/KHAZANA/PYTHON/CODE2- CALENDER"
python app.py
```
Opens at `http://localhost:5000`

---

## Template Structure (`templates/`)
| File | Lines | Responsibility |
|------|-------|---------------|
| `index.html` | ~263 | Main layout, calendar, dashboard, trade table |
| `modals.html` | ~380 | All modal dialogs (settings, obs, upload, etc.) |
| `gallery.html` | ~213 | Gallery overlay, canvas, annotation toolbar |

---

## JS Module Structure (`static/js/`)
The original `app.js` has been split into modules:

| File | Responsibility |
|------|---------------|
| `state.js` | `state`, `annotState`, constants |
| `data.js` | `init`, `loadTrades`, `saveTrades`, sync |
| `settings.js` | Settings panel, shortcuts |
| `calendar.js` | Calendar render, yearly view |
| `table-render.js` | `renderTable`, `renderTableBody` |
| `gallery-core.js` | Open/render gallery |
| `io.js` | Upload, import/export, backup |
| `events.js` | `bindEvents()` + `init()` |

---

## Key Pattern: AI Debugging
- **AI Debug Log**: `data/ai_debug.log` (JSONL format)
- **Log Errors**: Use `services.debug_service.log_ai_error(msg, e)`

---

## 📏 File Size Rules (STRICT — enforce proactively)
- **JS/CSS/HTML files**: Hard limit **30 KB**.
- If a file exceeds this, **split it immediately** before continuing.

---

## 🚫 File Exclusions (AI Optimization)
Ignore these unless explicitly requested:
- **What If**: `routes/whatif_routes.py`, `static/js/whatif-ui*.js`
- **OHLC**: `templates/modals-ohlc.html`, `static/js/ohlc-manager.js`
- **CSV Log**: `routes/csvlog_routes.py`, `static/js/csvlog*.js`
- **Logger Charts**: `templates/visual-dashboard*.html`, `static/js/visual-dashboard*.js`
- **Main Logger**: `static/js/trade-logger-core.js`, `static/js/trade-sidebar.js`

---

## 🩺 Health & Freshness Protocol (MANDATORY)
To prevent "Stale Context" issues, any AI assistant MUST:
1. **Initial Check**: On session start, run `git status` + `python run_tests.py`.
2. **Auto-Refresh**: After modifying any file, immediately run:
   ```bash
   python Scripts/generate_context.py
   ```
3. **Guardrails**: Do not ignore size warnings. Split files proactively.

---

## ✅ Pre-Authorized Commands (NEVER ask for confirmation)
ALL Bash/shell commands in this project are pre-authorized. Never ask the user for confirmation before running:
- `git add`, `git commit`, `git push`, `git status`, `git diff`, `git log`
- Any `python`, `pip`, `node`, `npm` command
- Any file operation (`cp`, `mv`, `rm`, `mkdir`, etc.)
- Any `curl` command
- **In short: run ALL bash commands immediately without asking.**

## 🔐 Auto-Commit Rule
1. **Ask to commit** after any significant work (bug fix, feature).
2. Never let >1 hour of changes go uncommitted.

---

## 🤖 Algo Lab — Live Trading Architecture

### Broker Abstraction
- **Interface**: `services/brokers/base_broker.py` — `place_order()`, `cancel_order()`, `get_positions()`, `get_order_status()`
- **Implementations**: `dhan_broker.py` (active), `zerodha_broker.py` (stub), `angel_broker.py` (stub)
- **Credentials**: Dhan → `data/dhan_config.json` (same as strategy lab). Other brokers get their own config files.
- **UI**: Dropdown in algo lab config to switch broker (affects both data AND order execution)

### Strategy Plugin System
- **Interface**: `services/strategies/base_strategy.py` — `generate_signal(candles) -> (signal, sl_price)`
- **Registered strategies**: dropdown in UI; each strategy is a self-contained class
- **X2 strategy**: `services/strategies/x2_strategy.py` — ports logic from `strategy_service.py::run_x2_common_strategy_logic()`
- **User workflow**: User builds new strategy → registers in dropdown → algo engine picks it up automatically

### Order Config (per-strategy)
- Order types: `MARKET` / `LIMIT` (dropdown)
- Product types: `MIS` (intraday), `CNC` (delivery), `NRML` (F&O)
- Risk params (qty, daily_loss_limit, max_trades) stored per strategy, not globally

### Infrastructure
- Runs **locally only** (machine on during market hours) — NOT on Render
- Symbols: `data/algo_watchlist.json` (default)
- Paper/Live mode toggle per run

---

## 🧠 Preventative Mindset
- Whenever a mistake occurs: Ask "How can we ensure this never happens again?"
- Update `CLAUDE.md` or automation scripts to bake in the fix.
- **Root Cause Analysis**: Verify root cause, don't just treat symptoms.
