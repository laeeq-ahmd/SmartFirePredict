# SmartFirePredict

**AI & IoT-powered real-time fire and smoke detection system** — combining YOLOv8 computer vision with ESP32 hardware sensor fusion to deliver reliable, low-false-positive fire alerts via Telegram and Twilio.

---

## Live Demo

**[https://smartfirepredict-aws.duckdns.org](https://smartfirepredict-aws.duckdns.org)**

> **Performance Notice:** This demo is hosted on an **AWS EC2 `t2.micro` free-tier instance** (1 vCPU, 1 GB RAM). AI inference runs on CPU only, which makes the live video feed noticeably slow and laggy. This is expected and purely a hardware limitation of the free tier.
>
> For a smooth, real-time experience — especially with live camera feeds and AI detection — **run the project locally** on your own machine using the instructions below.

The live demo runs in **Demo Mode** by default, which disables real Telegram and Twilio alerts. RTSP streaming of CCTV cameras also cannot be tested on the cloud deployment, since the server must be on the **same local network** as the CCTV camera. Use the **Browser Camera** option on the dashboard to test AI detection on the live demo.

---

## Testing the Detection (Quick Start)

You do not need a real fire or CCTV camera to test the system. Here are the easiest ways to trigger detections:

### Option 1 — Show a fire image from your phone (safest)

1. Open the dashboard -> **Cameras** tab -> click **Browser Camera** -> **Start Browser Camera**
2. On your phone, open Google Images and search for "fire" or "smoke"
3. Hold your phone screen up in front of your laptop/PC webcam
4. The model will detect the fire or smoke in the image and update the risk score in real-time

### Option 2 — Use a lighter (local run only)

1. Start the system locally and open a camera feed
2. Flick a lighter or strike a match in front of the webcam
3. The model will detect the flame, the risk score will jump to HIGH, and (if Demo Mode is off) Telegram and Twilio alerts will fire

> Keep flame well away from the screen and any flammable materials. Only do this in a safe, open environment.

### Option 3 — Play a fire video on a second screen

1. On a second monitor or phone, open a YouTube video of fire (search "fire burning close up")
2. Point the webcam at the screen
3. This is the safest way to get sustained detection for testing the 30-second cooldown and escalation behaviour

### What to watch on the dashboard

| Indicator | What it means |
|-----------|--------------|
| Risk banner changes to HIGH (red) | Fire or flame detected |
| Risk banner changes to MEDIUM (yellow) | Smoke detected |
| Risk Score gauge increases | Weighted detection confidence |
| System Status -> Camera shows green | Feed is active and being processed |
| Telegram cooldown timer appears | Alert was sent; next alert suppressed for 30s |

---

## Features

- Real-time fire and smoke detection using **YOLOv8**
- **Browser camera** streaming via **WebSockets** — works directly from any browser, no CCTV required
- **RTSP/CCTV** IP camera stream support with connection testing before committing
- ESP32 hardware sensor integration (flame, gas, temperature, temperature rise rate)
- AI + sensor fusion risk engine — combines vision detections with physical sensor readings
- Consecutive-frame confirmation (5 frames) before triggering alerts, reducing false positives
- Escalation detection — alert immediately resent when threat upgrades from AI-only to AI + hardware
- Dynamic risk score (0-100) with LOW / MEDIUM / HIGH levels
- Live monitoring dashboard built with **Vanilla JS, HTML, and CSS** — no framework required
- **Real-time geolocation tracking** with interactive **Leaflet.js** map and Google Maps link
- Historical analytics with **Chart.js** donut chart and alert log
- Automated **Telegram** alert notifications with location, confidence, and risk level
- Automated **Twilio** emergency phone calls on confirmed dual-source fire detection
- Smart cooldown (30s) prevents duplicate alerts; escalation overrides the cooldown
- All alert settings (fire, smoke, Telegram, Twilio, Demo Mode) configurable live from the dashboard
- Settings are persisted to disk and survive container restarts
- Demo Mode for safe public testing without sending real alerts
- API docs available at `/docs` (Swagger UI) on any running instance
- Fully containerised with **Docker Compose** (2 containers: Nginx + FastAPI)
- Nginx handles static asset caching, gzip compression, MJPEG proxy, and WebSocket upgrades
- Deployed on **AWS EC2** behind an **Nginx** reverse proxy with **HTTPS** (Let's Encrypt)
- **GitHub Actions CI/CD** — automated tests and Docker builds on every push, auto-deploy to EC2 on merge to main

---

## System Architecture

```text
Browser (Dashboard)
  |
  |-- HTTP (polling /status every 1s)
  |-- WebSocket (/ws/browser-camera) for live camera frames
  |
  v
Nginx (Frontend Container — port 3000)
  |-- Serves HTML, CSS, JS (with gzip + 7-day cache)
  |-- Proxies API calls to FastAPI backend
  |-- Proxies WebSocket connections to FastAPI backend
  |-- Proxies MJPEG streams (/video, /thermal)
  |
  v
FastAPI (Backend Container — port 8000)
  |
  +-- VideoStream        (RTSP via OpenCV / WebSocket frames)
  +-- DetectionEngine    (YOLOv8 inference on a background thread)
  +-- AlertManager       (consecutive-frame confirmation, escalation)
  +-- ESP32Monitor       (serial data: flame, gas, temperature)
  +-- AlertSettings      (persisted to disk via named Docker volume)
  +-- TelegramNotifier   (smart cooldown, location-enriched messages)
  +-- TwilioNotifier     (dual-source confirmed fire only)
  +-- LocationState      (geolocation from browser, stored in memory)
  |
  v
Risk Engine (per /status poll)
  |
  +-- score = 95, level = HIGH   (fire detected by AI or HW flame sensor)
  +-- score = 65, level = MEDIUM (smoke detected by AI or HW gas sensor)
  +-- score =  0, level = LOW    (no detections)
```

---

## System Requirements (Local)

For smooth real-time AI inference locally:

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 4-core (Intel i5 / Ryzen 5) | 6-core+ (Intel i7 / Ryzen 7) |
| **RAM** | 8 GB | 16 GB |
| **GPU** | None (CPU-only works) | NVIDIA GPU (CUDA) for real-time speed |
| **Storage** | 5 GB free | 10 GB free |
| **OS** | Windows 10 / Ubuntu 20.04 | Windows 11 / Ubuntu 22.04 |
| **Python** | 3.10+ | 3.11 |

> A dedicated GPU (NVIDIA with CUDA) is **not required** but dramatically improves inference speed. On a modern CPU, YOLOv8n runs at approximately 10-15 FPS. With a GPU it reaches real-time 30+ FPS.

---

## Local Setup (Recommended for Full Performance)

### 1. Clone the Repository

```bash
git clone https://github.com/laeeq-ahmd/SmartFirePredict.git
cd SmartFirePredict
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Then open `.env` and set your values:

```env
# Telegram Bot (from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Twilio Automated Calls
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_FROM_NUMBER=+15551234567     # Your Twilio phone number
TWILIO_TO_NUMBER=+15557654321       # Your number to receive calls
TWILIO_ON_SMOKE=false               # Set true to also call on smoke detections

# ESP32 Serial (leave blank for auto-detect)
ESP32_PORT=

# Stream Auto-Start (Docker / Deployment only)
# Leave blank when running locally — start the stream manually via the dashboard.
# Set to your RTSP URL to auto-start when Docker launches.
DEFAULT_STREAM_URL=

# Demo Mode — set false to enable real Telegram/Twilio alerts
DEMO_MODE=true
```

> If you do not have Telegram or Twilio credentials, leave `DEMO_MODE=true`. The system runs fully without sending real alerts.

### 5. Run the Backend

```bash
python backend/run.py
```

### 6. Open the Dashboard

```
http://localhost:8000
```

The Swagger API docs are also available at:

```
http://localhost:8000/docs
```

---

## Docker Setup

Docker Compose runs the full stack in two containers with a single command.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Set Up Environment

```bash
cp .env.example .env
# Fill in your credentials (see Environment Variables section above)
```

### 2. Build and Start

```bash
docker compose up -d --build
```

This starts:
- **`smartfirepredict-frontend`** — Nginx on port `3000`, serves the dashboard and proxies all API and WebSocket calls to the backend
- **`smartfirepredict-backend`** — FastAPI on port `8000`, runs YOLO inference and manages all state

Alert settings are stored in a named Docker volume (`alert_settings_data`) so they persist across container restarts.

### 3. Open the Dashboard

```
http://localhost:3000
```

### 4. View Logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend
```

### 5. Stop Everything

```bash
docker compose down
```

### ESP32 with Docker

The ESP32 connects via USB serial, which requires device passthrough. Uncomment these lines in `docker-compose.yml` under the `backend` service:

```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0   # Linux — adjust port as needed
group_add:
  - dialout
```

> **Windows users:** Docker Desktop does not support COM port passthrough. Run the backend natively with `python backend/run.py` for ESP32 serial access on Windows.

---

## WebSocket Browser Camera

SmartFirePredict supports two camera input modes selectable from the dashboard:

| Mode | How it works | Best for |
|------|-------------|----------|
| **Browser Camera** | Uses the browser `getUserMedia` API to capture webcam frames, encodes them as base64 JPEG, and streams them to the backend via a **WebSocket** (`/ws/browser-camera`) for real-time YOLO inference | Cloud demo, laptops, quick testing |
| **RTSP Stream** | Backend connects directly to an IP/CCTV camera via an RTSP URL using OpenCV | Local networks with existing CCTV |

### How Browser Camera Works

1. The dashboard requests webcam access from the browser.
2. Frames are captured on a `<canvas>` element and encoded as base64 JPEG.
3. Each frame is sent over a WebSocket connection to `/ws/browser-camera`.
4. The backend decodes the frame with OpenCV, runs YOLOv8 inference, and writes the annotated result into the shared video stream.
5. The dashboard fetches the annotated MJPEG feed from `/video` as normal.
6. Detections update the risk score and can trigger Telegram / Twilio alerts in real-time.

To use it: open the dashboard -> **Cameras** tab -> click **Browser Camera** -> **Start Browser Camera**.

> The WebSocket endpoint automatically uses `wss://` on HTTPS deployments and `ws://` on local HTTP, so no manual configuration is needed.

---

## RTSP Camera Streaming

To stream a CCTV or IP camera:

1. Open the dashboard -> **Cameras** tab -> select **RTSP Stream**
2. Enter your camera details (IP, port, username, password, channel) or paste a full RTSP URL directly
3. Click **Test Connection** to verify the stream without starting detection
4. Click **Save & Connect** to begin streaming and AI inference

> **Network Requirement:** The server running SmartFirePredict **must be on the same local network** as the CCTV camera, or the camera must have a publicly accessible static IP. RTSP streaming **cannot be tested on the live cloud demo** — it must be run locally on your own network.

---

## Location Tracking

The dashboard includes a live geolocation panel powered by the **browser Geolocation API** and rendered on an interactive **Leaflet.js** map.

### What it does

- Continuously tracks your device's GPS or network-based location
- Displays your position on a dark-themed Leaflet map (CARTO basemap tiles)
- Shows latitude, longitude, accuracy (metres), and movement speed
- Provides a **View in Maps** button that opens your coordinates in Google Maps
- Sends location coordinates with every Telegram alert message so the deployment site is identifiable in an emergency

### Privacy

Location data is stored only in memory on the backend and is never persisted to disk or sent to any third party. It is used solely to enrich Telegram alert messages with the deployment location.

---

## Alert System

### Consecutive-Frame Confirmation

To avoid false positives from a single noisy frame, an `AlertManager` tracks a rolling window of the last 5 detection results. An alert is only marked active when **all 5 consecutive frames** confirm a detection. The alert clears as soon as any frame in the window is negative.

### Risk Score

| Score | Level | Trigger |
|-------|-------|---------|
| 0 | LOW | No detection |
| 65 | MEDIUM | AI smoke detection OR hardware gas sensor |
| 95 | HIGH | AI fire detection OR hardware flame sensor |

When both AI and hardware sensors confirm the same event simultaneously, the source tag escalates to `[AI+HW]` and the Telegram cooldown is bypassed to send an immediate re-alert.

---

### Telegram Alerts

Triggered when fire or smoke is detected and the respective alert toggle is enabled.

**Each message includes:**
- Detection class (fire / smoke) and source (AI / Hardware / AI+HW)
- GPS coordinates and a Google Maps link
- Timestamp, AI confidence percentage, and risk level

**Cooldown:** 30 seconds between repeated alerts for the same class. Alerts for a different class (e.g. fire after smoke) are sent immediately regardless of cooldown.

**Setup:**
1. Open Telegram and search for `@BotFather`
2. Create a new bot with `/newbot` and copy the Bot Token
3. Send any message to your new bot
4. Get your Chat ID from: `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env`

---

### Twilio Emergency Calls

Triggered only when **both** conditions are simultaneously true:

```
AI detects Fire  AND  Hardware Flame Sensor detects Fire
```

This dual-source requirement makes false emergency calls extremely unlikely.

**Setup:**
1. Create a [Twilio](https://www.twilio.com/) account
2. Get a Twilio phone number
3. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `TWILIO_TO_NUMBER` to `.env`

---

## Testing

The project includes unit and integration tests using **pytest**.

```bash
cd backend
pytest -v tests/
```

### Test coverage

| Test file | What it covers |
|-----------|---------------|
| `tests/unit/test_alerts.py` | AlertManager consecutive-frame logic and escalation |
| `tests/unit/test_settings.py` | AlertSettings read/write, defaults, toggle persistence |
| `tests/unit/test_location_state.py` | LocationState get/set thread safety |
| `tests/integration/test_status_api.py` | `/status` endpoint response shape and field types |
| `tests/integration/test_demo_mode.py` | Demo Mode toggle blocking Telegram/Twilio in API |

Tests use mock-based fixtures (`conftest.py`) and do not require a real camera, ESP32, or Telegram/Twilio credentials.

---

## Hardware Setup (ESP32)

1. Open `iot/fire_system/main.ino` in Arduino IDE
2. Upload the sketch to your ESP32
3. Connect sensors:
   - Temperature sensor (DS18B20 or similar)
   - Flame sensor (IR-based)
   - Gas / smoke sensor (MQ-2 or similar)
4. Connect ESP32 via USB
5. The backend auto-detects the active serial port (or set `ESP32_PORT` in `.env` to specify it)

The ESP32 streams sensor readings continuously over serial. The backend reads them in a background thread and exposes the latest values via `/status`.

---

## API Reference

The full interactive API reference is available at `/docs` on any running instance.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Full system status — risk score, detections, ESP32, camera state, cooldown |
| `/video` | GET | MJPEG stream of the annotated detection camera feed |
| `/thermal` | GET | MJPEG stream of the thermal / secondary camera feed |
| `/detections` | GET | Latest raw YOLO inference results and alert state |
| `/location` | GET / POST | Get or update the dashboard's geolocation coordinates |
| `/settings` | GET / POST | Read or update alert settings (fire, smoke, Telegram, Twilio, Demo Mode) |
| `/set-stream` | POST | Start the video stream with a given RTSP URL |
| `/stop-stream` | POST | Stop the active video stream |
| `/rtsp-settings` | GET / POST | Save RTSP camera configuration |
| `/rtsp-test` | POST | Test RTSP connection without starting detection |
| `/ws/browser-camera` | WebSocket | Receive base64 JPEG frames from browser webcam |

---

## Project Structure

```text
SmartFirePredict/
|
+-- .github/workflows/
|   +-- ci.yml               # Runs pytest + Docker build on every push
|   +-- cd.yml               # SSH deploys to AWS EC2 on merge to main
|
+-- backend/
|   +-- app/
|   |   +-- api/
|   |   |   +-- control.py   # Start / stop stream endpoints
|   |   |   +-- detection.py # Raw YOLO result endpoint
|   |   |   +-- location.py  # Geolocation read/write
|   |   |   +-- rtsp.py      # RTSP settings + connection test
|   |   |   +-- status.py    # Full system status aggregation
|   |   |   +-- video.py     # MJPEG stream endpoints
|   |   |   +-- ws.py        # WebSocket browser camera endpoint
|   |   +-- core/
|   |   |   +-- alerts.py    # Consecutive-frame AlertManager
|   |   |   +-- detector.py  # YOLOv8 inference engine (background thread)
|   |   |   +-- settings.py  # AlertSettings with disk persistence
|   |   |   +-- state.py     # Shared singleton instances
|   |   |   +-- stream.py    # VideoStream (RTSP + WebSocket mode)
|   |   +-- utils/
|   |   |   +-- telegram.py          # Smart-cooldown Telegram notifier
|   |   |   +-- twilio_notifier.py   # Dual-source Twilio call handler
|   |   +-- config.py        # YOLO model path, thresholds, frame settings
|   |   +-- main.py          # FastAPI app, lifespan, routing
|   +-- models/              # YOLO model weights (best.pt)
|   +-- tests/
|   |   +-- conftest.py      # Shared mock fixtures
|   |   +-- unit/            # Unit tests (alerts, settings, location)
|   |   +-- integration/     # Integration tests (status API, demo mode)
|   +-- requirements.txt
|   +-- requirements-dev.txt # Test dependencies (pytest, httpx, pytest-asyncio)
|   +-- pytest.ini
|   +-- run.py               # Local dev server launcher
|
+-- frontend/
|   +-- dashboard/
|       +-- static/
|       |   +-- css/
|       |   |   +-- main.css         # Layout, sidebar, mobile responsive
|       |   |   +-- components.css   # Cards, gauges, toggles, badges
|       |   |   +-- theme.css        # CSS variables (dark/light themes)
|       |   |   +-- animations.css   # Keyframe animations
|       |   +-- js/
|       |       +-- main.js          # Dashboard orchestrator, status polling
|       |       +-- alerts.js        # Alert log, Telegram/Twilio controls
|       |       +-- location.js      # Geolocation + Leaflet map
|       |       +-- rtsp.js          # RTSP settings form
|       |       +-- theme.js         # Dark/light theme persistence
|       +-- templates/
|           +-- index.html   # Single-page dashboard
|
+-- iot/
|   +-- fire_system/
|       +-- main.ino         # Arduino / ESP32 sketch
|
+-- ML/
|   +-- train.py             # YOLOv8 training script
|   +-- test.py              # Model evaluation script
|
+-- Dockerfile.backend       # Multi-stage Python image with YOLO + OpenCV
+-- Dockerfile.frontend      # Nginx image serving built dashboard
+-- docker-compose.yml       # 2-container orchestration with named volume
+-- nginx.conf               # Static serving, API proxy, WebSocket proxy, gzip
+-- .env.example             # Environment variable template
+-- .dockerignore
+-- .gitignore
+-- README.md
```

---

## Technologies

| Layer | Technology |
|-------|-----------|
| AI / Vision | YOLOv8 (Ultralytics), OpenCV |
| Backend | FastAPI, Uvicorn, Python 3.11 |
| Real-time | WebSockets, MJPEG streaming |
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Maps | Leaflet.js (CARTO basemap) |
| Charts | Chart.js |
| IoT | ESP32, Flame / Gas / Temperature sensors, PySerial |
| Alerts | Telegram Bot API, Twilio Voice API |
| Containerisation | Docker, Docker Compose, Nginx |
| Cloud | AWS EC2 (t2.micro), DuckDNS, Let's Encrypt (HTTPS) |
| CI/CD | GitHub Actions (CI: test + build; CD: SSH deploy) |
| Testing | pytest, pytest-asyncio, httpx |

---

## Built By

**Laeeq Ahmed**

- Email: [laeeq.amd@gmail.com](mailto:laeeq.amd@gmail.com)
- GitHub: [github.com/laeeq-ahmd](https://github.com/laeeq-ahmd/)
