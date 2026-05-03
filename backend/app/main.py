import os
# Set OpenCV FFMPEG options before importing cv2
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from app.api import video, control, detection, status
from app.core.state import video_stream, detector

app = FastAPI(title="SmartFirePredict API", description="Production-ready multi-threaded YOLO backend")

# Enable CORS for the frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (update in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(video.router, tags=["Video Stream"])
app.include_router(control.router, tags=["Stream Control"])
app.include_router(detection.router, tags=["AI Detections"])
app.include_router(status.router, tags=["System Status"])

# Mount frontend files so we don't need a separate server
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dashboard"))

app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

@app.get("/")
async def serve_dashboard():
    """Serves the main HTML dashboard"""
    return FileResponse(os.path.join(frontend_path, "templates", "index.html"))

@app.on_event("startup")
async def startup_event():
    # Optional auto-start logic here
    pass

@app.on_event("shutdown")
async def shutdown_event():
    detector.stop()
    video_stream.stop()
