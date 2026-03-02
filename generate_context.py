import os

# ── Backend ───────────────────────────────────────────────────────────────────
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

# ── HTML Templates ────────────────────────────────────────────────────────────
files_html_layout = [
    "templates/index.html",
    "templates/gallery.html",
]
files_html_modals = [
    "templates/modals.html",
]

# ── CSS ───────────────────────────────────────────────────────────────────────
files_css_base = [
    "static/css/style-base.css",
]
files_css_gallery_a = [
    "static/css/style-gallery-a.css",       # Gallery Modal + Annotation Toolbar + Obs Modal
]
files_css_gallery_b = [
    "static/css/style-gallery-b.css",       # Gallery V2 (thumbnails, tags, toolbar)
]
files_css_misc = [
    "static/css/style-misc.css",
]

# ── JS: State & IO ────────────────────────────────────────────────────────────
files_state_io = [
    "static/js/state.js",
    "static/js/io.js",
]
files_data = [
    "static/js/data.js",
]

# ── JS: Settings / Dashboard / Calendar ──────────────────────────────────────
files_calendar = [
    "static/js/calendar.js",
]
files_settings = [
    "static/js/settings.js",
]
files_dashboard_colops = [
    "static/js/dashboard.js",
    "static/js/table-colops.js",
]

# ── JS: Table ─────────────────────────────────────────────────────────────────
files_table_render = [
    "static/js/table-render.js",
]
files_table_cols = [
    "static/js/table-cols.js",
]

# ── JS: Gallery Core ──────────────────────────────────────────────────────────
files_gallery_render = [
    "static/js/gallery-render.js",
]
files_gallery_core_nav = [
    "static/js/gallery-open.js",
    "static/js/gallery-core.js",
    "static/js/gallery-nav.js",
]
files_gallery_layer_data = [
    "static/js/gallery-layer.js",
    "static/js/gallery-data.js",
]

# ── JS: Gallery Ops ───────────────────────────────────────────────────────────
files_gallery_image_ops = [
    "static/js/gallery-image-ops.js",
]
files_gallery_ops = [
    "static/js/gallery-ops.js",
]

# ── JS: Gallery Tags ──────────────────────────────────────────────────────────
files_gallery_tags = [
    "static/js/gallery-tags.js",
    "static/js/gallery-tags-filter.js",
]
files_gallery_img_tags = [
    "static/js/gallery-img-tags.js",
]

# ── JS: Annotation ────────────────────────────────────────────────────────────
files_annotate_canvas = [
    "static/js/annotate-canvas.js",
]
files_annotate_zoom_fabric = [
    "static/js/annotate-zoom.js",
    "static/js/annotate-fabric.js",
]
files_annotate_marquee = [
    "static/js/annotate-marquee.js",
    "static/js/annotate-tools.js",
]
files_annotate_ctx = [
    "static/js/annotate-ctx-menu.js",
    "static/js/annotate-lifecycle.js",
]

# ── JS: Events ────────────────────────────────────────────────────────────────
files_events_init = [
    "static/js/events.js",
    "static/js/events-keys.js",
]
files_events_ui_gallery = [
    "static/js/events-ui.js",
    "static/js/events-gallery.js",
]
files_events_settings = [
    "static/js/events-settings.js",
]


def create_context(out_file, files, title):
    with open(out_file, "w", encoding="utf-8") as out:
        out.write(f"# {title}\n")
        out.write("This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.\n\n")
        for filepath in files:
            filepath = filepath.replace("/", os.sep)
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                ext = filepath.split('.')[-1]
                out.write(f"\n## File: `{filepath}`\n")
                if ext in ['py', 'js', 'html', 'css', 'yaml', 'txt']:
                    out.write(f"```{ext}\n")
                else:
                    out.write(f"```\n")
                out.write(content)
                out.write(f"\n```\n")


