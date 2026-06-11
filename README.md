# SmartFirePredict

SmartFirePredict is an AI and IoT-powered fire detection and emergency response system that combines YOLOv8 computer vision with ESP32 sensor data to provide reliable fire detection while minimizing false alarms.

The system uses a sensor fusion architecture that merges visual fire and smoke detection with environmental sensor readings such as temperature, flame detection, and gas levels to calculate a unified risk score and trigger automated emergency notifications.

---

## Features

- Real-time fire detection using YOLOv8
- Smoke detection using computer vision
- ESP32-based IoT sensor integration
- AI and hardware sensor fusion
- Dynamic risk score calculation
- Telegram alert notifications
- Automated Twilio emergency calls
- Live monitoring dashboard
- Thermal camera support
- Modular FastAPI backend architecture

---

## System Architecture

```text
ESP32 Sensors
(Temperature, Flame, Gas)
          │
          ▼
   Sensor Fusion Layer
          ▲
          │
YOLOv8 Fire & Smoke Detection
          │
          ▼
      Risk Engine
          │
 ┌────────┴────────┐
 ▼                 ▼
Telegram      Twilio Calls
Alerts        Emergency Calls
          │
          ▼
     Dashboard UI
```

---

## Sensor Fusion Layer

The Sensor Fusion Layer acts as the intelligence engine of SmartFirePredict.

Instead of relying solely on computer vision or hardware sensors, the system combines both sources of information to calculate a unified Risk Score.

### AI Input

YOLOv8 continuously processes the video feed and detects:

- Fire
- Smoke

Each detection includes a confidence score.

### Hardware Input

The ESP32 streams real-time sensor data:

- Temperature
- Temperature rise rate
- Flame sensor status
- Gas/Smoke sensor status

### Risk Score Calculation

The system calculates a risk score ranging from 0 to 100.

Additional points are awarded when physical sensors validate AI observations.

### Example

```text
AI Detects Fire
+
Flame Sensor Triggered
+
Rapid Temperature Increase
=
High Risk
```

This fusion strategy significantly reduces false positives.

### Risk Levels

| Score | Risk Level |
|---------|---------|
| 0 - 39 | Low Risk |
| 40 - 79 | Medium Risk |
| 80 - 100 | High Risk |

---

## Alert System

### Telegram Alerts

Telegram is used for instant event notifications.

#### Trigger Conditions

- Smoke detection
- Fire detection
- Medium risk
- High risk

#### Information Sent

- Detected class
- AI confidence
- Temperature
- Risk score

#### Spam Prevention

A 30-second cooldown prevents duplicate alerts from being sent continuously.

---

### Twilio Emergency Calls

Twilio is used for critical emergency situations.

#### Trigger Condition

```text
AI Detects Fire
AND
Flame Sensor Detects Fire
```

Only when both conditions are met will the system place an automated emergency phone call.

#### Call Workflow

```text
Confirmed Fire
      ↓
Twilio API
      ↓
Voice Call
      ↓
Text-to-Speech Emergency Warning
```

---

## Project Structure

```text
SmartFirePredict/
│
├── ML/
│   ├── train.py
│   ├── test.py
│   └── yolov8n.pt
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   └── utils/
│   ├── models/
│   └── run.py
│
├── frontend/
│   └── dashboard/
│
└── iot/
    └── fire_system/
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/laeeq-ahmd/SmartFirePredict.git
cd SmartFirePredict
```

### Install Dependencies

```bash
pip install -r backend/requirements.txt
```

---

## Environment Configuration

Create a `.env` file in the project root.

```env
# TELEGRAM

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# TWILIO

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=your_twilio_number
TWILIO_TO_NUMBER=your_phone_number
```

---

## Telegram Setup

1. Open Telegram.
2. Search for `@BotFather`.
3. Create a new bot using:

```text
/newbot
```

4. Copy the Bot Token.
5. Send a message to your bot.
6. Visit:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

7. Retrieve your Chat ID.

---

## Twilio Setup

1. Create a Twilio account.
2. Verify your phone number.
3. Obtain:

- Account SID
- Auth Token
- Twilio Number

4. Add credentials to `.env`.

---

## Hardware Setup

1. Open:

```text
iot/fire_system/main.ino
```

2. Upload the sketch to ESP32.

3. Connect:

- Temperature Sensor
- Flame Sensor
- Gas Sensor

4. Connect ESP32 via USB.

The backend automatically detects the active COM port.

---

## Running the Project

Start the backend:

```bash
python backend/run.py
```

Open the dashboard:

```text
http://localhost:8000
```

---

## Technologies Used

### AI & Computer Vision

- YOLOv8
- OpenCV
- Python

### Backend

- FastAPI
- REST APIs

### Frontend

- HTML
- CSS
- JavaScript
- Flask

### IoT

- ESP32
- Flame Sensor
- Gas Sensor
- Temperature Sensor

### Notifications

- Telegram Bot API
- Twilio API
