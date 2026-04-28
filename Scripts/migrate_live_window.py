"""
migrate_live_window.py
-----------------------
Live progress window — uploads images from ZIP backup to ImageKit
and updates trades_1.json URLs.
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
UPLOADS_DIR = os.path.join(BASE_DIR, "static", "uploads")
ZIP_BACKUP  = os.path.join(BASE_DIR, "data", "backups", "backup_20260401_094649.zip")


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ImageKit Migration — Live Progress")
        self.geometry("860x580")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)

        tk.Label(self, text="ImageKit Image Migration", font=("Segoe UI", 14, "bold"),
                 bg="#1e1e2e", fg="#cdd6f4").pack(pady=(12, 2))

        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self, variable=self.progress_var,
                                            maximum=100, length=800)
        self.progress_bar.pack(pady=(6, 2), padx=30)

        self.status_lbl = tk.Label(self, text="Ready — click Start", font=("Segoe UI", 9),
                                   bg="#1e1e2e", fg="#a6e3a1")
        self.status_lbl.pack()

        self.log = scrolledtext.ScrolledText(self, font=("Consolas", 9),
                                             bg="#181825", fg="#cdd6f4",
                                             insertbackground="white",
                                             relief="flat", borderwidth=0)
        self.log.pack(fill=tk.BOTH, expand=True, padx=14, pady=8)
        self.log.tag_config("ok",   foreground="#a6e3a1")
        self.log.tag_config("fail", foreground="#f38ba8")
        self.log.tag_config("info", foreground="#89b4fa")
        self.log.tag_config("warn", foreground="#fab387")
        self.log.tag_config("skip", foreground="#6c7086")

        btn_frame = tk.Frame(self, bg="#1e1e2e")
        btn_frame.pack(pady=(0, 10))
        self.start_btn = tk.Button(btn_frame, text="  Start Migration  ",
                                   font=("Segoe UI", 10, "bold"),
                                   bg="#89b4fa", fg="#1e1e2e",
                                   relief="flat", padx=10, pady=4,
                                   command=self.start)
        self.start_btn.pack(side=tk.LEFT, padx=8)
        tk.Button(btn_frame, text="  Clear Log  ",
                  font=("Segoe UI", 10), bg="#313244", fg="#cdd6f4",
                  relief="flat", padx=10, pady=4,
                  command=lambda: self.log.delete("1.0", tk.END)).pack(side=tk.LEFT, padx=8)

        self._total = 0
        self._done  = 0

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
        threading.Thread(target=self.run_migration, daemon=True).start()

    def run_migration(self):
        sys.path.insert(0, BASE_DIR)

        # ── Load ImageKit ──────────────────────────────────────────────────────
        try:
            from imagekitio import ImageKit
            ik = ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)
            self.log_line("ImageKit connected OK", "ok")
        except Exception as e:
            self.log_line(f"ImageKit init failed: {e}", "fail")
            self.start_btn.config(state=tk.NORMAL)
            return

        # ── Load trades_1.json ─────────────────────────────────────────────────
        self.log_line("Loading trades_1.json ...", "info")
        try:
            with open(TRADES_FILE, encoding="utf-8") as f:
                raw = f.read()
            data = json.loads(raw)
        except Exception as e:
            self.log_line(f"ERROR: {e}", "fail")
            self.start_btn.config(state=tk.NORMAL)
            return

        # Backup
        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            f.write(raw)
        self.log_line(f"Backup saved: {BACKUP_FILE}", "info")

        # ── Find all /uploads/ URLs still in JSON ──────────────────────────────
        local_urls = sorted(set(re.findall(r'/uploads/[^\"\\s,\]]+', raw)))
        local_urls = [u for u in local_urls if '_trash' not in u]
        self.log_line(f"Found {len(local_urls)} unique /uploads/ URLs to migrate", "info")

        # ── Build image source map: filename -> bytes ──────────────────────────
        # Priority: local disk first, then ZIP backup
        self.log_line(f"Reading ZIP backup: {os.path.basename(ZIP_BACKUP)} ...", "info")
        zip_images = {}
        try:
            with zipfile.ZipFile(ZIP_BACKUP) as zf:
                for name in zf.namelist():
                    if any(name.lower().endswith(ext) for ext in ['.jpg','.jpeg','.png','.webp','.gif','.bmp']):
                        fname = os.path.basename(name)
                        if fname:
                            zip_images[fname] = zf.read(name)
            self.log_line(f"ZIP has {len(zip_images)} images", "ok")
        except Exception as e:
            self.log_line(f"ZIP read error: {e}", "warn")

        self._total = len(local_urls)
        self._done  = 0
        url_map = {}
        failed  = []
        skipped = 0

        self.set_status(f"0 / {self._total} ...", "#89b4fa")

        for url in local_urls:
            fname = os.path.basename(url.split('?')[0])
            img_bytes = None

            # 1. Try local disk
            local_path = os.path.join(BASE_DIR, "static", url.lstrip('/'))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    img_bytes = f.read()
                src = "disk"
            # 2. Try ZIP backup
            elif fname in zip_images:
                img_bytes = zip_images[fname]
                src = "zip"
            else:
                self.log_line(f"  SKIP (not found): {fname}", "skip")
                skipped += 1
                self._done += 1
                self._update_bar()
                continue

            # Check if already an ImageKit URL (already migrated)
            if url_map.get(url, '').startswith('https://ik.imagekit.io'):
                self._done += 1
                self._update_bar()
                continue

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
                self.log_line(f"[{self._done}/{self._total}] OK ({src}): {fname}", "ok")
            except Exception as e:
                self.log_line(f"[{self._done+1}/{self._total}] FAIL: {fname} -> {e}", "fail")
                failed.append(url)
                self._done += 1
                self._update_bar()

        # ── Update trades_1.json ───────────────────────────────────────────────
        if url_map:
            self.log_line(f"\nUpdating trades_1.json ({len(url_map)} URLs) ...", "info")
            updated = raw
            for old, new in url_map.items():
                updated = updated.replace(f'"{old}"', f'"{new}"')
            with open(TRADES_FILE, "w", encoding="utf-8") as f:
                f.write(updated)
            self.log_line("trades_1.json saved!", "ok")
        else:
            self.log_line("Nothing uploaded — trades_1.json unchanged.", "warn")

        summary = (f"Done!  Uploaded: {len(url_map)}  |"
                   f"  Skipped(missing): {skipped}  |  Failed: {len(failed)}")
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
