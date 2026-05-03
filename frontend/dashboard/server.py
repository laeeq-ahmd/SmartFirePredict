"""
dashboard/server.py — Flask Dashboard Server
Serves the web dashboard and provides API endpoints for the pipeline.

Endpoints:
  GET  /          → index.html
  GET  /status    → JSON system status
  POST /location  → Update location from browser geolocation
  GET  /stream    → MJPEG pseudo-thermal stream
"""

import io
import logging
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, Response, jsonify, render_template, request
from flask_cors import CORS

# ─── Path setup so imports resolve from App/ root ────────────────────────────
APP_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(APP_ROOT))

import location as loc_module

logger = logging.getLogger(__name__)

# ─── Flask app ────────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder = str(Path(__file__).parent / "templates"),
    static_folder   = str(Path(__file__).parent / "static"),
)
CORS(app)  # Allow cross-origin requests from dashboard

# ─── Shared state (written by main.py pipeline) ───────────────────────────────
# Access via get_shared_state() / update_shared_state()
_state_lock = threading.Lock()
_shared_state = {
    "risk_level":    "LOW",
    "score":         0,
    "flame_sensor":  False,
    "detections":    [],        # list of {class_name, confidence}
    "location":      {},
    "camera_ok":     False,
    "esp32_connected": False,
    "timestamp":     None,
}

# Latest thermal frame for MJPEG streaming (set by main.py)
_thermal_lock  = threading.Lock()
_thermal_frame: np.ndarray | None = None

# Latest annotated detection frame
_detect_lock  = threading.Lock()
_detect_frame: np.ndarray | None = None


# ─── State helpers (called by main.py) ───────────────────────────────────────

def update_shared_state(**kwargs):
    """Update any fields in the shared state dict."""
    with _state_lock:
        _shared_state.update(kwargs)
        _shared_state["timestamp"] = time.strftime("%H:%M:%S")


def update_thermal_frame(frame: np.ndarray):
    """Push a new thermal frame for the MJPEG stream."""
    global _thermal_frame
    with _thermal_lock:
        _thermal_frame = frame.copy()


def update_detection_frame(frame: np.ndarray):
    """Push a new annotated detection frame."""
    global _detect_frame
    with _detect_lock:
        _detect_frame = frame.copy()


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/status")
def status():
    """Return current system state as JSON."""
    with _state_lock:
        state = dict(_shared_state)
    loc = loc_module.get_location()
    state["location"] = loc
    return jsonify(state)


@app.route("/location", methods=["POST"])
def receive_location():
    """
    Receive GPS coordinates from the browser Geolocation API.
    Expected JSON: { lat, lon, accuracy }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    try:
        lat      = float(data["lat"])
        lon      = float(data["lon"])
        accuracy = float(data.get("accuracy", 0))
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Missing or invalid fields: {e}"}), 400

    loc_module.update_location(lat, lon, accuracy)
    logger.info(f"[Server] Location updated: {lat}, {lon} ±{accuracy}m")
    return jsonify({"status": "ok"})


@app.route("/stream")
@app.route("/stream/thermal")
def stream():
    """MJPEG thermal stream (also accessible as /stream/thermal)."""
    return Response(_generate_mjpeg(_thermal_lock, lambda: _thermal_frame),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/stream/detection")
def stream_detection():
    """MJPEG annotated detection stream."""
    return Response(_generate_mjpeg(_detect_lock, lambda: _detect_frame),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


# ─── MJPEG generator ─────────────────────────────────────────────────────────

def _generate_mjpeg(lock, getter):
    """Generic MJPEG generator — takes a lock and a frame getter callable."""
    placeholder = _make_placeholder_frame()
    while True:
        with lock:
            frame = getter()
        if frame is None:
            frame = placeholder
        ret, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ret:
            time.sleep(0.05)
            continue
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n")
        time.sleep(1 / 15)


def _make_placeholder_frame() -> np.ndarray:
    """Generate a dark placeholder frame with 'No Signal' text."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(
        frame, "No Signal", (220, 245),
        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (80, 80, 80), 2, cv2.LINE_AA
    )
    return frame


# ─── Server runner ────────────────────────────────────────────────────────────

def run_server(host: str = "0.0.0.0", port: int = 5000, debug: bool = False):
    """Start the Flask server (blocking). Call from a dedicated thread."""
    logger.info(f"[Server] Dashboard running at http://{host}:{port}")
    app.run(host=host, port=port, debug=debug, use_reloader=False, threaded=True)
