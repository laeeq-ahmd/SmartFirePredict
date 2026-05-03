from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.core.state import video_stream, detector

router = APIRouter()

class StreamRequest(BaseModel):
    rtsp: str

@router.post("/set-stream")
async def set_stream(req: StreamRequest):
    success = video_stream.start(req.rtsp)
    if success:
        detector.start()
        return {"status": "success", "message": f"Connected to {req.rtsp}"}
    return JSONResponse(status_code=400, content={"status": "error", "message": "Failed to open stream"})

@router.post("/use-webcam")
async def use_webcam():
    success = video_stream.start(0)
    if success:
        detector.start()
        return {"status": "success", "message": "Connected to local webcam"}
    return JSONResponse(status_code=400, content={"status": "error", "message": "Failed to open webcam"})
