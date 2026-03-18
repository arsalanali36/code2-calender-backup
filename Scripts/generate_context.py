import argparse
import os
import re
import subprocess
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

# Backend
files_backend_app = [
    "app.py",
    "requirements.txt",
    "Dockerfile",
    "Procfile",
    "render.yaml",
]
files_backend_processors = [
    "data_processors.py",
]
files_memory_logs = [
    "CHANGELOG.md",
]
files_memory_history = [
    "Docs/Update_History.txt",
]

# HTML Templates
files_html_index = ["templates/index.html"]
files_html_gallery = ["templates/gallery.html"]
files_html_visual_dashboard = ["templates/visual_dashboard.html"]
files_html_modals = ["templates/modals.html"]

# CSS
files_css_base = ["static/css/style-base.css"]
files_css_gallery_a = ["static/css/style-gallery-a.css"]
files_css_gallery_b = ["static/css/style-gallery-b.css"]
files_css_misc = ["static/css/style-misc.css"]
files_css_trade = ["static/css/style-trade.css"]

# JS: State & IO
files_state_io = ["static/js/state.js", "static/js/io.js"]
files_data = ["static/js/data.js"]

# JS: Settings / Dashboard / Calendar
files_calendar = ["static/js/calendar.js"]
files_settings = ["static/js/settings.js"]
files_dashboard_colops = ["static/js/dashboard.js", "static/js/table-colops.js"]

# JS: Table
files_table_render = ["static/js/table-render.js"]
files_table_cols = ["static/js/table-cols.js"]

# JS: Gallery Core
files_gallery_render = ["static/js/gallery-render.js"]
files_gallery_stats_open = ["static/js/gallery-stats.js", "static/js/gallery-open.js"]
files_gallery_core_nav = ["static/js/gallery-core.js", "static/js/gallery-nav.js"]
files_gallery_layer = ["static/js/gallery-layer.js"]
files_gallery_data = ["static/js/gallery-data.js"]

# JS: Gallery Ops
files_gallery_image_ops = ["static/js/gallery-image-ops.js"]
files_gallery_image_ops_b = ["static/js/gallery-image-ops-b.js"]
files_gallery_ops = ["static/js/gallery-ops.js"]
files_gallery_ops_group = ["static/js/gallery-ops-group.js"]

# JS: Gallery Tags
files_gallery_tags = ["static/js/gallery-tags.js", "static/js/gallery-tags-filter.js"]
files_gallery_img_tags = ["static/js/gallery-img-tags.js"]

# JS: Annotation
files_annotate_canvas = ["static/js/annotate-canvas.js"]
files_annotate_zoom_fabric = ["static/js/annotate-zoom.js", "static/js/annotate-fabric.js"]
files_annotate_marquee = ["static/js/annotate-marquee.js", "static/js/annotate-tools.js"]
files_annotate_ctx = ["static/js/annotate-ctx-menu.js", "static/js/annotate-lifecycle.js"]

# JS: Trade Tools
files_trade_review = ["static/js/trade-review.js"]
files_trade_logger = ["static/js/trade-logger.js"]

# JS: Visual Dashboard
files_visual_dashboard_stats = ["static/js/visual-dashboard-stats.js"]
files_visual_dashboard = ["static/js/visual-dashboard.js"]

# JS: Events
files_events_init = ["static/js/events.js", "static/js/events-keys.js"]
files_events_ui = ["static/js/events-ui.js"]
files_events_gallery = ["static/js/events-gallery.js"]
files_events_settings = ["static/js/events-settings.js"]


