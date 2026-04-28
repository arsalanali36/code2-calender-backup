"""
migrate_live_window.py  v3
---------------------------
Recovers Cloudinary URLs by:
  1. Matching filename from Cloudinary URL to local/GDrive/ZIP sources
  2. Uploading to ImageKit
  3. Replacing Cloudinary URL with ImageKit URL in trades_1.json

Run:  python Scripts/migrate_live_window.py
"""
import json, os, sys, io, re, threading, zipfile
import tkinter as tk
from tkinter import scrolledtext, ttk

IMAGEKIT_PRIVATE_KEY  = "private_QTnWn//AAVFGCCe3y3sY9upzX34="
IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/j3yawq0sst"
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRADES_FILE = os.path.join(BASE_DIR, "data", "trades_1.json")
BACKUP_FILE = TRADES_FILE + ".bak"

SOURCES = [
    ("GDrive",  "G:/My Drive/KHAZANA_BACKUP/uploads/",  "dir"),
    ("Local",   os.path.join(BASE_DIR, "static", "uploads"), "dir"),
    ("cc.zip",  "C:/Users/arsal/Downloads/OLD/cc.zip",  "zip"),
    ("BACK",    "C:/Users/arsal/Downloads/OLD/BACK.zip", "zip"),
    ("B1",      "C:/Users/arsal/Downloads/OLD/B1.zip",   "zip"),
    ("aa",      "C:/Users/arsal/Downloads/OLD/aa.zip",   "zip"),
    ("bkp.zip", os.path.join(BASE_DIR, "data", "backups",
                             "backup_20260401_094649.zip"), "zip"),
]


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ImageKit Migration v3 — Cloudinary Recovery")
        self.geometry("900x600")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)

        tk.Label(self, text="Cloudinary  ->  ImageKit  Recovery",
                 font=("Segoe UI", 14, "bold"),
                 bg="#1e1e2e", fg="#cdd6f4").pack(pady=(12, 2))

        self.progress_var = tk.DoubleVar()
        ttk.Progressbar(self, variable=self.progress_var,
                        maximum=100, length=840).pack(pady=(6,2), padx=30)

        self.status_lbl = tk.Label(self, text="Ready", font=("Segoe UI", 9),
                                   bg="#1e1e2e", fg="#a6e3a1")
        self.status_lbl.pack()

        self.log = scrolledtext.ScrolledText(self, font=("Consolas", 9),
                                             bg="#181825", fg="#cdd6f4",
                                             relief="flat", borderwidth=0)
        self.log.pack(fill=tk.BOTH, expand=True, padx=14, pady=8)
        for tag, color in [("ok","#a6e3a1"),("fail","#f38ba8"),
                           ("info","#89b4fa"),("warn","#fab387"),
                           ("skip","#6c7086")]:
            self.log.tag_config(tag, foreground=color)

        bf = tk.Frame(self, bg="#1e1e2e")
        bf.pack(pady=(0,10))
        self.start_btn = tk.Button(bf, text="  Start Recovery  ",
                                   font=("Segoe UI", 10, "bold"),
                                   bg="#89b4fa", fg="#1e1e2e",
                                   relief="flat", padx=10, pady=4,
                                   command=self.start)
        self.start_btn.pack(side=tk.LEFT, padx=8)
        tk.Button(bf, text="  Clear  ", font=("Segoe UI", 10),
                  bg="#313244", fg="#cdd6f4", relief="flat", padx=10, pady=4,
                  command=lambda: self.log.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=8)

        self._total = self._done = 0

    def log_line(self, text, tag=""):
        self.log.insert(tk.END, text + "\n", tag)
        self.log.see(tk.END)
        self.update_idletasks()

    def set_status(self, text, color="#a6e3a1"):
        self.status_lbl.config(text=text, fg=color)
        self.update_idletasks()

    def start(self):
        self.start_btn.config(state=tk.DISABLED)
        self.log.delete("1.0", tk.END)
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        sys.path.insert(0, BASE_DIR)
        try:
            from imagekitio import ImageKit
            ik = ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)
            self.log_line("ImageKit connected", "ok")
        except Exception as e:
            self.log_line(f"ImageKit failed: {e}", "fail")
            self.start_btn.config(state=tk.NORMAL)
            return

        # ── Load trades_1.json ─────────────────────────────────────────────────
        with open(TRADES_FILE, encoding="utf-8") as f:
            raw = f.read()
        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            f.write(raw)
        self.log_line(f"Backup saved: {BACKUP_FILE}", "info")

        # ── Build image index from all sources ─────────────────────────────────
        self.log_line("Scanning all image sources...", "info")
        img_index = {}   # filename -> (source_label, data_or_path)

        for label, path, kind in SOURCES:
            if kind == "dir":
                if not os.path.isdir(path):
                    self.log_line(f"  SKIP (not found): {label}", "warn")
                    continue
                count = 0
                for fname in os.listdir(path):
                    fp = os.path.join(path, fname)
                    if os.path.isfile(fp) and not fname.endswith(".meta") and "." in fname:
                        if fname not in img_index:
                            img_index[fname] = (label, fp)
                            count += 1
                self.log_line(f"  {label}: {count} images indexed", "info")
            else:  # zip
                if not os.path.exists(path):
                    continue
                count = 0
                try:
                    with zipfile.ZipFile(path) as zf:
                        for name in zf.namelist():
                            fname = os.path.basename(name)
                            if fname and "." in fname and not fname.endswith(".meta"):
                                if fname not in img_index:
                                    img_index[fname] = (label, (path, name))
                                    count += 1
                    self.log_line(f"  {label}: {count} images indexed", "info")
                except Exception as e:
                    self.log_line(f"  {label}: zip error {e}", "warn")

        self.log_line(f"Total indexed: {len(img_index)} images\n", "info")

        # ── Find all Cloudinary URLs still in JSON ─────────────────────────────
        cloudinary_urls = sorted(set(re.findall(
            r'https://res\.cloudinary\.com/duw7qd8zm/[^\"]+', raw)))
        self._total = len(cloudinary_urls)
        self._done  = 0
        self.log_line(f"Cloudinary URLs to process: {self._total}\n", "info")

        url_map  = {}   # old_cloudinary_url -> new_imagekit_url
        skipped  = 0

        for url in cloudinary_urls:
            # Extract filename from URL
            if "trading_journal/" in url:
                fname = url.split("trading_journal/")[-1].split("?")[0]
            else:
                fname = url.split("/")[-1].split("?")[0]

            # Already on ImageKit? (same filename was uploaded earlier)
            ik_url = f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/{fname}"
            if ik_url in raw:
                url_map[url] = ik_url
                skipped += 1
                self._done += 1
                self._update_bar()
                continue

            # Find file in index
            if fname not in img_index:
                self._done += 1
                self._update_bar()
                continue  # truly lost

            src_label, src_data = img_index[fname]

            # Read bytes
            try:
                if isinstance(src_data, str):  # file path
                    with open(src_data, "rb") as f:
                        img_bytes = f.read()
                else:  # (zip_path, zip_name)
                    with zipfile.ZipFile(src_data[0]) as zf:
                        img_bytes = zf.read(src_data[1])
            except Exception as e:
                self.log_line(f"READ FAIL {fname}: {e}", "fail")
                self._done += 1
                self._update_bar()
                continue

            # Upload to ImageKit
            try:
                result = ik.files.upload(
                    file=io.BytesIO(img_bytes),
                    file_name=fname,
                    folder="/trading_journal/",
                    use_unique_file_name=False,
                )
                new_url = f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/{result.name}"
                url_map[url] = new_url
                self._done += 1
                self._update_bar()
                self.log_line(
                    f"[{self._done}/{self._total}] OK ({src_label}): {fname}", "ok")
            except Exception as e:
                self.log_line(f"[{self._done+1}/{self._total}] FAIL {fname}: {e}", "fail")
                self._done += 1
                self._update_bar()

        # ── Update trades_1.json ───────────────────────────────────────────────
        if url_map:
            self.log_line(f"\nUpdating trades_1.json ({len(url_map)} URLs)...", "info")
            updated = raw
            for old, new in url_map.items():
                updated = updated.replace(f'"{old}"', f'"{new}"')
            with open(TRADES_FILE, "w", encoding="utf-8") as f:
                f.write(updated)
            self.log_line("trades_1.json saved!", "ok")

        recovered = len(url_map) - skipped
        summary = (f"Done!  Recovered: {recovered}  |"
                   f"  Already on IK: {skipped}  |"
                   f"  Lost: {self._total - len(url_map)}")
        self.log_line(f"\n{summary}", "info")
        self.set_status(summary, "#a6e3a1")
        self.start_btn.config(state=tk.NORMAL)

    def _update_bar(self):
        pct = (self._done / self._total * 100) if self._total else 0
        self.progress_var.set(pct)
        self.set_status(f"{self._done} / {self._total}  ({pct:.0f}%)", "#89b4fa")


if __name__ == "__main__":
    app = App()
    app.mainloop()
