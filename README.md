# YESBANK “Grande Life – Spin to WIN!”

A fast, mobile-first spin wheel web app with local-only assets, confetti, sounds, T&C modal, and anonymous CSV logging.

## Run

1. Python 3.10+ recommended
2. Create venv and install deps
   - Windows:
     - `python -m venv .venv && .venv\\Scripts\\activate`
   - Linux/Mac:
     - `python -m venv .venv && source .venv/bin/activate`
   - Install: `pip install -r requirements.txt`
3. Start server: `python -m uvicorn app.main:app --reload`
4. Open: `http://localhost:8000`

## Admin CSV Download (optional)
- Set environment variable: `ADMIN_PASSWORD=yourpass`
- Request: `GET /admin/spin-logs` with header `X-Admin-Password: yourpass`
- CSV path on server: `data/spins.csv`

## Notes
- No external CDNs. All assets are local.
- Anonymous logging only: timestamp, result_type, result_label, spin_duration_sec, client_type, session_id.
- Unlimited spins. Encourage users to screenshot winning states.

