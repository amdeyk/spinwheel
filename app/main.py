from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from starlette.staticfiles import StaticFiles


APP_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(APP_DIR)
STATIC_DIR = os.path.join(ROOT_DIR, "static")
DATA_DIR = os.path.join(ROOT_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "spins.csv")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def ua_to_client_type(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if "ipad" in ua or "tablet" in ua:
        return "tablet"
    if "mobile" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    return "desktop"


def write_spin_row(
    *,
    result_type: str,
    result_label: str,
    spin_duration_sec: float,
    client_type: str,
    session_id: Optional[str],
):
    ensure_data_dir()
    file_exists = os.path.exists(CSV_PATH)
    ts = datetime.now(timezone.utc).isoformat()
    row = [
        ts,
        result_type,
        result_label,
        f"{spin_duration_sec:.2f}",
        client_type,
        session_id or "",
    ]
    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow([
                "timestamp_utc",
                "result_type",
                "result_label",
                "spin_duration_sec",
                "client_type",
                "session_id",
            ])
        writer.writerow(row)


app = FastAPI(title="YESBANK Grande Life – Spin to WIN!")


@app.get("/")
async def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# Serve static assets
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.post("/api/log-spin")
async def log_spin(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    result_type = str(payload.get("result_type", "")).strip()
    result_label = str(payload.get("result_label", "")).strip()
    spin_duration_sec = payload.get("spin_duration_sec", None)
    session_id = payload.get("session_id")

    if result_type not in {"gift", "try_again"}:
        raise HTTPException(status_code=400, detail="Invalid result_type")
    if not result_label:
        raise HTTPException(status_code=400, detail="Missing result_label")
    try:
        spin_duration_val = float(spin_duration_sec)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid spin_duration_sec")

    ua = request.headers.get("user-agent", "")
    client_type = ua_to_client_type(ua)

    write_spin_row(
        result_type=result_type,
        result_label=result_label,
        spin_duration_sec=spin_duration_val,
        client_type=client_type,
        session_id=session_id,
    )

    return JSONResponse({"status": "ok"})


@app.get("/admin/spin-logs")
async def download_logs(request: Request):
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password:
        raise HTTPException(status_code=404, detail="Not found")

    provided = request.headers.get("X-Admin-Password") or request.query_params.get("password")
    if provided != admin_password:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not os.path.exists(CSV_PATH):
        return JSONResponse({"message": "No logs yet."}, status_code=200)

    return FileResponse(CSV_PATH, media_type="text/csv", filename="spins.csv")

