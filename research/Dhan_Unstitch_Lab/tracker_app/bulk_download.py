"""
Bulk Historical Options Downloader
===================================
Run this script directly — no browser needed.
Downloads all instruments from tradebook.csv in parallel.

Usage:
    python bulk_download.py
    python bulk_download.py --from 2026-02-01 --to 2026-04-30
    python bulk_download.py --workers 4 --from 2026-04-01 --to 2026-04-30
"""

import os, re, sys, glob, time, datetime, argparse, threading
import pandas as pd
import requests

# ── Config ────────────────────────────────────────────────────────────────────
JWT_TOKEN    = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzc3NzIwNTA0LCJpYXQiOjE3Nzc2MzQxMDQsInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTAxMzEwOTc2In0.9RdINQXCUnMS3Gjcph2ECm6jeNV9so4wVzq8ylwvVlV47B72DQBvwpGwEmQ0zflTV8SJtLtPqMhi0N0OyVePbA"
CLIENT_ID    = "1101310976"
UPLOAD_DIR   = r"C:\Users\arsal\Desktop\New folder (2)\TEMP\tracker_app\uploads"
DOWNLOADS_DIR= r"C:\Users\arsal\Desktop\New folder (2)\TEMP\Downloaded_Data"
HEADERS      = {"access-token": JWT_TOKEN, "client-id": CLIENT_ID, "Content-Type": "application/json"}

NSE_HOLIDAYS = {
    "2026-01-15","2026-01-26","2026-03-03","2026-03-26","2026-03-31",
    "2026-04-03","2026-04-14","2026-05-01","2026-05-28","2026-06-26",
    "2026-09-14","2026-10-02","2026-10-20","2026-11-10","2026-11-24","2026-12-25",
}

print_lock = threading.Lock()

def log(msg):
    with print_lock:
        print(msg)

# ── Dhan API ──────────────────────────────────────────────────────────────────
def dhan_request(url, payload, retries=10):
    for i in range(retries):
        try:
            r = requests.post(url, headers=HEADERS, json=payload, timeout=15)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                time.sleep(3 + i * 2)
            else:
                time.sleep(0.5)
        except:
            time.sleep(0.5)
    return None

# ── Parse tradebook ───────────────────────────────────────────────────────────
def load_instruments():
    path = os.path.join(UPLOAD_DIR, "tradebook.csv")
    if not os.path.exists(path):
        print(f"ERROR: tradebook.csv not found at {path}")
        sys.exit(1)

    df = pd.read_csv(path)
    df["trade_date"]  = pd.to_datetime(df["trade_date"],  errors="coerce").dt.strftime("%Y-%m-%d")
    df["expiry_date"] = pd.to_datetime(df["expiry_date"], errors="coerce").dt.strftime("%Y-%m-%d")
    unique = df.groupby("symbol").agg({"trade_date": "min", "expiry_date": "first"}).reset_index()

    instruments = []
    for _, row in unique.iterrows():
        sym = str(row["symbol"]).strip()
        m = re.search(r"^([A-Z]+)(\d{2})([A-Z0-9]+)(\d{5})([CP][E])$", sym)
        if not m:
            continue
        underlying  = m.group(1)
        expiry_part = m.group(3)
        strike      = int(m.group(4))
        opt_type    = "CALL" if m.group(5) == "CE" else "PUT"

        if expiry_part.isdigit():
            mon_d = int(expiry_part[0])
            day_d = int(expiry_part[1:])
            mon_s = datetime.date(2026, mon_d, 1).strftime("%b").upper()
            dhan_name   = f"{underlying} {day_d:02d} {mon_s} {strike} {opt_type}"
            expiry_type = "Weekly"
        else:
            raw = str(row["expiry_date"])
            try:
                ed_day = int(raw.split("-")[2])
            except:
                ed_day = 28
            dhan_name   = f"{underlying} {ed_day} {expiry_part.upper()} {strike} {opt_type}"
            expiry_type = "Monthly"

        instruments.append({
            "zerodha": sym,
            "dhan_name": dhan_name,
            "underlying": underlying,
            "strike": strike,
            "opt_type": opt_type,
            "trade_date": str(row["trade_date"]),
            "expiry_date": str(row["expiry_date"]),
            "expiry_type": expiry_type,
        })

    return instruments

