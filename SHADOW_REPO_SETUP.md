# Shadow Repo Setup (Token Optimization)

This setup creates a lightweight working copy for Claude/Gemini/ChatGPT so they only ingest high-signal code files.

## Why
- Reduces token usage by excluding screenshots, videos, backups, and dependency trees.
- Speeds up model reasoning by limiting project surface area.
- Keeps your main repo unchanged.

## One-command build
From project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\build_shadow_repo.ps1
```

Optional: include live trade data snapshot

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\build_shadow_repo.ps1 -IncludeData
```

Default output folder:
- `_shadow_repo`

## Included in shadow repo
- `app.py`
- `data_processors.py`
- `requirements.txt`
- `README.md`
- `.gitignore`
- `templates/`
- `static/js/`
- `static/css/`
- `Scripts/`
- `Docs/AI_Contexts/`

## Excluded by design
- `static/dev-blog-images/`
- `VIDEO NOTES/`
- `node_modules/`
- `data/backups/`
- `YE DEKHIYE/`
- `.git/`

## Recommended context workflow
1. Regenerate compact context before AI session:

```powershell
python .\Scripts\generate_context.py --mode compact --output-suffix _COMPACT
```

2. For quick iterative sessions (changed files only):

```powershell
python .\Scripts\generate_context.py --mode compact --changed-only --output-suffix _COMPACT
```

3. Ask Claude/Gemini to read only compact files first:
- `Docs/AI_Contexts/*_COMPACT.md`

4. Share full source file only when editing that exact file.

## Prompt guardrail (copy paste)
Use this at the top of model prompts:

```text
Read only these files first: Docs/AI_Contexts/*_COMPACT.md and changed source files.
Do not read folders: static/dev-blog-images, VIDEO NOTES, node_modules, data/backups, YE DEKHIYE.
If more context is needed, ask for exact file path before reading.
```
