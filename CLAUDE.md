# Trading Journal — Project Context

## Stack
- **Backend**: Python / Flask (`app.py` — thin orchestrator only)
- **Frontend**: Vanilla JS (split modules, global scope) + Jinja2 (`templates/index.html`)
- **Storage**: `data/trades_1.json` (flat file, no DB). `trades.json` is legacy fallback only.
- **Images**: `static/uploads/`

## 🚀 Server Migration Guide (Hostinger → Hetzner or any new VPS)

### Why migrations break things (root causes we fixed)
| Problem | Root Cause | Fix Applied |
|---------|-----------|-------------|
| Images 404 on live server | `require_login` hook blocked `/uploads/` for unauthenticated browsers | `image.uploaded_file` added to `allowed_endpoints` in `app.py` |
| Images 404 (wrong folder) | JSON stores flat `/uploads/file.png` but files are in `uploads/user_1/` | `user_1` fallback added to `uploaded_file()` route in `image_routes.py` |
| Pull/Push sync broken | `ADMIN_API_KEY` not set on new server | Must set in server `.env` |
| Pull/Push pointing to old server | `LIVE_SERVER_URL` hardcoded to old URL | Must update local `.env` |
| `no such column: user.created_at` | `db.create_all()` doesn't add columns to existing tables | Auto ALTER TABLE migration in `app.py` on startup |
| Dhan API 401 spam | Scheduler retried every 5 min even with expired token | `_token_expired` flag added to `ohlc_scheduler.py` |

### Allowed endpoints (public, no login required) — NEVER REMOVE THESE
In `app.py` → `require_login()` → `allowed_endpoints` list:
```python
'image.uploaded_file'   # /uploads/* — images, audio, video must be public
'page.mobile'           # /mobile — PWA entry point
'page.mobile_assets'    # /mobile/assets/* — PWA JS/CSS
```
If you add a new route that serves files/media, add its endpoint here.

### Step-by-step migration checklist

**Step 1 — On new server, set up `.env`:**
```
ADMIN_API_KEY=khazana2026
LIVE_SERVER_URL=http://<NEW_SERVER_IP>
FLASK_DEBUG=false
UPLOADS_DIR=/app/data/uploads
```

**Step 2 — Update local `.env`:**
```
LIVE_SERVER_URL=http://<NEW_SERVER_IP>   ← change this to new IP
ADMIN_API_KEY=khazana2026
```

**Step 3 — Migrate data (do this BEFORE switching DNS/IP):**
```bash
# Files that MUST be copied to new server:
data/trades_1.json          # all trade data
data/users.db               # user accounts (WITHOUT this, all users must re-register)
static/uploads/user_1/      # all images (large — use rsync or SFTP)
data/pdfs.json              # PDF metadata
data/dhan_config.json       # Dhan credentials
```

**Step 4 — Verify after deploy:**
```bash
# Test image serving (should return image/png, NOT text/html)
curl -I http://<NEW_IP>/uploads/<any-filename>.png

# Test admin sync
curl -H "X-Api-Key: khazana2026" http://<NEW_IP>/api/admin/data-version

# Test pull from localhost
# Open localhost:5000 → File menu → Pull from Live
```

**Step 5 — Docker restart after `.env` changes:**
```bash
docker restart code2
```

### What users DON'T need to do
Users only use the live server URL. They register/login and use the app. No config, no migration steps, no `.env`. Everything above is developer (Arsalan) work only.

---

## 🔒 Image Upload Rule — LOCAL FIRST, CDN SECOND (NEVER VIOLATE)
> Lesson: ImageKit/Cloudinary CDN dependency caused images to be unrecoverable when CDN became inaccessible.

**Every image MUST be saved to `static/uploads/` locally BEFORE any CDN upload.**
- `save_uploaded_image()` in `services/image_service.py` — local save is always step 1
- `_copy_to_backup()` is always called after local save (backup folder copy)
- CDN (ImageKit) upload happens AFTER local save, as an optional secondary step
- If CDN upload fails → still return local `/uploads/filename` URL — never fail the upload
- **NEVER** write code that skips local save and goes straight to CDN
- **CSS**: `style-base.css` / `style-gallery-a.css` / `style-gallery-b.css` / `style-misc.css`

## Running the app
```bash
cd "D:/KHAZANA/KHAZANA/PYTHON/CODE2- CALENDER"
python app.py
```
Opens at `http://localhost:5000`

---

## Backend Architecture (layered — ALWAYS follow this)
```
app.py          → thin entry point (setup + blueprint registration only)
config.py       → ALL paths & env vars (DATA_FILE, UPLOADS_DIR, ALGO_*, DHAN_*, etc.)
routes/         → HTTP only: parse request → call service → return jsonify()
services/       → business logic (no Flask, no request/response objects)
  brokers/      → broker abstraction layer (see Algo Lab section)
  strategies/   → strategy plugin layer (see Algo Lab section)
processors/     → pure data transforms
```

