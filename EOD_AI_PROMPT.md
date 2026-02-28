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
- If you created any new modular files or deleted old ones during step 1, **update the `generate_context.py` script** immediately so that it tracks the exact current file architecture in its lists (`files_frontend` & `files_backend`).
- After updating the script, **run `python generate_context.py`** to successfully regenerate the `AI_CONTEXT_FRONTEND.md` and `AI_CONTEXT_BACKEND.md` files. This step is critical as my next sessions rely entirely on this context to stay efficient.

**3. Application Integrity Check:**
- Double-check the root `index.html` (for `<script>` tags or `{% include %}` tags) and `app.py` for correct paths. No broken references should occur due to the split.

**4. Git Push Preparation:**
- Finally, provide me with a quick bulleted summary of everything you optimized.
- Generate a clean multi-command chain that I can copy-paste into my terminal to instantly commit and push the code:
   ```bash
   git add .
   git commit -m "EOD Refactoring: [Summarize your technical changes here briefly]"
   git push
   ```
"
---

### 💡 Why this specific prompt works:
1. **Saves Future Context Window:** AI immediately understands it needs to split large chunks rather than piling onto single files.
2. **Auto-updates the "Brain":** It forces the AI to rebuild `AI_CONTEXT...md` files instantly, meaning tomorrow when you return, the AI has a 100% updated map of your project without re-reading huge folders.
3. **One-click Git:** It hands you the exact terminal command for version control, saving mental energy at the close of your day.
