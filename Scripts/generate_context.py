import argparse
import os
import re
import subprocess
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

# ── Backend ───────────────────────────────────────────────────────────────────
files_backend_core = [
    "app.py", "config.py", "models.py", "extensions.py",
    "requirements.txt", "build.py", "render.yaml",
]
files_backend_processors = [
    "processors/data_processors.py",
]
files_backend_routes_core = [
    "routes/page_routes.py", "routes/trade_routes.py",
    "routes/image_routes.py", "routes/import_routes.py",
    "routes/export_routes.py",
]
files_backend_routes_features = [
    "routes/auth_routes.py", "routes/csvlog_routes.py", "routes/strategy_routes.py",
]
files_backend_whatif_routes = [
    "routes/whatif_routes.py",
]
files_backend_services_core = [
    "services/trade_service.py", "services/import_service.py",
    "services/export_service.py", "services/backup_service.py",
    "services/image_service.py", "services/page_service.py",
    "services/auth_service.py", "services/token_service.py",
]
files_backend_services_features = [
    "services/csvlog_service.py", "services/strategy_service.py",
    "services/strategy_data_service.py",
]
files_backend_services_whatif = [
    "services/whatif_service.py", "services/auto_sync_service.py",
]
files_backend_dhan = [
    "services/dhan_service_core.py", "services/dhan_service.py",
    "services/dhan_ohlc_service.py",
]
files_js_services = [
    "static/js/services/apiClient.js",
    "static/js/services/tradeService.js",
    "static/js/services/imageService.js",
    "static/js/services/importService.js",
    "static/js/services/exportService.js",
    "static/js/services/csvlogService.js",
]

# ── HTML Templates ─────────────────────────────────────────────────────────────
files_html_main = ["templates/index.html", "templates/modals.html"]
files_html_gallery = [
    "templates/gallery.html", "templates/gallery-modals.html",
    "templates/gallery-modals-b.html", "templates/gallery-sidebar.html",
]
files_html_features = [
    "templates/whatif.html", "templates/visual_dashboard.html",
    "templates/visual-dashboard-b.html", "templates/strategy_lab.html",
]
files_html_feature_modals_a = [
    "templates/modals-ohlc.html",
    "templates/modals-target-tracker.html",
]
files_html_feature_modals_b = [
    "templates/modals-target-tracker-b.html",
    "templates/strategy-lab-modals.html", "templates/strategy-lab-sidebar.html",
]
files_html_misc = [
    "templates/updates.html", "templates/login.html",
    "templates/register.html", "templates/reset_password.html",
]
files_html_classic = [
    "templates/gallery-classic.html", "templates/gallery_classic_page.html",
]

# ── CSS ────────────────────────────────────────────────────────────────────────
files_css_base = ["static/css/style-base.css"]
files_css_trade = [
    "static/css/style-trade.css", "static/css/style-trade-sidebar.css",
    "static/css/style-misc.css", "static/css/style-misc-tags.css",
]
files_css_gallery = [
    "static/css/style-gallery-a.css", "static/css/style-gallery-b.css",
    "static/css/style-gallery-c.css", "static/css/style-gallery-d.css",
    "static/css/style-gallery-split.css",
]
files_css_gallery_extra = [
    "static/css/style-gallery-classic.css", "static/css/style-gallery-grid.css",
]
files_css_features_a = [
    "static/css/style-csvlog.css", "static/css/style-csvlog-charts.css",
    "static/css/style-strategy-lab.css", "static/css/style-fullscreen.css",
]
files_css_features_b = [
    "static/css/style-ohlc-manager.css", "static/css/style-mobile.css",
    "static/css/style-whatif.css",
]

# ── JS: Core ──────────────────────────────────────────────────────────────────
files_js_core = ["static/js/state.js", "static/js/data.js", "static/js/data-utils.js"]
files_js_io = ["static/js/io.js"]
files_js_ui = [
    "static/js/calendar.js", "static/js/calendar-obs.js",
    "static/js/dashboard.js", "static/js/settings.js",
]
files_js_table = [
    "static/js/table-render.js", "static/js/table-cols.js", "static/js/table-colops.js",
]

