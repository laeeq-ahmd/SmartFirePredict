import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import video, control, detection, status, location, rtsp
from app.core.state import video_stream, detector, esp32_monitor

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    print("[SYSTEM] Starting SmartFirePredict Backend...")
    esp32_monitor.start()

    # Auto-start stream if DEFAULT_STREAM_URL is set (used in Docker/deployment).
    # Locally this env var is not set, so the user starts the stream manually
    # via the dashboard as usual — no behaviour change for local dev.
    default_stream = os.getenv("DEFAULT_STREAM_URL", "").strip()
    if default_stream:
        print(f"[SYSTEM] AUTO-START: DEFAULT_STREAM_URL detected → {default_stream}")
        success = video_stream.start(default_stream)
        if success:
            detector.start()
            print("[SYSTEM] AUTO-START: Stream and detector started successfully.")
        else:
            print(f"[SYSTEM] AUTO-START: Failed to open stream: {default_stream}")
    else:
        print("[SYSTEM] No DEFAULT_STREAM_URL set — start stream manually via dashboard.")

    yield
    # ── Shutdown ──
    detector.stop()
    video_stream.stop()
    esp32_monitor.stop()

app = FastAPI(
    title="SmartFirePredict API",
    description="Real-time AI + IoT fire detection backend",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(video.router,     tags=["Video Stream"])
app.include_router(control.router,   tags=["Stream Control"])
app.include_router(detection.router, tags=["AI Detections"])
app.include_router(status.router,    tags=["System Status"])
app.include_router(location.router,  tags=["Location"])
app.include_router(rtsp.router,      tags=["RTSP Settings"])

# Serve frontend
frontend_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dashboard")
)
app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

@app.get("/")
async def serve_dashboard():
    return FileResponse(os.path.join(frontend_path, "templates", "index.html"))
