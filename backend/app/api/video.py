import time
import cv2
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.config import config
from app.core.state import video_stream, detector

router = APIRouter()

def generate_frames():
    target_delay = 1.0 / config.DEFAULT_FPS_TARGET
    
    while True:
        start_time = time.time()
        frame = detector.get_latest_frame()
        
        if frame is None:
            frame = video_stream.read()
            
        if frame is not None:
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 100])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            time.sleep(0.01)
            continue
            
        elapsed = time.time() - start_time
        sleep_time = target_delay - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)

def generate_thermal_frames():
    target_delay = 1.0 / config.DEFAULT_FPS_TARGET
    
    while True:
        start_time = time.time()
        frame = video_stream.read()
        
        if frame is not None:
            # Create a pseudo-thermal map from the normal footage
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            thermal_mapped = cv2.applyColorMap(gray, cv2.COLORMAP_INFERNO)
            
            ret, buffer = cv2.imencode('.jpg', thermal_mapped, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            time.sleep(0.01)
            continue
            
        elapsed = time.time() - start_time
        sleep_time = target_delay - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)

@router.get("/video")
async def video_feed():
    """MJPEG streaming endpoint for AI detection."""
    return StreamingResponse(
        generate_frames(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/thermal")
async def thermal_feed():
    """MJPEG streaming endpoint for pseudo-thermal mapping."""
    return StreamingResponse(
        generate_thermal_frames(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