## Route Files
| File | Routes |
|------|--------|
| `routes/page_routes.py` | `GET /`, `GET /updates` |
| `routes/trade_routes.py` | `GET/POST /api/trades` |
| `routes/image_routes.py` | upload-image, delete-image, `/uploads/<file>` |
| `routes/import_routes.py` | import-excel, import-json, import-dhan-csv, etc. |
| `routes/export_routes.py` | backup, export-excel, export-csv |
| `routes/algo_routes.py` | `/algo-lab`, `/api/algo/*` |
| `routes/strategy_routes.py` | `/strategy-lab`, `/api/strategy/*` |

---

## Template Structure (`templates/`)
| File | Responsibility |
|------|---------------|
| `index.html` | Main layout, calendar, dashboard, trade table |
| `modals.html` | All modal dialogs (settings, obs, upload, etc.) |
| `gallery.html` | Gallery overlay, canvas, annotation toolbar |
| `algo_lab.html` | Algo Lab page |
| `strategy_lab.html` | Strategy Lab page (+ sidebar + modals includes) |

---

## JS Module Structure (`static/js/`)
All modules are **flat** in `static/js/` — NO subdirectories (intentional).
Load order in `index.html` is critical — global scope, no ES modules.
`bundle.js` is AUTO-GENERATED on Flask startup — never edit directly.

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
| `algo-lab.js` | Algo Lab frontend (config, tick, orders, chart) |
| `strategy-lab-a.js` | Strategy Lab chart rendering |
| `strategy-lab-b/c.js` | Strategy Lab additional features |

JS service files live in `static/js/services/` (apiClient, tradeService, imageService, etc.)

---

## 🤖 Algo Lab — Complete Architecture

### Files at a glance
| File | Role |
|------|------|
| `routes/algo_routes.py` | HTTP layer — all `/api/algo/*` endpoints |
| `services/algo_engine.py` | Core tick engine — broker + strategy agnostic |
| `services/brokers/base_broker.py` | Abstract interface: `fetch_candles`, `place_order`, `cancel_order`, `get_positions` |
| `services/brokers/dhan_broker.py` | **Active** — Dhan implementation (data + live orders) |
| `services/brokers/zerodha_broker.py` | Stub (NotImplementedError) |
| `services/brokers/angel_broker.py` | Stub (NotImplementedError) |
| `services/brokers/broker_registry.py` | `get_broker('dhan')` → `DhanBroker()` |
| `services/strategies/base_strategy.py` | Abstract: `generate_signal(candles, params) → (signal, price, sl)` |
| `services/strategies/ema_crossover_strategy.py` | EMA fast/slow crossover |
| `services/strategies/x2_strategy.py` | Arsalan X2 — wraps `run_x2_common_strategy_logic()` |
| `services/strategies/strategy_registry.py` | `get_strategy('Arsalan X2')` → `X2Strategy()` |
| `templates/algo_lab.html` | UI — dropdowns: broker, strategy, mode, order type, product type |
| `static/js/algo-lab.js` | Frontend — config read/write, tick, order book, chart modal |
| `static/css/style-algo-lab.css` | Algo Lab styles |

### Data files
| File | Purpose |
|------|---------|
| `data/algo_config.json` | Broker, strategy, mode, EMA params, qty, loss limit |
| `data/algo_orders.json` | Paper + live order book (JSON log) |
| `data/algo_state.json` | Daily PnL + stopped flag (resets each day) |
| `data/algo_watchlist.json` | Resolved symbols with security_id |
| `data/algo_ohlc/SYMBOL_DATE.json` | Auto-saved OHLC candles per tick |
| `data/dhan_config.json` | Dhan credentials (shared with strategy lab) |
| `data/daily_pivot_levels.json` | Daily pivot levels for X2 strategy |

### Config schema (`algo_config.json`)
```json
{
  "broker": "dhan",
  "strategy": "EMA Crossover",
  "mode": "paper",
  "order_type": "MARKET",
  "product_type": "INTRADAY",
  "ema_fast": 9, "ema_slow": 20, "timeframe": 1,
  "entry_mode": "candle_close", "sl_type": "crossover",
  "daily_loss_limit": 100, "qty": 1, "running": false,
  "strategy_params": {}
}
```

### Adding a new strategy
1. Create `services/strategies/my_strategy.py` extending `BaseStrategy`
2. Implement `generate_signal(candles, params) → (signal, price, sl_price)`
3. Register in `services/strategies/strategy_registry.py`
4. Add `<option>` in `templates/algo_lab.html` dropdown
→ Algo engine picks it up automatically on next tick.

### Adding a new broker
1. Create `services/brokers/my_broker.py` extending `BaseBroker`
2. Implement `fetch_candles()` + `place_order()` (minimum required)
3. Register in `services/brokers/broker_registry.py`
4. Add `<option>` in `templates/algo_lab.html` dropdown

