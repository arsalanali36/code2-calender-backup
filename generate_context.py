import os

files_backend = [
    "app.py",
    "requirements.txt",
    "Dockerfile",
    "Procfile",
    "render.yaml"
]

files_frontend = [
    "templates/index.html",
    "templates/gallery.html",
    "templates/modals.html",
    "static/css/style.css",
    "static/js/state.js",
    "static/js/data.js",
    "static/js/settings.js",
    "static/js/dashboard.js",
    "static/js/calendar.js",
    "static/js/table-render.js",
    "static/js/table-cols.js",
    "static/js/table-colops.js",
    "static/js/gallery-core.js",
    "static/js/gallery-nav.js",
    "static/js/gallery-tags.js",
    "static/js/gallery-data.js",
    "static/js/gallery-img-tags.js",
    "static/js/annotate-tools.js",
    "static/js/annotate-canvas.js",
    "static/js/io.js",
    "static/js/events.js"
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
    create_context("AI_CONTEXT_BACKEND.md", files_backend, "Backend Context")
    create_context("AI_CONTEXT_FRONTEND.md", files_frontend, "Frontend Context")
    print("Context files created successfully!")
