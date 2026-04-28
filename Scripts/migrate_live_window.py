"""
migrate_live_window.py
-----------------------
Live progress window for ImageKit migration.
Run directly:  python Scripts/migrate_live_window.py
"""
import json, os, sys, io, re, threading, time
import tkinter as tk
from tkinter import scrolledtext, ttk

IMAGEKIT_PRIVATE_KEY  = "private_QTnWn//AAVFGCCe3y3sY9upzX34="
IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/j3yawq0sst"
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRADES_FILE = os.path.join(BASE_DIR, "data", "trades_1.json")
BACKUP_FILE = TRADES_FILE + ".bak"
UPLOADS_DIR = os.path.join(BASE_DIR, "static", "uploads")


# ── GUI ───────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ImageKit Migration — Live Progress")
        self.geometry("820x560")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)

        # Header
        tk.Label(self, text="ImageKit Image Migration", font=("Segoe UI", 14, "bold"),
                 bg="#1e1e2e", fg="#cdd6f4").pack(pady=(12, 2))

        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self, variable=self.progress_var,
                                            maximum=100, length=760)
        self.progress_bar.pack(pady=(6, 2), padx=30)

        self.status_lbl = tk.Label(self, text="Ready", font=("Segoe UI", 9),
                                   bg="#1e1e2e", fg="#a6e3a1")
        self.status_lbl.pack()

        # Log box
        self.log = scrolledtext.ScrolledText(self, font=("Consolas", 9),
                                             bg="#181825", fg="#cdd6f4",
                                             insertbackground="white",
                                             relief="flat", borderwidth=0)
        self.log.pack(fill=tk.BOTH, expand=True, padx=14, pady=8)
        self.log.tag_config("ok",   foreground="#a6e3a1")
        self.log.tag_config("fail", foreground="#f38ba8")
        self.log.tag_config("info", foreground="#89b4fa")
        self.log.tag_config("warn", foreground="#fab387")

        # Buttons
        btn_frame = tk.Frame(self, bg="#1e1e2e")
        btn_frame.pack(pady=(0, 10))
        self.start_btn = tk.Button(btn_frame, text="  Start Migration  ",
                                   font=("Segoe UI", 10, "bold"),
                                   bg="#89b4fa", fg="#1e1e2e",
                                   relief="flat", padx=10, pady=4,
                                   command=self.start)
        self.start_btn.pack(side=tk.LEFT, padx=8)
        tk.Button(btn_frame, text="  Clear Log  ",
                  font=("Segoe UI", 10),
                  bg="#313244", fg="#cdd6f4",
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

    # ── Migration logic ───────────────────────────────────────────────────────

    def run_migration(self):
        self.log_line("Loading trades_1.json ...", "info")
        try:
            with open(TRADES_FILE, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            self.log_line(f"ERROR loading trades file: {e}", "fail")
            return

        # Backup
        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        self.log_line(f"Backup saved: {BACKUP_FILE}", "info")

        raw = json.dumps(data)
        local_urls = sorted(set(re.findall(r'/uploads/[^\"\\s,\\]]+', raw)))
        local_urls = [u for u in local_urls if '_trash' not in u]
        self._total = len(local_urls)
        self._done  = 0

        self.log_line(f"Found {self._total} unique local image URLs\n", "info")
        self.set_status(f"0 / {self._total} uploaded ...", "#89b4fa")

        try:
            sys.path.insert(0, BASE_DIR)
            from imagekitio import ImageKit
            ik = ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)
        except Exception as e:
            self.log_line(f"ImageKit init failed: {e}", "fail")
            return

        url_map = {}
        failed  = []

        for url in local_urls:
            rel  = url.lstrip('/')
            path = os.path.join(BASE_DIR, "static", rel)
            fname = os.path.basename(path)

            if not os.path.exists(path):
                self.log_line(f"SKIP (not local): {url}", "warn")
                self._done += 1
                self._update_bar()
                continue

            try:
                with open(path, "rb") as f:
                    data_bytes = f.read()
                result = ik.files.upload(
                    file=io.BytesIO(data_bytes),
                    file_name=fname,
                    folder="/trading_journal/",
                    use_unique_file_name=False,
                )
                new_url = f"{IMAGEKIT_URL_ENDPOINT}/trading_journal/{result.name}"
                url_map[url] = new_url
                self._done += 1
                self._update_bar()
                self.log_line(f"[{self._done}/{self._total}] OK  {fname}", "ok")
            except Exception as e:
                self.log_line(f"[{self._done+1}/{self._total}] FAIL {fname}: {e}", "fail")
                failed.append(url)
                self._done += 1
                self._update_bar()

        # Update JSON
        if url_map:
            self.log_line(f"\nUpdating trades_1.json ({len(url_map)} URLs) ...", "info")
            updated_raw = json.dumps(data)
            for old, new in url_map.items():
                updated_raw = updated_raw.replace(f'"{old}"', f'"{new}"')
            with open(TRADES_FILE, "w", encoding="utf-8") as f:
                f.write(updated_raw)
            self.log_line("trades_1.json saved!", "ok")

        summary = f"Done! Uploaded: {len(url_map)}  |  Skipped/Failed: {len(failed)}"
        self.log_line(f"\n{summary}", "info")
        self.set_status(summary, "#a6e3a1")
        self.start_btn.config(state=tk.NORMAL)

    def _update_bar(self):
        pct = (self._done / self._total * 100) if self._total else 0
        self.progress_var.set(pct)
        self.set_status(f"{self._done} / {self._total} uploaded  ({pct:.0f}%)", "#89b4fa")


if __name__ == "__main__":
    app = App()
    app.mainloop()