### Modes
- **paper**: signals logged to JSON only — no real orders sent
- **live**: JSON log + `broker.place_order()` called — real money

### Key functions
- `run_tick()` in `algo_engine.py` — main entry point per tick
- `broker.fetch_candles()` — data (moved from `_fetch_candles` in engine)
- `strategy.generate_signal(candles, params)` — signal detection
- `get_cached_candles(security_id)` — in-memory cache for chart endpoint

---

## Strategy Lab
| File | Role |
|------|------|
| `routes/strategy_routes.py` | `/api/strategy/nifty-data` |
| `services/strategy_service.py` | `run_x2_common_strategy_logic()`, `run_pinned_strategy_logic()`, EMA, candle patterns |
| `services/strategy_data_service.py` | Data fetch layer (yfinance, Dhan, local CSV) |

**4 strategy variants**: Arsalan Continuation, Sandbox, Reversal, X2
**X2 params**: `hawa_me_zone` (bool), `use_fresh_zone` (bool)

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
- **OHLC Modal**: `templates/modals-ohlc.html`, `static/js/ohlc-manager.js`
- **CSV Log**: `routes/csvlog_routes.py`, `static/js/csvlog*.js`
- **Logger Charts**: `templates/visual-dashboard*.html`, `static/js/visual-dashboard*.js`
- **Main Logger**: `static/js/trade-logger-core.js`, `static/js/trade-sidebar.js`

---

## 🩺 Health & Freshness Protocol (MANDATORY)
1. **Initial Check**: On session start, run `git status` + `python run_tests.py`.
2. **Auto-Refresh**: After modifying any file, run:
   ```bash
   python Scripts/generate_context.py
   ```
3. **Guardrails**: Do not ignore size warnings. Split files proactively.

---

## ✅ Pre-Authorized Commands (NEVER ask for confirmation)
ALL Bash/shell commands in this project are pre-authorized:
- `git add`, `git commit`, `git push`, `git status`, `git diff`, `git log`
- Any `python`, `pip`, `node`, `npm` command
- Any file operation (`cp`, `mv`, `rm`, `mkdir`, etc.)
- Any `curl` command
- **In short: run ALL bash commands immediately without asking.**

## 🔐 Auto-Commit Rule
1. **Ask to commit** after any significant work (bug fix, feature).
2. Never let >1 hour of changes go uncommitted.

---

## 🧠 Preventative Mindset
- Whenever a mistake occurs: Ask "How can we ensure this never happens again?"
- Update `CLAUDE.md` or automation scripts to bake in the fix.
- **Root Cause Analysis**: Verify root cause, don't just treat symptoms.

## ♻️ Smart Service Rule (MANDATORY — follow without being told)

Before writing ANY new feature, silently ask these 3 questions:

**Q1: Kya ye cheez pehle se kisi service mein hai?**
→ Agar haan → import karo, dobara mat likho.

**Q2: Kya ye cheez 2+ jagah lagegi, ya future mein lag sakti hai?**
→ Agar haan → pehle `services/` mein likho, phir wahan se import karo.
Examples of "will be reused":
- API calls (Dhan, broker, ImageKit)
- Image save/backup operations
- File read/write operations
- Credential/token access
- Data transforms used in multiple routes

**Q3: Kya main route mein business logic likh raha hoon?**
→ Agar haan → rok jao, service mein shift karo.
```python
# Wrong: route ke andar 30 lines ka logic
# Right: route mein sirf yeh
result = some_service.do_work(params)
return jsonify(result)
```

**Auto-decision rule (no user permission needed):**
| Situation | Action |
|-----------|--------|
| New API call anywhere | → `services/` mein add karo |
| New file read/write | → relevant `services/` ya `processors/` mein |
| Same logic 2nd baar | → Extract to service, replace both usages |
| New external integration | → Naya `services/xyz_service.py` banao |
| Data transform / calculation | → `processors/` mein |

**Outcome:** User ko bata do: "X ko service mein daala — ab Y aur Z dono use kar sakte hain."

---

## VPS Management Scripts

VPS ke liye utility scripts alag folder mein hain:

```
D:\KHAZANA\KHAZANA\PYTHON\_VPS_TOOLS\
├── deploy_vps.py          ← App deploy karo VPS pe
├── deploy_admin.py        ← Admin panel deploy
├── debug_vps.py           ← SSH debug
├── check_users.py         ← docker code2 users list
├── check_imgs.py          ← VPS pe images check
├── fix_uploads.py         ← Upload issues fix
├── test_email.py          ← Email config test
├── upload_data.py         ← Data files upload
└── sync_render_to_vps.py  ← Render.com backup → VPS sync
```

**VPS:** `72.61.173.32` | Docker container: `code2`
