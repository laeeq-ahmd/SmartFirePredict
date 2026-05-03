import collections
import threading

class AlertManager:
    def __init__(self, trigger_threshold=5):
        self.trigger_threshold = trigger_threshold
        self.history = collections.deque(maxlen=trigger_threshold)
        self.lock = threading.Lock()
        self.is_alert_active = False

    def update(self, fire_detected: bool, smoke_detected: bool):
        detected = fire_detected or smoke_detected
        with self.lock:
            self.history.append(detected)
            if len(self.history) == self.trigger_threshold and all(self.history):
                if not self.is_alert_active:
                    self.is_alert_active = True
                    self._on_alert_triggered()
            else:
                if not all(self.history):
                    if self.is_alert_active:
                        self.is_alert_active = False
                        self._on_alert_cleared()

    def _on_alert_triggered(self):
        print("[ALERTS] 🚨 CRITICAL: Fire or Smoke confirmed across consecutive frames! Alert ACTIVE.")

    def _on_alert_cleared(self):
        print("[ALERTS] ✅ CLEAR: System returned to normal state.")

    def get_status(self) -> dict:
        with self.lock:
            return {
                "active": self.is_alert_active,
                "history_buffer": list(self.history)
            }
