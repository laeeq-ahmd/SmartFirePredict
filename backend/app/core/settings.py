import threading
import json
import os

SETTINGS_FILE = "alert_settings.json"

class AlertSettings:
    """Holds global UI settings for whether different types of alerts should fire."""
    def __init__(self):
        self._lock = threading.Lock()
        self.fire_alerts_enabled = True
        self.smoke_alerts_enabled = True
        self.telegram_alerts_enabled = True
        self.twilio_alerts_enabled = False  # Keep false by default to save credits
        self.demo_mode = True
        self._load()

    def _load(self):
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                    self.fire_alerts_enabled = data.get("fire_alerts", True)
                    self.smoke_alerts_enabled = data.get("smoke_alerts", True)
                    self.telegram_alerts_enabled = data.get("telegram_alerts", True)
                    self.twilio_alerts_enabled = data.get("twilio_alerts", False)
                    self.demo_mode = data.get("demo_mode", True)
            except Exception:
                pass

    def _save(self):
        try:
            with open(SETTINGS_FILE, "w") as f:
                json.dump({
                    "fire_alerts": self.fire_alerts_enabled,
                    "smoke_alerts": self.smoke_alerts_enabled,
                    "telegram_alerts": self.telegram_alerts_enabled,
                    "twilio_alerts": self.twilio_alerts_enabled,
                    "demo_mode": self.demo_mode
                }, f)
        except Exception:
            pass

    def get_all(self):
        with self._lock:
            return {
                "fire_alerts": self.fire_alerts_enabled,
                "smoke_alerts": self.smoke_alerts_enabled,
                "telegram_alerts": self.telegram_alerts_enabled,
                "twilio_alerts": self.twilio_alerts_enabled,
                "demo_mode": self.demo_mode
            }

    def update(self, fire: bool = None, smoke: bool = None, telegram: bool = None, twilio: bool = None, demo_mode: bool = None):
        with self._lock:
            if fire is not None:
                self.fire_alerts_enabled = fire
            if smoke is not None:
                self.smoke_alerts_enabled = smoke
            if telegram is not None:
                self.telegram_alerts_enabled = telegram
            if twilio is not None:
                self.twilio_alerts_enabled = twilio
            if demo_mode is not None:
                self.demo_mode = demo_mode
            self._save()
