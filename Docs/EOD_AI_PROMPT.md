# End of Day (EOD) Auto Workflow Prompt

Use this file as the single source of truth for daily wrap-up.

## Trigger Contract
If user says any of these:
- `EOD prompt padh liye`
- `Run EOD`
- `EOD close kar do`

Then AI must execute this workflow automatically without asking for step-by-step instructions.

## Execution Rules
1. Work on current workspace state first (`git status`, changed files, current branch).
2. Prefer safe automation scripts already present in repo.
3. Avoid reading heavy/unrelated folders unless explicitly requested.
4. If a blocking action requires permission (for example remote push), ask only that specific question.
5. If no changes exist, report `No EOD changes pending` and stop.

## Daily EOD Workflow (Mandatory Order)
1. Inspect changes
- Run `git status --short`
- Identify changed source files (`.py`, `.js`, `.css`, `.html`, templates)

2. Refactor and hygiene pass
- Remove obvious dead code, redundant code, and stale comments
- If files are too large or mixed responsibility, split safely without breaking imports/includes
- Keep runtime behavior unchanged

3. Context sync (token optimization)
- Update `Scripts/generate_context.py` if architecture changed
- Regenerate compact context files:
  - `python Scripts/generate_context.py --mode compact --output-suffix _COMPACT`
- Optional fast mode for daily iteration:
  - `python Scripts/generate_context.py --mode compact --changed-only --output-suffix _COMPACT`

4. Shadow repo refresh
- Run:
  - `powershell -ExecutionPolicy Bypass -File .\Scripts\build_shadow_repo.ps1`
- If user asks to include live trade data snapshot, run with `-IncludeData`

5. Integrity check
- Validate key entrypoints/references are not broken (`app.py`, `templates/index.html`, script includes)
- Run lightweight syntax checks for touched code where applicable
- Verify backend architecture rules are intact:
  - `app.py` must only contain: Flask setup, blueprint registration, startup tasks — NO route handlers
  - All config/paths must come from `config.py` — never hardcoded in routes or services
  - New routes must go in the correct `routes/*.py` blueprint file
  - New business logic must go in `services/*.py` — not inside route handlers
  - New data transforms must go in `processors/data_processors.py`
  - JS frontend code must call `static/js/services/*.js` — never raw `fetch()` directly

6. Update logs
- Update `CHANGELOG.md` with today's concise bullet summary
- Update `data/dev-blog.json` entry for today's work (newest first)

7. Git prep
- Stage all intended files, including `data/trades.json` when changed
- Create clear EOD commit message:
  - `EOD YYYY-MM-DD: <short summary>`
- Push if remote/auth is available; otherwise report exact blocker

## Preferred One-Command Path
When possible, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\EOD_OPTIMIZE.ps1 -ChangedOnly
```

If full context regeneration is explicitly needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\EOD_OPTIMIZE.ps1 -FullContext
```

## Final Response Format (Required)
AI must end with:
1. `Changes made`
2. `Checks run`
3. `Git status summary`
4. `Any blockers`

## Token Guardrail for All AIs
Do not ingest these folders unless user explicitly asks:
- `static/dev-blog-images`
- `VIDEO NOTES`
- `node_modules`
- `data/backups`
- `YE DEKHIYE`

Read compact context first:
- `Docs/AI_Contexts/*_COMPACT.md`

Read full source files only when editing those exact files.
