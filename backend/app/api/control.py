from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.core.state import video_stream, detector, twilio, alert_settings

router = APIRouter()

# ── Camera source controls ────────────────────────────────────────────────────

class StreamRequest(BaseModel):
    rtsp: str

@router.post("/set-stream")
async def set_stream(req: StreamRequest):
    """Start an RTSP stream and save the source for toggle restarts."""
    _camera_state["last_source"] = req.rtsp
    _camera_state["enabled"] = True
    success = video_stream.start(req.rtsp)
    if success:
        detector.start()
        return {"status": "success", "message": f"Connected to {req.rtsp}"}
    return JSONResponse(status_code=400, content={"status": "error", "message": "Failed to open RTSP stream"})

@router.post("/use-webcam")
async def use_webcam():
    """Start local webcam and save source for toggle restarts."""
    _camera_state["last_source"] = 0   # index 0 = default webcam
    _camera_state["enabled"] = True
    success = video_stream.start(0)
    if success:
        detector.start()
        return {"status": "success", "message": "Connected to local webcam"}
    return JSONResponse(status_code=400, content={"status": "error", "message": "Failed to open webcam"})

@router.post("/stop-stream")
async def stop_stream():
    """Fully stop the video stream and detector."""
    detector.stop()
    video_stream.stop()
    _camera_state["enabled"] = False
    return {"status": "success", "message": "Stream stopped"}

# ── Detection ON/OFF toggle ───────────────────────────────────────────────────
_camera_state = {
    "enabled":     True,
    "last_source": None,   # 0 for webcam, or RTSP string
}

@router.post("/camera/toggle")
async def camera_toggle():
    """
    Toggle detection camera ON or OFF.
    OFF  → stops OpenCV VideoCapture + detector thread (camera truly released).
    ON   → restarts stream from last known source + restarts detector.
    """
    _camera_state["enabled"] = not _camera_state["enabled"]

    if _camera_state["enabled"]:
        # ── Turn ON ──────────────────────────────────────────────────────────
        src = _camera_state.get("last_source")
        if src is None:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "No camera source set. Start a stream first."}
            )
        success = video_stream.start(src)
        if success:
            detector.start()
        return {"camera_enabled": True, "source": str(src), "stream_ok": success}

    else:
        # ── Turn OFF ─────────────────────────────────────────────────────────
        detector.stop()
        video_stream.stop()
        return {"camera_enabled": False}

@router.get("/camera/state")
async def camera_state():
    """Return current camera enabled state."""
    return {"camera_enabled": _camera_state["enabled"]}


# ── Twilio call toggle ───────────────────────────────────────────────────────────────────
@router.post("/twilio/toggle")
async def twilio_toggle():
    """Toggle Twilio automated calls ON or OFF."""
    current = alert_settings.get_all()["twilio_alerts"]
    alert_settings.update(twilio=not current)
    return {"twilio_enabled": not current}

@router.get("/twilio/state")
async def twilio_state():
    """Return current Twilio enabled state."""
    return {"twilio_enabled": alert_settings.get_all()["twilio_alerts"]}


# ── Alert Settings ───────────────────────────────────────────────────────────────────────
class AlertSettingsUpdate(BaseModel):
    fire_alerts: Optional[bool] = None
    smoke_alerts: Optional[bool] = None
    telegram_alerts: Optional[bool] = None

@router.get("/settings")
async def get_settings():
    """Get all alert settings."""
    return alert_settings.get_all()

@router.post("/settings")
async def update_settings(req: AlertSettingsUpdate):
    """Update specific alert settings."""
    alert_settings.update(
        fire=req.fire_alerts,
        smoke=req.smoke_alerts,
        telegram=req.telegram_alerts
    )
    return {"status": "success", "settings": alert_settings.get_all()}