# ── Trading days between two dates ────────────────────────────────────────────
def trading_days(start, end):
    days = []
    curr = datetime.datetime.strptime(start, "%Y-%m-%d")
    last = datetime.datetime.strptime(end,   "%Y-%m-%d")
    while curr <= last:
        ds = curr.strftime("%Y-%m-%d")
        if curr.weekday() < 5 and ds not in NSE_HOLIDAYS:
            days.append(ds)
        curr += datetime.timedelta(days=1)
    return days

# ── Find or create instrument folder ─────────────────────────────────────────
def get_target_dir(inst):
    folder = inst["dhan_name"].replace(" ", "_")
    pattern = os.path.join(DOWNLOADS_DIR, "Premium", "**", folder)
    results = [d for d in glob.glob(pattern, recursive=True) if os.path.isdir(d)]
    if results:
        return results[0]
    path = os.path.join(DOWNLOADS_DIR, "Premium", inst["trade_date"], folder)
    os.makedirs(path, exist_ok=True)
    return path

# ── Download one instrument ───────────────────────────────────────────────────
def download_instrument(inst, start_date, end_date, idx, total):
    name      = inst["dhan_name"]
    underlying= inst["underlying"]
    strike    = inst["strike"]
    opt_type  = inst["opt_type"]
    expiry    = inst["expiry_date"]
    is_monthly= inst["expiry_type"] == "Monthly"

    sec_id = {"NIFTY": "13", "BANKNIFTY": "25", "FINNIFTY": "27"}.get(underlying, "13")
    pe_ce  = "ce" if opt_type == "CALL" else "pe"
    folder = inst["dhan_name"].replace(" ", "_")

    # Only download days that overlap with instrument life
    days_all = trading_days(start_date, end_date)
    days = [d for d in days_all if inst["trade_date"] <= d <= expiry]
    if not days:
        return

    target_dir = get_target_dir(inst)
    missing    = [d for d in days if not os.path.exists(
                    os.path.join(target_dir, f"{folder}_{d}.csv"))]

    if not missing:
        log(f"[{idx:>3}/{total}] ✅ SKIP  {name} (all {len(days)} days exist)")
        return

    log(f"[{idx:>3}/{total}] ⬇  START {name}  ({len(missing)} days to fetch)")

    fetched = 0
    for day_idx, TRADE_DATE in enumerate(missing):
        NEXT_DATE = (datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d") +
                     datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        day_csv   = os.path.join(target_dir, f"{folder}_{TRADE_DATE}.csv")

        # Spot timestamps
        spot = dhan_request("https://api.dhan.co/v2/charts/intraday", {
            "securityId": sec_id, "exchangeSegment": "IDX_I", "instrument": "INDEX",
            "interval": "1", "fromDate": TRADE_DATE, "toDate": TRADE_DATE
        })
        timestamps = []
        if spot and spot.get("timestamp"):
            timestamps = [datetime.datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                          for ts in spot["timestamp"]]
        if not timestamps:
            continue

        # Expiry code discovery
        td_obj  = datetime.datetime.strptime(TRADE_DATE, "%Y-%m-%d")
        exp_obj = datetime.datetime.strptime(expiry, "%Y-%m-%d")
        candidates = ([("MONTH",1),("MONTH",2)] + [("WEEK",i) for i in range(1,6)]) if is_monthly \
                     else ([("WEEK", (exp_obj-td_obj).days//7+1),
                             ("WEEK", (exp_obj-td_obj).days//7+2),
                             ("WEEK", (exp_obj-td_obj).days//7),
                             ("MONTH",1)])
        candidates = [c for c in candidates if c[1] >= 1]

        valid_type, valid_code = None, None
        for exp_type, exp_code in candidates:
            r = dhan_request("https://api.dhan.co/v2/charts/rollingoption", {
                "securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX",
                "interval": 1, "expiryCode": exp_code, "expiryFlag": exp_type,
                "strike": "ATM", "drvOptionType": opt_type, "requiredData": ["close"],
                "fromDate": TRADE_DATE, "toDate": NEXT_DATE
            })
            if r and "data" in r and pe_ce in r["data"] and r["data"][pe_ce] and r["data"][pe_ce].get("close"):
                valid_type, valid_code = exp_type, exp_code
                break
            time.sleep(0.05)
        if not valid_type:
            continue

        # Fetch OHLCV
        r = dhan_request("https://api.dhan.co/v2/charts/rollingoption", {
            "securityId": sec_id, "exchangeSegment": "NSE_FNO", "instrument": "OPTIDX",
            "interval": 1, "expiryCode": valid_code, "expiryFlag": valid_type,
            "strike": str(strike), "drvOptionType": opt_type,
            "requiredData": ["open","high","low","close","volume"],
            "fromDate": TRADE_DATE, "toDate": NEXT_DATE
        })
        time.sleep(0.15)

        if not (r and "data" in r and pe_ce in r["data"] and r["data"][pe_ce] and r["data"][pe_ce].get("close")):
            continue

        raw  = r["data"][pe_ce]
        rows = [{"Datetime": f"{TRADE_DATE} {ts}",
                 "Open":   raw["open"][i],   "High": raw["high"][i],
                 "Low":    raw["low"][i],     "Close": raw["close"][i],
                 "Volume": raw.get("volume", [0]*len(raw["close"]))[i]}
                for i, ts in enumerate(timestamps) if i < len(raw.get("close",[]))]

        if rows:
            pd.DataFrame(rows).set_index("Datetime").to_csv(day_csv)
            fetched += 1

        pct = int((day_idx + 1) / len(missing) * 100)
        log(f"[{idx:>3}/{total}]    {TRADE_DATE}  {pct:3d}%  {name}")

    status = "✅ DONE" if fetched == len(missing) else ("⚠  PART" if fetched > 0 else "❌ FAIL")
    log(f"[{idx:>3}/{total}] {status}  {name}  ({fetched}/{len(missing)} days saved)")
    return {"name": name, "fetched": fetched, "missing": len(missing), "status": status}

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Bulk Dhan Options Downloader")
    parser.add_argument("--from", dest="start", default="2026-02-01",  help="Start date YYYY-MM-DD")
    parser.add_argument("--to",   dest="end",   default="2026-04-30",  help="End date   YYYY-MM-DD")
    parser.add_argument("--workers", type=int,  default=3,             help="Parallel workers (default 3)")
    args = parser.parse_args()

    instruments = load_instruments()
    total = len(instruments)
    print(f"\n{'='*60}")
    print(f"  Bulk Downloader — {total} instruments")
    print(f"  Range   : {args.start}  to  {args.end}")
    print(f"  Workers : {args.workers}  (parallel downloads)")
    print(f"{'='*60}\n")

    sem     = threading.Semaphore(args.workers)
    results = {}
    r_lock  = threading.Lock()

    def worker(inst, idx):
        with sem:
            try:
                res = download_instrument(inst, args.start, args.end, idx, total)
                if res:
                    with r_lock:
                        results[inst["dhan_name"]] = res
            except Exception as e:
                log(f"[{idx:>3}/{total}] ERROR {inst['dhan_name']}: {e}")
                with r_lock:
                    results[inst["dhan_name"]] = {"name": inst["dhan_name"], "fetched": 0, "missing": 0, "status": "❌ FAIL"}

    threads = []
    for i, inst in enumerate(instruments, 1):
        t = threading.Thread(target=worker, args=(inst, i))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    # ── Final Status Report ───────────────────────────────────────────────────
    done  = [r for r in results.values() if "DONE" in r["status"]]
    part  = [r for r in results.values() if "PART" in r["status"]]
    fail  = [r for r in results.values() if "FAIL" in r["status"]]
    skip  = total - len(results)

    print(f"\n{'='*60}")
    print(f"  FINAL REPORT")
    print(f"{'='*60}")
    print(f"  Total instruments : {total}")
    print(f"  ✅ Fully done     : {len(done)}")
    print(f"  ⚠  Partial        : {len(part)}")
    print(f"  ❌ Failed (0 days): {len(fail)}")
    print(f"  ⏩ Skipped (exist) : {skip}")

    if part:
        print(f"\n  --- Partial (some days missing) ---")
        for r in part:
            print(f"    {r['name']}  ({r['fetched']}/{r['missing']} days)")

    if fail:
        print(f"\n  --- Failed (no data from Dhan) ---")
        for r in fail:
            print(f"    {r['name']}")

    print(f"\n  Refresh dashboard to see updated green dots.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