if __name__ == "__main__":
    # Backend
    create_context("AI_CONTEXT_BACKEND_APP.md",          files_backend_app,         "Backend — App & Config (app.py / Dockerfile / Procfile / render.yaml)")
    create_context("AI_CONTEXT_BACKEND_PROCESSORS.md",   files_backend_processors,  "Backend — Data Processors")

    # HTML
    create_context("AI_CONTEXT_HTML_LAYOUT.md",          files_html_layout,         "HTML — Layout (index.html / gallery.html)")
    create_context("AI_CONTEXT_HTML_MODALS.md",          files_html_modals,         "HTML — Modals")

    # CSS
    create_context("AI_CONTEXT_CSS_BASE.md",             files_css_base,            "CSS — Base (reset / layout / dashboard / calendar / table)")
    create_context("AI_CONTEXT_CSS_GALLERY_A.md",        files_css_gallery_a,       "CSS — Gallery A (gallery modal / annotation toolbar / obs modal)")
    create_context("AI_CONTEXT_CSS_GALLERY_B.md",        files_css_gallery_b,       "CSS — Gallery B (GV2 thumbnails / tags / toolbar)")
    create_context("AI_CONTEXT_CSS_MISC.md",             files_css_misc,            "CSS — Misc (upload / settings / tags / toast / scrollbar)")

    # JS - State & IO
    create_context("AI_CONTEXT_JS_STATE_IO.md",          files_state_io,            "JS — State & IO (state.js / io.js)")
    create_context("AI_CONTEXT_JS_DATA.md",              files_data,                "JS — Data (data.js: loadTrades / saveTrades / sync)")

    # JS - Settings / Dashboard / Calendar
    create_context("AI_CONTEXT_JS_CALENDAR.md",          files_calendar,            "JS — Calendar")
    create_context("AI_CONTEXT_JS_SETTINGS.md",          files_settings,            "JS — Settings Panel")
    create_context("AI_CONTEXT_JS_DASHBOARD_COLOPS.md",  files_dashboard_colops,    "JS — Dashboard & Table Column Ops")

    # JS - Table
    create_context("AI_CONTEXT_JS_TABLE_RENDER.md",      files_table_render,        "JS — Table Rendering")
    create_context("AI_CONTEXT_JS_TABLE_COLS.md",        files_table_cols,          "JS — Table Columns (sort / resize / cell render / tag picker)")

    # JS - Gallery Core
    create_context("AI_CONTEXT_JS_GALLERY_RENDER.md",    files_gallery_render,      "JS — Gallery Render")
    create_context("AI_CONTEXT_JS_GALLERY_CORE_NAV.md",  files_gallery_core_nav,    "JS — Gallery Core & Nav (open / core / nav)")
    create_context("AI_CONTEXT_JS_GALLERY_LAYER_DATA.md",files_gallery_layer_data,  "JS — Gallery Layer & Data")

    # JS - Gallery Ops
    create_context("AI_CONTEXT_JS_GALLERY_IMAGE_OPS.md", files_gallery_image_ops,   "JS — Gallery Image Ops")
    create_context("AI_CONTEXT_JS_GALLERY_OPS.md",       files_gallery_ops,         "JS — Gallery Context Menu & Ops")

    # JS - Gallery Tags
    create_context("AI_CONTEXT_JS_GALLERY_TAGS.md",      files_gallery_tags,        "JS — Gallery Tags (tag cloud / filter)")
    create_context("AI_CONTEXT_JS_GALLERY_IMG_TAGS.md",  files_gallery_img_tags,    "JS — Gallery Image Tags")

    # JS - Annotation
    create_context("AI_CONTEXT_JS_ANNOTATE_CANVAS.md",   files_annotate_canvas,     "JS — Annotation Canvas")
    create_context("AI_CONTEXT_JS_ANNOTATE_ZOOM_FABRIC.md", files_annotate_zoom_fabric, "JS — Annotation Zoom/Pan & Fabric.js")
    create_context("AI_CONTEXT_JS_ANNOTATE_MARQUEE.md",  files_annotate_marquee,    "JS — Annotation Marquee & Tools")
    create_context("AI_CONTEXT_JS_ANNOTATE_CTX.md",      files_annotate_ctx,        "JS — Annotation Context Menu & Lifecycle")

    # JS - Events
    create_context("AI_CONTEXT_JS_EVENTS_INIT.md",       files_events_init,         "JS — Events Init & Keyboard (events.js / events-keys.js)")
    create_context("AI_CONTEXT_JS_EVENTS_UI_GALLERY.md", files_events_ui_gallery,   "JS — Events UI & Gallery handlers")
    create_context("AI_CONTEXT_JS_EVENTS_SETTINGS.md",   files_events_settings,     "JS — Events Settings Panel handlers")

    print("Context files created successfully!")
