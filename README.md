# SmartFirePredict

An AI-based real-time fire and smoke detection system utilizing YOLOv10 and a multi-threaded FastAPI backend.

## Project Structure
- `backend/`: FastAPI server for RTSP capture, ML inference, and MJPEG streaming.
- `frontend/`: The UI dashboard.
- `ml/`: Model training and testing scripts.
- `iot/`: ESP32 integration code.

## Quick Start
1. Start the backend: `cd backend && python run.py`
2. Open the frontend: Serve `frontend/dashboard/templates/index.html` via Live Server.
