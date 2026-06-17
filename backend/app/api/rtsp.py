from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import json, os

router = APIRouter()

# ── Persistent settings file ──────────────────────────────────────────────────
_RTSP_SETTINGS_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "rtsp_settings.json"
)

_DEFAULT_SETTINGS = {
    "ip":       "",
    "username": "",
    "password": "",
    "port":     554,
    "channel":  1,
    "subtype":  0,   # 0 = main/high, 1 = sub/low
}

def _load() -> dict:
    try:
        if os.path.exists(_RTSP_SETTINGS_FILE):
            with open(_RTSP_SETTINGS_FILE, "r") as f:
                data = json.load(f)
                # Merge with defaults so any missing keys are filled
                return {**_DEFAULT_SETTINGS, **data}
    except Exception:
        pass
    return dict(_DEFAULT_SETTINGS)

def _save(settings: dict):
    try:
        with open(_RTSP_SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        print(f"[RTSP Settings] Failed to save: {e}")

def _build_url(s: dict) -> str:
    """Build an RTSP URL from the settings dict."""
    ip       = s.get("ip", "").strip()
    port     = s.get("port", 554)
    username = s.get("username", "").strip()
    password = s.get("password", "").strip()
    channel  = s.get("channel", 1)
    subtype  = s.get("subtype", 0)

    if not ip:
        return ""

    # Dahua/generic ONVIF format — most widely compatible
    # rtsp://user:pass@ip:port/cam/realmonitor?channel=1&subtype=0
    creds = f"{username}:{password}@" if username else ""
    return f"rtsp://{creds}{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}"


# ── Models ────────────────────────────────────────────────────────────────────
class RtspSettings(BaseModel):
    ip:       str            = ""
    username: str            = ""
    password: str            = ""
    port:     int            = 554
    channel:  int            = 1
    subtype:  int            = 0   # 0 = main stream (high quality), 1 = sub stream (low quality)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/rtsp-settings")
async def get_rtsp_settings():
    """Return saved RTSP camera settings and the built URL."""
    s = _load()
    return {**s, "rtsp_url": _build_url(s)}


@router.post("/rtsp-settings")
async def save_rtsp_settings(req: RtspSettings):
    """Save RTSP camera settings and return the built URL."""
    settings = req.model_dump()
    _save(settings)
    url = _build_url(settings)
    return {"status": "saved", "rtsp_url": url, **settings}


@router.post("/rtsp-test")
async def test_rtsp_connection(req: RtspSettings):
    """
    Try to open the RTSP stream for up to 3 seconds.
    Returns success/fail without starting the real detection pipeline.
    This is a lightweight connectivity check only.
    """
    import cv2, threading

    url = _build_url(req.model_dump())
    if not url:
        return JSONResponse(status_code=400, content={"status": "error", "message": "No IP address provided."})

    result = {"ok": False, "message": ""}

    def _try():
        try:
            cap = cv2.VideoCapture(url)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3000)
            if cap.isOpened():
                ret, _ = cap.read()
                result["ok"]      = ret
                result["message"] = "Stream opened and frame received." if ret else "Stream opened but no frame received."
            else:
                result["message"] = "Could not open RTSP stream. Check IP, port, credentials, channel, and make sure you are connected to the same network as the CCTV."
            cap.release()
        except Exception as e:
            result["message"] = str(e)

    t = threading.Thread(target=_try)
    t.start()
    t.join(timeout=5)

    if result["ok"]:
        return {"status": "success", "message": result["message"], "rtsp_url": url}
    return JSONResponse(
        status_code=400,
        content={"status": "error", "message": result["message"] or "Timeout — camera did not respond in 5s.", "rtsp_url": url}
    )