# ── JS: Gallery ───────────────────────────────────────────────────────────────
files_js_gallery_core = [
    "static/js/gallery-core.js", "static/js/gallery-nav.js",
    "static/js/gallery-render.js", "static/js/gallery-open.js",
    "static/js/gallery-sync.js",
]
files_js_gallery_data = [
    "static/js/gallery-data.js",
]
files_js_gallery_render = [
    "static/js/gallery-render-tray.js",
    "static/js/gallery-render-thumbs.js", "static/js/gallery-render-thumbs-b.js",
    "static/js/gallery-grid.js",
]
files_js_gallery_ops = [
    "static/js/gallery-ops.js", "static/js/gallery-ops-group.js",
    "static/js/gallery-image-ops.js",
]
files_js_gallery_ops_b = [
    "static/js/gallery-image-ops-b.js", "static/js/gallery-image-manager.js",
]
files_js_gallery_media = [
    "static/js/gallery-audio.js", "static/js/gallery-video.js",
    "static/js/gallery-chart.js",
]
files_js_gallery_media_b = [
    "static/js/gallery-pnl-calendar.js",
    "static/js/gallery-layer.js", "static/js/gallery-rubberband.js",
]
files_js_gallery_tags = [
    "static/js/gallery-tags.js", "static/js/gallery-tags-b.js",
    "static/js/gallery-tags-filter.js", "static/js/gallery-img-tags.js",
]
files_js_gallery_features = [
    "static/js/gallery-stats.js", "static/js/gallery-stats-b.js",
    "static/js/gallery-split-view.js", "static/js/gallery-ref-cards.js",
]
files_js_gallery_classic = [
    "static/js/gallery-render-classic.js", "static/js/gallery-ops-classic.js",
    "static/js/gallery-core-classic.js", "static/js/gallery-open-classic.js",
    "static/js/gallery-rubberband-classic.js",
]

# ── JS: Annotation ────────────────────────────────────────────────────────────
files_js_annotate_core = [
    "static/js/annotate-canvas.js", "static/js/annotate-zoom.js",
    "static/js/annotate-fabric.js",
]
files_js_annotate_tools = [
    "static/js/annotate-marquee.js", "static/js/annotate-tools.js",
    "static/js/annotate-ctx-menu.js", "static/js/annotate-lifecycle.js",
]

# ── JS: Events ────────────────────────────────────────────────────────────────
files_js_events = [
    "static/js/events.js", "static/js/events-keys.js",
    "static/js/events-ui.js", "static/js/events-settings.js",
]
files_js_events_gallery = [
    "static/js/events-gallery.js", "static/js/events-gallery-b.js",
    "static/js/events-gallery-c.js", "static/js/events-gallery-d.js",
]

# ── JS: Features ──────────────────────────────────────────────────────────────
files_js_csvlog_core = [
    "static/js/csvlog.js", "static/js/csvlog-day.js",
    "static/js/csvlog-fields.js",
]
files_js_csvlog_charts = [
    "static/js/csvlog-charts.js", "static/js/csvlog-charts-b.js",
    "static/js/csvlog-vitals.js", "static/js/csvlog-img.js",
    "static/js/csvlog-placeholder.js",
]
files_js_strategy = [
    "static/js/strategy-lab-a.js", "static/js/strategy-lab-b.js",
    "static/js/strategy-lab-c.js",
]
files_js_target_tracker = [
    "static/js/target-tracker.js", "static/js/target-tracker-monthly.js",
]
files_js_target_tracker_b = [
    "static/js/target-tracker-weekly.js", "static/js/target-tracker-data.js",
    "static/js/target-tracker-init.js",
]
files_js_trade_tools = [
    "static/js/trade-review.js", "static/js/trade-sidebar.js",
    "static/js/trade-logger-core.js", "static/js/trade-logger-render.js",
    "static/js/tag-pins.js",
]
files_js_visual_dashboard = [
    "static/js/visual-dashboard.js", "static/js/visual-dashboard-init.js",
    "static/js/visual-dashboard-mtm.js", "static/js/visual-dashboard-stats.js",
]
files_js_misc_features = [
    "static/js/quick-stats.js", "static/js/quotes.js",
    "static/js/ohlc-manager.js",
]
files_js_viewers = [
    "static/js/fullscreen-viewer.js",
    "static/js/pdf-handler.js", "static/js/pdf-handler-b.js",
]
files_js_whatif = [
    "static/js/whatif-ui.js", "static/js/whatif-ui-b.js",
]


