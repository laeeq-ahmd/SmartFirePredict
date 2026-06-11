import os
import time
import threading
import requests

COOLDOWN_SECONDS = 30

class TelegramNotifier:
    """
    Smart-cooldown Telegram notifier.
    Rules:
      - First detection → send immediately.
      - Same class again within 30s → skip (cooldown).
      - Class switches (fire→smoke or smoke→fire) → send immediately, reset cooldown.
      - Detection restarts after 30s gap → send immediately.
    """

    def __init__(self, alert_settings):
        self._bot_token  = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self._chat_id    = os.getenv("TELEGRAM_CHAT_ID", "")
        self.alert_settings = alert_settings
        self._lock       = threading.Lock()
        self._last_class = None
        self._last_sent  = 0.0           # epoch seconds
        self._last_source_tag = None     # tracks AI vs HW vs AI+HW
        self.cooldown_remaining = 0      # seconds left in cooldown (for UI)
        self.last_sent_class    = None   # for UI display

    def maybe_send(self, detection_class: str, confidence: float, lat, lon, source="ai"):
        """
        Call this whenever a detection fires.
        detection_class: 'fire' or 'smoke'
        """
        if not self._bot_token or not self._chat_id:
            return  # credentials not configured yet

        # Check user alert settings
        settings = self.alert_settings.get_all()
        if not settings["telegram_alerts"]:
            return
        if detection_class == "fire" and not settings["fire_alerts"]:
            return
        if detection_class == "smoke" and not settings["smoke_alerts"]:
            return

        # Compute current source tag
        from app.core.state import esp32_monitor, detector
        ai_active = detector.latest_results["fire"] if detection_class == "fire" else detector.latest_results["smoke"]
        hw_active = (esp32_monitor.last_flame == 1) if detection_class == "fire" else (esp32_monitor.last_gas == 1)

        source_tag = "[AI]"
        if ai_active and hw_active:
            source_tag = "[AI+HW]"
        elif hw_active:
            source_tag = "[HARDWARE]"

        now = time.time()
        with self._lock:
            elapsed = now - self._last_sent
            in_cooldown = (elapsed < COOLDOWN_SECONDS and self._last_class == detection_class)

            # ESCALATION OVERRIDE: If previously not AI+HW, but now it is AI+HW, break cooldown!
            escalated = (source_tag == "[AI+HW]" and self._last_source_tag != "[AI+HW]")

            if in_cooldown and not escalated:
                self.cooldown_remaining = int(COOLDOWN_SECONDS - elapsed)
                return  # suppress

            # Send alert
            self._last_class = detection_class
            self._last_source_tag = source_tag
            self._last_sent  = now
        
        self.last_sent_class     = detection_class

        # Build message
        ts       = time.strftime("%H:%M:%S")
        loc_str  = f"{lat:.6f}, {lon:.6f}" if lat is not None else "Unknown"
        maps_link = f"[Google Maps](https://www.google.com/maps?q={lat},{lon})" if lat is not None else "Unknown"
        conf_pct = int(confidence * 100)

        if detection_class == "fire":
            msg = (
                f"🔥 *FIRE DETECTED {source_tag}*\n"
                f"📍 Location: `{loc_str}`\n"
                f"🗺️ Maps: {maps_link}\n"
                f"⏰ Time: `{ts}`\n"
                f"📊 Confidence: `{conf_pct}%`\n"
                f"⚠️ Risk Level: *HIGH*"
            )
        else:
            msg = (
                f"🚨 *SMOKE DETECTED {source_tag}*\n"
                f"📍 Location: `{loc_str}`\n"
                f"⏰ Time: `{ts}`\n"
                f"📊 Confidence: `{conf_pct}%`\n"
                f"⚠️ Risk Level: *MEDIUM*"
            )

        threading.Thread(target=self._send, args=(msg,), daemon=True).start()

    def clear(self):
        """Call when no detection is present to allow fresh alerts after cooldown gap."""
        now = time.time()
        with self._lock:
            if now - self._last_sent >= COOLDOWN_SECONDS:
                self._last_class = None
            remaining = max(0, int(COOLDOWN_SECONDS - (now - self._last_sent)))
            self.cooldown_remaining = remaining

    def get_cooldown_status(self) -> dict:
        now = time.time()
        with self._lock:
            remaining = max(0, int(COOLDOWN_SECONDS - (now - self._last_sent)))
            return {
                "cooldown_active":    remaining > 0 and self._last_class is not None,
                "cooldown_remaining": remaining,
                "last_sent_class":    self._last_class,
            }

    def _send(self, text: str):
        try:
            url = f"https://api.telegram.org/bot{self._bot_token}/sendMessage"
            requests.post(url, json={
                "chat_id":    self._chat_id,
                "text":       text,
                "parse_mode": "Markdown"
            }, timeout=10)
            print(f"[TELEGRAM] Alert sent.")
        except Exception as e:
            print(f"[TELEGRAM] Failed to send: {e}")
