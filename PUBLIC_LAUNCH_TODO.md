# CODE2-CALENDER — Public Launch Action Items
Discussed: 2026-05-09

---

## 1. Hosting & Domain (Manual — User kare)
- Domain: Namecheap se .com lena (~₹800/yr) ya BigRock se .in (~₹399/yr)
- Host: Hetzner CX22 (€3.79/month) — static IP zaroori hai Dhan algo trading ke liye
- Setup: Docker + Nginx + Certbot SSL + domain DNS → Hetzner IP

---

## 2. ImageKit — Per-User Folders (Code change)
- Problem: Sab users ki images ek shared folder mein hain
- Fix: ImageKit upload path mein user_id add karo → `/trading_journal/user_{id}/filename`
- File: `services/image_service.py`

---

## 3. Image Access Control (Code change)
- Problem: Koi bhi UUID URL se kisi ki bhi image dekh sakta hai
- Fix: Image serve route mein current_user check lagao
- Ya: ImageKit signed URLs use karo private access ke liye

---

## 4. "Download My Complete Data" ZIP Button (Code change)
- New endpoint: `GET /api/export/full-backup`
- ZIP mein ho: trades_{user_id}.json + user ki saari images
- Frontend: Settings/profile area mein button
- Note: Per-user Google Drive OAuth ki zaroorat nahi — ye kaafi hai

---

## 5. Developer-Side Daily Backup (User configures)
- Tumhari apni GDrive pe sab users ka data daily backup
- Already partially built: `services/gdrive_service.py`
- Karna: Scheduled daily auto-backup of all trades_{user_id}.json files

---

## 6. Hetzner Weekly Snapshot (Manual — User kare)
- Hetzner dashboard → Snapshots → Automatic weekly snapshot enable karo
- Cost: €0.0119/GB/month
- Protection: Disk failure ya hosting-side issue se

---

## 7. Post-Registration Onboarding Flow (Code change)
- Problem: Abhi sirf email + password → seedha app
- Fix: Registration ke baad ek friendly onboarding screen (one-time, skippable)
- Fields (sab optional):
  - Name / Display name
  - City / State
  - Trading experience: Beginner / Intermediate / Pro
  - Kya trade karte ho: Stocks / F&O / Crypto / Commodities (multi-select)
  - Kaise pata chala app ka: Friend / Social Media / Search / Other
- Storage: `data/user_profile_{id}.json` per user
- Frontend: Naya onboarding template, sirf pehli baar registration ke baad dikhega

---

## 8. Per-Trade OHLC Chart — Strategy Lab (Code change)
- Status: Backend 80% ready (ohlc_scheduler + ohlc_service + dhan_service sab hai)
- Jo banana hai:
  - New API: `GET /api/trade-chart?instrument=SYMBOL&date=YYYY-MM-DD`
    → OHLC candles + entry_time + exit_time return karo
  - Frontend: Candlestick chart with entry (green) + exit (red) markers
  - Timeframe toggle: 1min / 5min / 15min
- Key files:
  - `services/ohlc_service.py` → load() + resample()
  - `services/dhan_service.py` → fetch_expired_option_ohlc()
  - `processors/data_processors.py` → user trades load karo
- Caveat: Dhan sirf last 90 days ka intraday deta hai; purane trades mein daily candles only

---

## Skipped (baad mein)
- Per-user Google Drive OAuth — 5-10 users ke liye overkill, users grow hone pe add karna
- SQLite → PostgreSQL — 50+ users pe sochna, abhi zaroori nahi