def get_targets() -> List[Tuple[str, Sequence[str], str]]:
    return [
        # ── Backend ──────────────────────────────────────────────────────────
        ("AI_CONTEXT_BACKEND_CORE.md",              files_backend_core,              "Backend - App, Config, Build"),
        ("AI_CONTEXT_BACKEND_PROCESSORS.md",         files_backend_processors,        "Backend - Data Processors"),
        ("AI_CONTEXT_BACKEND_ROUTES_CORE.md",        files_backend_routes_core,       "Backend - Core Routes (page, trade, image, import, export)"),
        ("AI_CONTEXT_BACKEND_ROUTES_FEATURES.md",    files_backend_routes_features,   "Backend - Feature Routes (auth, csvlog, strategy)"),
        ("AI_CONTEXT_BACKEND_WHATIF_ROUTES.md",      files_backend_whatif_routes,     "Backend - Whatif Routes"),
        ("AI_CONTEXT_BACKEND_SERVICES_CORE.md",      files_backend_services_core,     "Backend - Core Services"),
        ("AI_CONTEXT_BACKEND_SERVICES_FEATURES.md",  files_backend_services_features, "Backend - Feature Services (csvlog, strategy)"),
        ("AI_CONTEXT_BACKEND_SERVICES_WHATIF.md",    files_backend_services_whatif,   "Backend - Whatif + AutoSync Services"),
        ("AI_CONTEXT_BACKEND_DHAN.md",               files_backend_dhan,              "Backend - Dhan Integration Services"),
        ("AI_CONTEXT_JS_SERVICES.md",                files_js_services,               "JS - Frontend Service Layer (static/js/services/)"),
        # ── HTML ─────────────────────────────────────────────────────────────
        ("AI_CONTEXT_HTML_MAIN.md",                  files_html_main,                 "HTML - Main Index + Modals"),
        ("AI_CONTEXT_HTML_GALLERY.md",               files_html_gallery,              "HTML - Gallery Templates"),
        ("AI_CONTEXT_HTML_FEATURES.md",              files_html_features,             "HTML - Feature Pages"),
        ("AI_CONTEXT_HTML_FEATURE_MODALS_A.md",      files_html_feature_modals_a,     "HTML - Feature Modals A (ohlc, target-tracker)"),
        ("AI_CONTEXT_HTML_FEATURE_MODALS_B.md",      files_html_feature_modals_b,     "HTML - Feature Modals B (strategy-lab)"),
        ("AI_CONTEXT_HTML_MISC.md",                  files_html_misc,                 "HTML - Misc (updates, auth)"),
        ("AI_CONTEXT_HTML_CLASSIC.md",               files_html_classic,              "HTML - Classic Gallery Page"),
        # ── CSS ──────────────────────────────────────────────────────────────
        ("AI_CONTEXT_CSS_BASE.md",                   files_css_base,                  "CSS - Base Styles"),
        ("AI_CONTEXT_CSS_TRADE.md",                  files_css_trade,                 "CSS - Trade Table and Misc"),
        ("AI_CONTEXT_CSS_GALLERY.md",                files_css_gallery,               "CSS - Gallery (a/b/c/d/split)"),
        ("AI_CONTEXT_CSS_GALLERY_EXTRA.md",          files_css_gallery_extra,         "CSS - Gallery Classic + Grid"),
        ("AI_CONTEXT_CSS_FEATURES_A.md",             files_css_features_a,            "CSS - Feature Styles A (csvlog, strategy, fullscreen)"),
        ("AI_CONTEXT_CSS_FEATURES_B.md",             files_css_features_b,            "CSS - Feature Styles B (ohlc, mobile, whatif)"),
        # ── JS Core ──────────────────────────────────────────────────────────
        ("AI_CONTEXT_JS_CORE.md",                    files_js_core,                   "JS - Core State + Data"),
        ("AI_CONTEXT_JS_IO.md",                      files_js_io,                     "JS - IO (upload/import/export)"),
        ("AI_CONTEXT_JS_UI.md",                      files_js_ui,                     "JS - UI (calendar, dashboard, settings)"),
        ("AI_CONTEXT_JS_TABLE.md",                   files_js_table,                  "JS - Table Render + Cols + ColOps"),
        # ── JS Gallery ───────────────────────────────────────────────────────
        ("AI_CONTEXT_JS_GALLERY_CORE.md",            files_js_gallery_core,           "JS - Gallery Core + Nav + Render + Open"),
        ("AI_CONTEXT_JS_GALLERY_DATA.md",            files_js_gallery_data,           "JS - Gallery Data (pack/unpack/autoSave)"),
        ("AI_CONTEXT_JS_GALLERY_RENDER.md",          files_js_gallery_render,         "JS - Gallery Render (tray, thumbs, grid)"),
        ("AI_CONTEXT_JS_GALLERY_OPS.md",             files_js_gallery_ops,            "JS - Gallery Ops (ops, ops-group, image-ops)"),
        ("AI_CONTEXT_JS_GALLERY_OPS_B.md",           files_js_gallery_ops_b,          "JS - Gallery Ops B (image-ops-b, image-manager)"),
        ("AI_CONTEXT_JS_GALLERY_MEDIA.md",           files_js_gallery_media,          "JS - Gallery Media (audio, video, chart)"),
        ("AI_CONTEXT_JS_GALLERY_MEDIA_B.md",         files_js_gallery_media_b,        "JS - Gallery Media B (pnl-calendar, layer, rubberband)"),
        ("AI_CONTEXT_JS_GALLERY_TAGS.md",            files_js_gallery_tags,           "JS - Gallery Tags + Image Tags"),
        ("AI_CONTEXT_JS_GALLERY_FEATURES.md",        files_js_gallery_features,       "JS - Gallery Features (stats, split-view, ref-cards)"),
        ("AI_CONTEXT_JS_GALLERY_CLASSIC.md",         files_js_gallery_classic,        "JS - Classic Gallery (legacy /gallery-classic page)"),
        # ── JS Annotation ────────────────────────────────────────────────────
        ("AI_CONTEXT_JS_ANNOTATE_CORE.md",           files_js_annotate_core,          "JS - Annotation Core (canvas, zoom, fabric)"),
        ("AI_CONTEXT_JS_ANNOTATE_TOOLS.md",          files_js_annotate_tools,         "JS - Annotation Tools (marquee, tools, ctx-menu, lifecycle)"),
        # ── JS Events ────────────────────────────────────────────────────────
        ("AI_CONTEXT_JS_EVENTS.md",                  files_js_events,                 "JS - Events (init, keys, ui, settings)"),
        ("AI_CONTEXT_JS_EVENTS_GALLERY.md",          files_js_events_gallery,         "JS - Events Gallery (a/b/c/d)"),
        # ── JS Features ──────────────────────────────────────────────────────
        ("AI_CONTEXT_JS_CSVLOG_CORE.md",             files_js_csvlog_core,            "JS - CsvLog Core (modal, day, fields)"),
        ("AI_CONTEXT_JS_CSVLOG_CHARTS.md",           files_js_csvlog_charts,          "JS - CsvLog Charts + Media"),
        ("AI_CONTEXT_JS_STRATEGY.md",                files_js_strategy,               "JS - Strategy Lab"),
        ("AI_CONTEXT_JS_TARGET_TRACKER.md",          files_js_target_tracker,         "JS - Target Tracker (main + monthly)"),
        ("AI_CONTEXT_JS_TARGET_TRACKER_B.md",        files_js_target_tracker_b,       "JS - Target Tracker B (weekly, data, init)"),
        ("AI_CONTEXT_JS_TRADE_TOOLS.md",             files_js_trade_tools,            "JS - Trade Tools (review, sidebar, logger, tag-pins)"),
        ("AI_CONTEXT_JS_VISUAL_DASHBOARD.md",        files_js_visual_dashboard,       "JS - Visual Dashboard"),
        ("AI_CONTEXT_JS_MISC_FEATURES.md",           files_js_misc_features,          "JS - Misc (quick-stats, quotes, ohlc-manager)"),
        ("AI_CONTEXT_JS_VIEWERS.md",                 files_js_viewers,                "JS - Viewers (fullscreen, pdf-handler)"),
        ("AI_CONTEXT_JS_WHATIF.md",                  files_js_whatif,                 "JS - What-If UI"),
    ]