def get_targets() -> List[Tuple[str, Sequence[str], str]]:
    return [
        ("AI_CONTEXT_BACKEND_APP.md", files_backend_app, "Backend - App and Config"),
        ("AI_CONTEXT_BACKEND_PROCESSORS.md", files_backend_processors, "Backend - Data Processors"),
        ("AI_CONTEXT_MEMORY_LOGS.md", files_memory_logs, "Memory Logs - Changelog"),
        ("AI_CONTEXT_MEMORY_HISTORY.md", files_memory_history, "Memory Logs - Update History"),
        ("AI_CONTEXT_HTML_INDEX.md", files_html_index, "HTML - Main Layout"),
        ("AI_CONTEXT_HTML_GALLERY.md", files_html_gallery, "HTML - Gallery Template"),
        ("AI_CONTEXT_HTML_VISUAL_DASHBOARD.md", files_html_visual_dashboard, "HTML - Visual Dashboard"),
        ("AI_CONTEXT_HTML_MODALS.md", files_html_modals, "HTML - Modals"),
        ("AI_CONTEXT_CSS_BASE.md", files_css_base, "CSS - Base"),
        ("AI_CONTEXT_CSS_GALLERY_A.md", files_css_gallery_a, "CSS - Gallery A"),
        ("AI_CONTEXT_CSS_GALLERY_B.md", files_css_gallery_b, "CSS - Gallery B"),
        ("AI_CONTEXT_CSS_MISC.md", files_css_misc, "CSS - Misc"),
        ("AI_CONTEXT_CSS_TRADE.md", files_css_trade, "CSS - Trade"),
        ("AI_CONTEXT_JS_STATE_IO.md", files_state_io, "JS - State and IO"),
        ("AI_CONTEXT_JS_DATA.md", files_data, "JS - Data"),
        ("AI_CONTEXT_JS_CALENDAR.md", files_calendar, "JS - Calendar"),
        ("AI_CONTEXT_JS_SETTINGS.md", files_settings, "JS - Settings"),
        ("AI_CONTEXT_JS_DASHBOARD_COLOPS.md", files_dashboard_colops, "JS - Dashboard and Table Column Ops"),
        ("AI_CONTEXT_JS_TABLE_RENDER.md", files_table_render, "JS - Table Rendering"),
        ("AI_CONTEXT_JS_TABLE_COLS.md", files_table_cols, "JS - Table Columns"),
        ("AI_CONTEXT_JS_GALLERY_RENDER.md", files_gallery_render, "JS - Gallery Render"),
        ("AI_CONTEXT_JS_GALLERY_STATS_OPEN.md", files_gallery_stats_open, "JS - Gallery Stats and Open"),
        ("AI_CONTEXT_JS_GALLERY_CORE_NAV.md", files_gallery_core_nav, "JS - Gallery Core and Nav"),
        ("AI_CONTEXT_JS_GALLERY_LAYER.md", files_gallery_layer, "JS - Gallery Layer"),
        ("AI_CONTEXT_JS_GALLERY_DATA.md", files_gallery_data, "JS - Gallery Data"),
        ("AI_CONTEXT_JS_GALLERY_IMAGE_OPS.md", files_gallery_image_ops, "JS - Gallery Image Ops"),
        ("AI_CONTEXT_JS_GALLERY_IMAGE_OPS_B.md", files_gallery_image_ops_b, "JS - Gallery Image Ops Batch"),
        ("AI_CONTEXT_JS_GALLERY_OPS.md", files_gallery_ops, "JS - Gallery Ops"),
        ("AI_CONTEXT_JS_GALLERY_OPS_GROUP.md", files_gallery_ops_group, "JS - Gallery Group Ops"),
        ("AI_CONTEXT_JS_GALLERY_TAGS.md", files_gallery_tags, "JS - Gallery Tags"),
        ("AI_CONTEXT_JS_GALLERY_IMG_TAGS.md", files_gallery_img_tags, "JS - Gallery Image Tags"),
        ("AI_CONTEXT_JS_ANNOTATE_CANVAS.md", files_annotate_canvas, "JS - Annotation Canvas"),
        ("AI_CONTEXT_JS_ANNOTATE_ZOOM_FABRIC.md", files_annotate_zoom_fabric, "JS - Annotation Zoom and Fabric"),
        ("AI_CONTEXT_JS_ANNOTATE_MARQUEE.md", files_annotate_marquee, "JS - Annotation Marquee and Tools"),
        ("AI_CONTEXT_JS_ANNOTATE_CTX.md", files_annotate_ctx, "JS - Annotation Context and Lifecycle"),
        ("AI_CONTEXT_JS_TRADE_REVIEW.md", files_trade_review, "JS - Trade Review"),
        ("AI_CONTEXT_JS_TRADE_LOGGER.md", files_trade_logger, "JS - Trade Logger"),
        ("AI_CONTEXT_JS_VISUAL_DASHBOARD_STATS.md", files_visual_dashboard_stats, "JS - Visual Dashboard Stats"),
        ("AI_CONTEXT_JS_VISUAL_DASHBOARD.md", files_visual_dashboard, "JS - Visual Dashboard"),
        ("AI_CONTEXT_JS_EVENTS_INIT.md", files_events_init, "JS - Events Init and Keyboard"),
        ("AI_CONTEXT_JS_EVENTS_UI.md", files_events_ui, "JS - Events UI"),
        ("AI_CONTEXT_JS_EVENTS_GALLERY.md", files_events_gallery, "JS - Events Gallery"),
        ("AI_CONTEXT_JS_EVENTS_SETTINGS.md", files_events_settings, "JS - Events Settings"),
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


def build_preview(content: str, max_lines: int, max_chars: int) -> Tuple[str, bool]:
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
            capture_output=True,
            text=True,
            check=True,
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
    out_dir: Path,
    out_file: str,
    files: Sequence[str],
    title: str,
    mode: str,
    max_lines: int,
    max_chars: int,
    output_suffix: str,
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
    parser.add_argument("--changed-only", action="store_true", help="Generate only contexts that include changed files from git status.")
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
            print(f"- {name}: {len(files)} source file(s)")
        return

    out_dir = Path(args.output_dir)
    for out_file, files, title in targets:
        create_context(
            out_dir=out_dir,
            out_file=out_file,
            files=files,
            title=title,
            mode=args.mode,
            max_lines=max(20, args.max_lines),
            max_chars=max(500, args.max_chars),
            output_suffix=args.output_suffix,
        )

    print(f"Context files created successfully ({args.mode} mode).")


if __name__ == "__main__":
    main()
