# Share This App (Web + Mobile)

## Option 1: Public Link (Render)
1. Push this repo to GitHub.
2. Go to Render and create a new **Web Service** from this repo.
3. Render auto-detects `render.yaml` / `Procfile`.
4. Deploy. You will get a public HTTPS URL.
5. Share that URL with anyone (desktop + mobile).

## Option 2: Local Network (same Wi-Fi)
1. Run server:
   - `python app.py`
2. Find your PC LAN IP (example: `192.168.1.20`).
3. Open on phone:
   - `http://192.168.1.20:5000`
4. Ensure Windows firewall allows Python on private network.

## Notes
- App now listens on `0.0.0.0` and `PORT` env variable.
- Uploaded images are served from `/uploads/<filename>`.
- For persistent production storage, set env vars:
  - `DATA_FILE`
  - `UPLOADS_DIR`
