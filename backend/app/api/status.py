import time
from fastapi import APIRouter
from app.core.state import video_stream, detector, esp32_monitor, telegram, twilio, alert_settings

router = APIRouter()

@router.get("/status")
async def get_status():
    """Returns the full system status for the frontend dashboard."""

    results      = detector.get_latest_results()
    fire_det     = results.get("fire", False)
    smoke_det    = results.get("smoke", False)
    boxes        = results.get("boxes", [])
    esp32_data   = esp32_monitor.get_data()
    cooldown     = telegram.get_cooldown_status()

    # Risk score — combine AI + hardware sensor
    hw_flame = esp32_data.get("flame") == 1   # physical flame sensor triggered
    hw_gas   = esp32_data.get("gas")   == 1   # physical gas sensor triggered

    score      = 0
    risk_level = "LOW"
    if fire_det or hw_flame:
        score      = 95
        risk_level = "HIGH"
    elif smoke_det or hw_gas:
        score      = 65
        risk_level = "MEDIUM"

    demo_mode = alert_settings.get_all().get("demo_mode", False)

    return {
        "demo_mode":      demo_mode,
        "score":          score,
        "risk_level":     risk_level,
        "timestamp":      time.strftime("%H:%M:%S"),

        # AI detections
        "flame_sensor":   fire_det,
        "smoke_detected": smoke_det,
        "detections":     [{"class_name": b["class"], "confidence": b["confidence"]} for b in boxes],

        # Camera
        "camera_ok": (
            video_stream.running and (
                video_stream.stream_url == "websocket" or
                (video_stream.capture is not None and video_stream.capture.isOpened())
            )
        ),

        # ESP32 hardware
        "esp32_connected": esp32_data["connected"],
        "temp":            esp32_data["temp"],
        "humidity":        esp32_data.get("rise"),   # using Rise as proxy until real humidity added
        "flame_hw":        esp32_data["flame"],
        "gas":             esp32_data["gas"],

        # Telegram cooldown info
        "cooldown_active":    cooldown["cooldown_active"],
        "cooldown_remaining": cooldown["cooldown_remaining"],
        "last_sent_class":    cooldown["last_sent_class"],

        # Twilio call state
        **twilio.get_status(),
    }
