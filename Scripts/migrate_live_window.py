"""
migrate_live_window.py  v4
---------------------------
Upload ALL local images (not yet on ImageKit) to ImageKit.
Forget Cloudinary — use local backups as source of truth.
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
    ("GDrive",   "G:/My Drive/KHAZANA_BACKUP/uploads/",   "dir"),
    ("Local",    os.path.join(BASE_DIR, "static", "uploads"), "dir"),
    ("cc.zip",   "C:/Users/arsal/Downloads/OLD/cc.zip",   "zip"),
    ("BACK.zip", "C:/Users/arsal/Downloads/OLD/BACK.zip", "zip"),
    ("B1.zip",   "C:/Users/arsal/Downloads/OLD/B1.zip",   "zip"),
    ("aa.zip",   "C:/Users/arsal/Downloads/OLD/aa.zip",   "zip"),
    ("bkp.zip",  os.path.join(BASE_DIR, "data", "backups",
                              "backup_20260401_094649.zip"), "zip"),
]

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ImageKit — Upload All Local Images")
        self.geometry("900x600")
        self.configure(bg="#1e1e2e")
        self.resizable(True, True)

        tk.Label(self, text="Upload ALL Local Images -> ImageKit",
                 font=("Segoe UI", 14, "bold"),
                 bg="#1e1e2e", fg="#cdd6f4").pack(pady=(12, 2))

        self.progress_var = tk.DoubleVar()
        ttk.Progressbar(self, variable=self.progress_var,
                        maximum=100, length=840).pack(pady=(6, 2), padx=30)

        self.status_lbl = tk.Label(self, text="Ready", font=("Segoe UI", 9),
                                   bg="#1e1e2e", fg="#a6e3a1")
        self.status_lbl.pack()

        self.log = scrolledtext.ScrolledText(self, font=("Consolas", 9),
                                             bg="#181825", fg="#cdd6f4",
                                             relief="flat", borderwidth=0)
        self.log.pack(fill=tk.BOTH, expand=True, padx=14, pady=8)
        for tag, color in [("ok","#a6e3a1"),("fail","#f38ba8"),
                           ("info","#89b4fa"),("warn","#fab387"),("skip","#6c7086")]:
            self.log.tag_config(tag, foreground=color)

        bf = tk.Frame(self, bg="#1e1e2e")
        bf.pack(pady=(0, 10))
        self.start_btn = tk.Button(bf, text="  Start Upload  ",
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

        # ── Load current trades_1.json to know what's already on IK ───────────
        with open(TRADES_FILE, encoding="utf-8") as f:
            raw = f.read()
        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            f.write(raw)
        self.log_line("Backup saved", "info")

        already_on_ik = set(re.findall(
            r'https://ik\.imagekit\.io/j3yawq0sst/trading_journal/([^\"]+)', raw))
        self.log_line(f"Already on ImageKit: {len(already_on_ik)} images", "info")

        # ── Index all local sources ────────────────────────────────────────────
        self.log_line("Scanning sources...", "info")
        img_index = {}

        for label, path, kind in SOURCES:
            if kind == "dir":
                if not os.path.isdir(path): continue
                c = 0
                for fname in os.listdir(path):
                    fp = os.path.join(path, fname)
                    ext = os.path.splitext(fname)[1].lower()
                    if os.path.isfile(fp) and ext in IMAGE_EXTS and fname not in img_index:
                        img_index[fname] = (label, fp)
                        c += 1
                self.log_line(f"  {label}: {c} new", "info")
            else:
                if not os.path.exists(path): continue
                c = 0
                try:
                    with zipfile.ZipFile(path) as zf:
                        for name in zf.namelist():
                            fname = os.path.basename(name)
                            ext = os.path.splitext(fname)[1].lower()
                            if fname and ext in IMAGE_EXTS and fname not in img_index:
                                img_index[fname] = (label, (path, name))
                                c += 1
                except Exception as e:
                    self.log_line(f"  {label}: zip error — {e}", "warn")
                    continue
                self.log_line(f"  {label}: {c} new", "info")

        # Only upload what's NOT already on ImageKit
        to_upload = {f: v for f, v in img_index.items() if f not in already_on_ik}
        self._total = len(to_upload)
        self._done  = 0
        self.log_line(f"\nTo upload: {self._total} images\n", "info")
        self.set_status(f"0 / {self._total}", "#89b4fa")

        uploaded = 0
        failed   = 0

        for fname, (src_label, src_data) in to_upload.items():
            try:
                if isinstance(src_data, str):
                    with open(src_data, "rb") as f:
                        img_bytes = f.read()
                else:
                    with zipfile.ZipFile(src_data[0]) as zf:
                        img_bytes = zf.read(src_data[1])

                result = ik.files.upload(
                    file=io.BytesIO(img_bytes),
                    file_name=fname,
                    folder="/trading_journal/",
                    use_unique_file_name=False,
                )
                uploaded += 1
                self._done += 1
                self._update_bar()
                self.log_line(
                    f"[{self._done}/{self._total}] OK ({src_label}): {fname}", "ok")
            except Exception as e:
                failed += 1
                self._done += 1
                self._update_bar()
                self.log_line(f"[{self._done}/{self._total}] FAIL {fname}: {e}", "fail")

        summary = f"Done!  Uploaded: {uploaded}  |  Failed: {failed}  |  Already had: {len(already_on_ik)}"
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
