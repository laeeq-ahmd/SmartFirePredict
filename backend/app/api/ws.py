from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import cv2
import numpy as np
import base64
from app.core.state import video_stream, detector

router = APIRouter()

@router.websocket("/browser-camera")
async def browser_camera_endpoint(websocket: WebSocket):
    await websocket.accept()
    video_stream.start_websocket_mode()
    detector.start()
    
    try:
        while True:
            data = await websocket.receive_text()
            # data is expected to be a data URL: "data:image/jpeg;base64,/9j/4AAQ..."
            if "," in data:
                header, encoded = data.split(",", 1)
                img_bytes = base64.b64decode(encoded)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    video_stream.put_frame(frame)
    except WebSocketDisconnect:
        print("[WS] Browser camera disconnected")
        video_stream.stop()