def normalize(path: str) -> str:
    return path.replace("\\", "/")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_symbols(content: str, ext: str, limit: int = 40) -> List[str]:
    if ext == "py":
        pattern = re.compile(r"^\s*(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE)
    elif ext in {"js", "ts", "tsx"}:
        pattern = re.compile(
            r"^\s*(?:function\s+([A-Za-z_$][A-Za-z0-9_$]*)|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*=>|function)|let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*=>|function)|class\s+([A-Za-z_$][A-Za-z0-9_$]*))",
            re.MULTILINE,
        )
    else:
        return []

    names: List[str] = []
    for match in pattern.finditer(content):
        groups = [g for g in match.groups() if g]
        if not groups:
            continue
        name = groups[0]
        if name not in names:
            names.append(name)
        if len(names) >= limit:
            break
    return names


def build_preview(content: str, max_lines: int, max_chars: int):
    lines = content.splitlines()
    clipped_by_lines = len(lines) > max_lines
    preview = "\n".join(lines[:max_lines])
    clipped_by_chars = len(preview) > max_chars
    if clipped_by_chars:
        preview = preview[:max_chars]
    clipped = clipped_by_lines or clipped_by_chars
    return preview, clipped


def write_full_context(out, file_path: str, ext: str, content: str) -> None:
    out.write(f"\n## File: `{file_path}`\n")
    fence = ext if ext in {"py", "js", "html", "css", "yaml", "txt", "json"} else ""
    out.write(f"```{fence}\n")
    out.write(content)
    out.write("\n```\n")


def write_compact_context(out, file_path: str, ext: str, content: str, max_lines: int, max_chars: int) -> None:
    total_lines = len(content.splitlines())
    total_chars = len(content)
    symbols = extract_symbols(content, ext)
    preview, clipped = build_preview(content, max_lines=max_lines, max_chars=max_chars)

    out.write(f"\n## File: `{file_path}`\n")
    out.write(f"- Stats: {total_lines} lines, {total_chars} chars\n")
    if symbols:
        out.write(f"- Symbols: {', '.join(symbols[:20])}\n")
    else:
        out.write("- Symbols: n/a\n")

    fence = ext if ext in {"py", "js", "html", "css", "yaml", "txt", "json"} else ""
    out.write("\n### Preview\n")
    out.write(f"```{fence}\n")
    out.write(preview)
    if clipped:
        out.write("\n\n# ...truncated for compact mode\n")
    out.write("\n```\n")


def get_changed_files_from_git() -> List[str]:
    try:
        result = subprocess.run(
            ["git", "-c", "core.quotepath=off", "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
    except Exception:
        return []

    changed: List[str] = []
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        path = normalize(path.strip())
        if path:
            changed.append(path)
    return changed


def filter_targets_to_changed(
    targets: Iterable[Tuple[str, Sequence[str], str]],
    changed_files: Sequence[str],
) -> List[Tuple[str, List[str], str]]:
    changed_set = set(changed_files)
    filtered: List[Tuple[str, List[str], str]] = []
    for out_file, files, title in targets:
        matched = [p for p in files if normalize(p) in changed_set]
        if matched:
            filtered.append((out_file, matched, title))
    return filtered


def create_context(
    out_dir: Path, out_file: str, files: Sequence[str], title: str,
    mode: str, max_lines: int, max_chars: int, output_suffix: str,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_name = out_file.replace(".md", f"{output_suffix}.md") if output_suffix else out_file
    out_path = out_dir / out_name

    with out_path.open("w", encoding="utf-8") as out:
        out.write(f"# {title}\n")
        if mode == "full":
            out.write("Consolidated code context for AI assistants.\n")
        else:
            out.write("Compact AI context: metadata + symbols + truncated preview.\n")
        out.write("\n")

        for filepath in files:
            file_path = Path(filepath)
            if not file_path.exists():
                out.write(f"\n## File: `{filepath}`\n")
                out.write("- Missing from workspace\n")
                continue

            content = read_text(file_path)
            ext = file_path.suffix.lower().lstrip(".")
            if mode == "full":
                write_full_context(out, filepath, ext, content)
            else:
                write_compact_context(out, filepath, ext, content, max_lines=max_lines, max_chars=max_chars)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate AI context markdown files.")
    parser.add_argument("--mode", choices=["full", "compact"], default="full", help="Context density mode.")
    parser.add_argument("--output-dir", default="Docs/AI_Contexts", help="Destination folder for context files.")
    parser.add_argument("--output-suffix", default="", help="Optional suffix appended before .md")
    parser.add_argument("--max-lines", type=int, default=140, help="Compact mode line cap per file preview.")
    parser.add_argument("--max-chars", type=int, default=7000, help="Compact mode char cap per file preview.")
    parser.add_argument("--changed-only", action="store_true", help="Generate only contexts for changed files.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned files without writing output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    targets = get_targets()

    if args.changed_only:
        changed = get_changed_files_from_git()
        targets = filter_targets_to_changed(targets, changed)
        if not targets:
            print("No changed files matched configured context groups.")
            return

    if args.dry_run:
        print(f"Mode: {args.mode}")
        print(f"Output dir: {args.output_dir}")
        for out_file, files, _title in targets:
            name = out_file.replace(".md", f"{args.output_suffix}.md") if args.output_suffix else out_file
            print(f"  - {name}: {len(files)} source file(s)")
        return

    out_dir = Path(args.output_dir)
    for out_file, files, title in targets:
        create_context(
            out_dir=out_dir, out_file=out_file, files=files, title=title,
            mode=args.mode, max_lines=max(20, args.max_lines),
            max_chars=max(500, args.max_chars), output_suffix=args.output_suffix,
        )

    print(f"Context files created successfully ({args.mode} mode).")


if __name__ == "__main__":
    main()
