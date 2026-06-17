import os
import time
import threading

CALL_COOLDOWN_SECONDS = 120   # 2-minute cooldown between calls (Twilio credits are precious)

class TwilioNotifier:
    """
    Makes automated phone calls via Twilio when fire is detected.
    Has an ON/OFF enabled flag to avoid wasting trial credits.
    Only calls on FIRE (not smoke) by default — configurable via TWILIO_ON_SMOKE.
    """

    def __init__(self, alert_settings):
        self._account_sid  = os.getenv("TWILIO_ACCOUNT_SID", "")
        self._auth_token   = os.getenv("TWILIO_AUTH_TOKEN", "")
        self._from_number  = os.getenv("TWILIO_FROM_NUMBER", "")   # Twilio number e.g. +15551234567
        self._to_number    = os.getenv("TWILIO_TO_NUMBER", "")     # Your number  e.g. +923001234567
        self._on_smoke     = os.getenv("TWILIO_ON_SMOKE", "false").lower() == "true"

        self._lock         = threading.Lock()
        self._last_called  = 0.0
        self._last_class   = None

        # Publicly readable state
        self.alert_settings       = alert_settings
        self.cooldown_remaining   = 0
        self.last_called_class    = None

    @property
    def enabled(self):
        return self.alert_settings.get_all().get("twilio_alerts", False)

    # ── Core call logic ───────────────────────────────────────────────────────

    def maybe_call(self, detection_class: str, confidence: float, source: str = "ai"):
        """
        Trigger a call if:
          - Twilio is enabled
          - Credentials are configured
          - detection_class matches filter (fire always, smoke only if TWILIO_ON_SMOKE=true)
          - Not in cooldown
        """
        if not self.enabled:
            return
        if not self._account_sid or not self._auth_token or not self._from_number or not self._to_number:
            print("[TWILIO] Credentials not configured — skipping call.")
            return
        if detection_class == "smoke" and not self._on_smoke:
            return

        # Check combined state
        from app.core.state import esp32_monitor, detector
        ai_active = detector.latest_results["fire"] if detection_class == "fire" else detector.latest_results["smoke"]
        hw_active = (esp32_monitor.last_flame == 1) if detection_class == "fire" else (esp32_monitor.last_gas == 1)

        # Enforce BOTH rule for phone calls
        if not (ai_active and hw_active):
            return

        now = time.time()
        with self._lock:
            elapsed  = now - self._last_called
            in_cooldown = (
                elapsed < CALL_COOLDOWN_SECONDS and
                self._last_class == detection_class
            )
            if in_cooldown:
                self.cooldown_remaining = int(CALL_COOLDOWN_SECONDS - elapsed)
                return

            # Proceed with call
            self._last_called      = now
            self._last_class       = detection_class
            self.cooldown_remaining = CALL_COOLDOWN_SECONDS
            self.last_called_class  = detection_class

        threading.Thread(target=self._make_call, args=(detection_class, confidence, source), daemon=True).start()

    def clear(self):
        """Reset class tracking when detections stop."""
        now = time.time()
        with self._lock:
            if now - self._last_called >= CALL_COOLDOWN_SECONDS:
                self._last_class = None
            self.cooldown_remaining = max(0, int(CALL_COOLDOWN_SECONDS - (now - self._last_called)))

    # ── Twilio REST API call ──────────────────────────────────────────────────

    def _make_call(self, detection_class: str, confidence: float, source: str):
        if self._settings.get_all().get("demo_mode", False):
            print("[DEMO MODE] Twilio call skipped")
            return

        try:
            from twilio.rest import Client   # lazy import — only needed when actually calling
            client = Client(self._account_sid, self._auth_token)

            source_text = "both Artificial Intelligence and Hardware sensors"
            
            # TwiML — spoken message when call is answered
            twiml = (
                f"<Response>"
                f"<Say voice='alice' loop='2'>"
                f"This is an automated call to report about the {detection_class} breakout."
                f"</Say>"
                f"</Response>"
            )

            call = client.calls.create(
                twiml=twiml,
                to=self._to_number,
                from_=self._from_number,
            )
            print(f"[TWILIO] Call initiated. SID: {call.sid}")

        except ImportError:
            print("[TWILIO] twilio package not installed. Run: pip install twilio")
        except Exception as e:
            print(f"[TWILIO] Call failed: {e}")

    def get_status(self) -> dict:
        now = time.time()
        with self._lock:
            remaining = max(0, int(CALL_COOLDOWN_SECONDS - (now - self._last_called)))
        return {
            "twilio_enabled":          self.enabled,
            "twilio_cooldown_active":  remaining > 0 and self._last_class is not None,
            "twilio_cooldown_remaining": remaining,
            "twilio_last_class":       self.last_called_class,
        }
