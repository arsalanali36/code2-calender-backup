# 🌅 End of Day (EOD) Optimization & Refactor Prompt

**How to use:** Copy and paste the text below to your AI assistant (Claude, ChatGPT, or Antigravity) at the end of your coding session, right before you push to Git and close your system.

---
### 📋 Copy Paste This Directly To the AI:

**"Hello AI, I am done with my coding session for today. Please perform the standard EOD Optimization, Refactoring, and Git Prep workflow. Follow these steps strictly to ensure maximum efficiency and to save API rate limits:**

**1. Code Splitting & Refactoring (Rate Limit Optimization):**
- Review the files I have actively worked on today.
- Identify any JavaScript (`.js`), HTML (`.html`), or Python (`.py`) files that have grown excessively large (e.g., > 400-500 lines) or have mixed responsibilities.
- Suggest or implement splitting these large files into structured, smaller modular files (just like our `modals.html` and the 13 modular `.js` files). Ensure the application remains fully functional without breaking imports.
- Ensure the code follows the DRY (Don't Repeat Yourself) principle. Clean up any obvious unused variables, commented-out dead code, or redundant logic.

**2. Context Synchronization:**
- If you created any new modular files or deleted old ones during step 1, **update the `Scripts/generate_context.py` script** immediately so that it tracks the exact current file architecture.
- Identify any new (`.js`) files or massive logic shifts. Update their `@fileoverview` JSDoc comments at the top of the file, and then map those responsibilities out in `Docs/AI_Contexts/AI_CONTEXT_JS_ARCHITECTURE.md`.
- After updating the script, **run `python Scripts/generate_context.py`** to successfully regenerate all context files into the `Docs/AI_Contexts/` directory. This step is critical to preserving AI memory caches.

**3. Application Integrity Check:**
- Double-check the root `index.html` (for `<script>` tags or `{% include %}` tags) and `app.py` for correct paths. No broken references should occur due to the split.

**4. Update Daily Changelog & Memory:**
- Before summarizing, open the `CHANGELOG.md` file at the root of the project.
- Write down a concise, bulleted daily summary of every feature, bug fix, or update we worked on together today. Put it under a new `🌟 TODAY'S END OF DAY SUMMARY ([Current Date])` section or update the existing latest version.
- Save this file to ensure all AI agents have access to the exact feature history tomorrow.

**5. File Size Enforcement:**
- Check ALL JS, CSS, HTML files for the **30KB hard limit**. If any file exceeds it, split immediately:
  - JS → split along function boundaries
  - CSS → split at `/* ── SECTION` boundary
  - HTML → use Jinja2 `{% include %}`
- Check ALL `Docs/AI_Contexts/AI_CONTEXT_*.md` files — none should exceed 30KB. If over, split into separate groups in `Scripts/generate_context.py`.

**6. Git Commit & Push (includes data backup):**
- Stage and commit ALL changed files — including `data/trades.json` (this is our trade data backup on GitHub).
- Do NOT skip trades.json — it contains tags, images refs, overlays, observations. It must be in every EOD commit.
- Commit with a clear message summarizing today's work, then push:
   ```bash
   git add .
   git commit -m "EOD [Date]: [summary of features/fixes + file splits]"
   git push
   ```
"
---

### 💡 Why this specific prompt works:
1. **Saves Future Context Window:** AI immediately understands it needs to split large chunks rather than piling onto single files.
2. **Auto-updates the "Brain":** It forces the AI to rebuild `AI_CONTEXT...md` files instantly, meaning tomorrow when you return, the AI has a 100% updated map of your project without re-reading huge folders.
3. **One-click Git:** It handles the entire commit including `data/trades.json` — so tags, notes, overlays are always backed up on GitHub.
4. **Triple backup system:** Images → Google Drive (real-time junction sync) | trades.json → GitHub (every EOD) + Google Drive (11:30 PM daily task) | Code → GitHub.
