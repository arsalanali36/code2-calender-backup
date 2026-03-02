import os

files_backend = [
    "app.py",
    "data_processors.py",
    "requirements.txt",
    "Dockerfile",
    "Procfile",
    "render.yaml"
]

# --- Frontend split into focused context files ---

files_frontend_html = [
    "templates/index.html",
    "templates/gallery.html",
    "templates/modals.html",
]

files_frontend_css_base = [
    "static/css/style-base.css",
]

files_frontend_css_gallery = [
    "static/css/style-gallery.css",
    "static/css/style-misc.css",
]

files_frontend_data = [
    "static/js/state.js",
    "static/js/data.js",
]

files_frontend_settings = [
    "static/js/settings.js",
    "static/js/dashboard.js",
    "static/js/calendar.js",
]

files_frontend_table = [
    "static/js/table-render.js",
    "static/js/table-cols.js",
    "static/js/table-colops.js",
]

files_frontend_gallery = [
    "static/js/gallery-open.js",
    "static/js/gallery-render.js",
    "static/js/gallery-core.js",
    "static/js/gallery-nav.js",
    "static/js/gallery-data.js",
]

files_frontend_gallery_ops = [
    "static/js/gallery-image-ops.js",
    "static/js/gallery-ops.js",
    "static/js/gallery-layer.js",
    "static/js/gallery-tags.js",
    "static/js/gallery-tags-filter.js",
    "static/js/gallery-img-tags.js",
]

files_frontend_annotate = [
    "static/js/annotate-zoom.js",
    "static/js/annotate-marquee.js",
    "static/js/annotate-tools.js",
    "static/js/annotate-canvas.js",
    "static/js/annotate-ctx-menu.js",
    "static/js/annotate-lifecycle.js",
    "static/js/annotate-fabric.js",
]

files_frontend_events = [
    "static/js/io.js",
    "static/js/events-keys.js",
    "static/js/events-ui.js",
    "static/js/events-gallery.js",
    "static/js/events-settings.js",
    "static/js/events.js",
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
    create_context("AI_CONTEXT_BACKEND.md",                files_backend,              "Backend Context")
    create_context("AI_CONTEXT_FRONTEND_HTML.md",          files_frontend_html,        "Frontend Context — HTML Templates")
    create_context("AI_CONTEXT_FRONTEND_CSS_BASE.md",      files_frontend_css_base,    "Frontend Context — CSS Base (reset / layout / dashboard / calendar / table)")
    create_context("AI_CONTEXT_FRONTEND_CSS_GALLERY.md",   files_frontend_css_gallery, "Frontend Context — CSS Gallery & Misc (gallery / annotation / settings / tags)")
    create_context("AI_CONTEXT_FRONTEND_DATA.md",          files_frontend_data,        "Frontend Context — State & Data")
    create_context("AI_CONTEXT_FRONTEND_SETTINGS.md",      files_frontend_settings,    "Frontend Context — Settings / Dashboard / Calendar")
    create_context("AI_CONTEXT_FRONTEND_TABLE.md",         files_frontend_table,       "Frontend Context — Table Rendering")
    create_context("AI_CONTEXT_FRONTEND_GALLERY.md",       files_frontend_gallery,     "Frontend Context — Gallery Core (open / render / nav / data)")
    create_context("AI_CONTEXT_FRONTEND_GALLERY_OPS.md",   files_frontend_gallery_ops, "Frontend Context — Gallery Ops (image-ops / context-menu / tags)")
    create_context("AI_CONTEXT_FRONTEND_ANNOTATE.md",      files_frontend_annotate,    "Frontend Context — Annotation (Fabric.js)")
    create_context("AI_CONTEXT_FRONTEND_EVENTS.md",        files_frontend_events,      "Frontend Context — IO & Events")
    print("Context files created successfully!")
