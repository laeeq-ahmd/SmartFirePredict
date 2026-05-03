import time
from fastapi import APIRouter
from app.core.state import video_stream, detector

router = APIRouter()

@router.get("/status")
async def get_status():
    """Returns the overall backend system status in the format expected by the frontend."""
    
    # Get latest detection logic
    results = detector.get_latest_results()
    fire_detected = results.get("fire", False)
    smoke_detected = results.get("smoke", False)
    boxes = results.get("boxes", [])
    
    # Calculate a simple mock risk score based on detections
    score = 0
    risk_level = "LOW"
    if fire_detected:
        score = 95
        risk_level = "HIGH"
    elif smoke_detected:
        score = 65
        risk_level = "MEDIUM"
        
    return {
        "score": score,
        "risk_level": risk_level,
        "timestamp": time.strftime("%H:%M:%S"),
        "flame_sensor": fire_detected,  # Mocking hardware sensor with AI for now
        "esp32_connected": False,       # Hardware not integrated yet
        "camera_ok": video_stream.running and video_stream.capture is not None and video_stream.capture.isOpened(),
        "detections": [
            {"class_name": b["class"], "confidence": b["confidence"]} for b in boxes
        ]
    }
