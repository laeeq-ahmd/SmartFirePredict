from app.core.stream import VideoStream
from app.core.detector import DetectionEngine
from app.core.esp32 import ESP32Monitor
from app.core.location_state import LocationState
from app.core.settings import AlertSettings
from app.utils.telegram import TelegramNotifier
from app.utils.twilio_notifier import TwilioNotifier

# Shared singletons — import these everywhere
video_stream   = VideoStream()
location_state = LocationState()
alert_settings = AlertSettings()
telegram       = TelegramNotifier(alert_settings)
twilio         = TwilioNotifier(alert_settings)
esp32_monitor  = ESP32Monitor(location_state, telegram, twilio)
detector       = DetectionEngine(video_stream, location_state, telegram, twilio, alert_settings)
